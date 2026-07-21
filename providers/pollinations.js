/**
 * Pollinations Provider
 *
 * - 文生图：旧端点 https://image.pollinations.ai/prompt/{prompt}?model=...&token=...
 *   （保留以支持 flux / turbo 等老模型 + 与 Token 鉴权兼容）
 * - 图生图：新端点 https://gen.pollinations.ai/v1/images/generations
 *   body 含 image: dataUrl 字段，Bearer sk_xxx 鉴权
 * - 风格差异通过 STYLES 提示词叠加实现
 */
const { BaseProvider } = require('./base');
const { PROVIDERS, POLLINATIONS_TOKEN } = require('../config');

class PollinationsProvider extends BaseProvider {
  constructor() {
    super();
    this.id = 'pollinations';
    this.meta = PROVIDERS.pollinations;
    this.token = POLLINATIONS_TOKEN;
  }

  getModels() {
    return this.meta.models;
  }

  get supportsI2I() {
    return this.meta.supportsI2I;
  }

  /**
   * 单张文生图（旧端点）
   */
  async _generateOne({ prompt, model, w, h, seed, token }) {
    const effToken = token || this.token;
    const useSeed = seed != null ? seed : Math.floor(Math.random() * 1000000);
    const referrer = process.env.POLLINATIONS_REFERRER || 'ai-image-generator';
    const params = new URLSearchParams({
      width: String(w),
      height: String(h),
      model,
      nologo: 'true',
      seed: String(useSeed),
      referrer,
    });
    // 服务端调用 Pollinations 需要 token 解锁额度（同时走 query 与 header，兼容性最佳）
    if (effToken) params.set('token', effToken);

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;

    const result = await this.withRetry(
      async (attempt) => {
        const headers = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (AI-Image-Generator)',
          Accept: 'image/*',
        };
        // Bearer Token（后端鉴权，文档要求）
        if (effToken) headers['Authorization'] = `Bearer ${effToken}`;

        const res = await this.fetchWithTimeout(url, { headers }, 90000);
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          // 402 / 余额不足 → 账户 pollen 不够，需要充值（API Key 本身已生效）
          if (/PAYMENT_REQUIRED|budget too low|402/.test(body) || res.status === 402) {
            throw Object.assign(
              new Error('Pollinations 账户 pollen 余额不足：你的 API Key 已生效，但账户余额不足以支付（每张约 0.0001 pollen）。请到 pollinations.ai 仪表盘为账户充值后重试。'),
              { status: res.status, body, code: 'NEED_CREDIT' }
            );
          }
          // 403 / 鉴权失败 / Turnstile → 需要有效的 API Key / Token
          if (/403|Forbidden|Turnstile|unauthorized|invalid.*(token|key)/i.test(body) || res.status === 403) {
            throw Object.assign(
              new Error('Pollinations 鉴权失败：请在界面上方粘贴你的 Pollinations API Key（pollinations.ai 仪表盘获取），或在 .env 配置 POLLINATIONS_API_KEY / POLLINATIONS_TOKEN。'),
              { status: res.status, body, code: 'NEED_TOKEN' }
            );
          }
          throw Object.assign(new Error(`Pollinations 服务失败 ${res.status}`), {
            status: res.status,
            body,
          });
        }
        // Pollinations 偶尔返回非图片（HTML 错误页），校验 content-type
        const ct = res.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) {
          throw Object.assign(new Error('返回内容非图片，可能触发了限流'), { status: 503 });
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const mime = ct.includes('png') ? 'image/png' : 'image/jpeg';
        return this.bufferToDataUrl(buffer, mime);
      },
      1,
      { label: 'Pollinations', retryOnStatus: [429, 500, 502, 503, 504] }
    );

    return { image: result, seed: useSeed };
  }

  /**
   * 批量文生图
   * @param {object} opts
   * @param {string} [opts.token] 单次请求携带的 token（前端粘贴）
   * @returns {Promise<Array<{ image: string, seed: number } | { error: string }>>}
   */
  async generateT2I({ prompt, model, w, h, count, token }) {
    const tasks = Array.from({ length: count }, (_, i) =>
      this._generateOne({ prompt, model, w, h, token }).catch((e) => ({ error: e.message }))
    );
    return Promise.all(tasks);
  }

  /**
   * 图生图（新端点 gen.pollinations.ai）
   *
   * POST https://gen.pollinations.ai/v1/images/generations
   * body: { prompt, model, image: dataUrl, n, size, response_format: 'b64_json' }
   * auth: Authorization: Bearer sk_xxx（必填）
   *
   * 注：前端会预先把图压缩到 512px JPEG ~80KB，避免 body 超限；
   * 余额不足时返回 402 PAYMENT_REQUIRED。
   */
  async generateI2I({ prompt, model, w, h, image, token }) {
    const effToken = token || this.token;
    if (!effToken) {
      throw new Error('Pollinations 图生图需要 API Key：请在网页顶部粘贴 sk_xxx，或在 .env 配置 POLLINATIONS_TOKEN / POLLINATIONS_API_KEY');
    }

    // 模型 i2i 能力检查
    const modelMeta = this.meta.models.find((m) => m.id === model);
    if (modelMeta && modelMeta.supportsI2I === false) {
      throw new Error(`模型 ${modelMeta.name} 不支持图生图，请切换到支持 i2i 的模型（如 Flux、NanoBanana、Seedream 5.0 Pro 等）`);
    }

    // image 必须是 data URL（前端已传过来）
    if (!image || !image.startsWith('data:')) {
      throw new Error('图生图需要 data URL 格式的参考图');
    }

    const useSeed = Math.floor(Math.random() * 1000000);
    const payload = {
      prompt,
      model,
      image,
      n: 1,
      size: `${w}x${h}`,
      seed: useSeed,
      response_format: 'b64_json',
    };

    const result = await this.withRetry(
      async () => {
        const res = await this.fetchWithTimeout(
          'https://gen.pollinations.ai/v1/images/generations',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${effToken}`,
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (AI-Image-Generator)',
              'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
          },
          120000
        );
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          // 余额不足
          if (res.status === 402 || /PAYMENT_REQUIRED|Insufficient balance|budget/i.test(body)) {
            throw Object.assign(
              new Error('Pollinations 账户余额不足：你的 API Key 已生效，但 pollen 余额为 0。请到 enter.pollinations.ai 充值（支持支付宝）。'),
              { status: 402, body, code: 'NEED_CREDIT' }
            );
          }
          // 鉴权失败
          if (res.status === 401 || res.status === 403 || /unauthorized|invalid.*key/i.test(body)) {
            throw Object.assign(
              new Error('Pollinations 鉴权失败：API Key 无效或缺失。'),
              { status: res.status, body, code: 'NEED_TOKEN' }
            );
          }
          // 模型不支持
          if (res.status === 400 && /model|not.*support|unsupported/i.test(body)) {
            throw Object.assign(
              new Error(`Pollinations 模型 ${model} 不支持图生图或参数不匹配。`),
              { status: 400, body, code: 'BAD_MODEL' }
            );
          }
          throw Object.assign(new Error(`Pollinations 图生图失败 ${res.status}`), {
            status: res.status,
            body,
          });
        }
        const json = await res.json();
        const data = json.data || [];
        if (!data.length || !data[0].b64_json) {
          throw new Error('Pollinations 图生图返回为空');
        }
        const buffer = Buffer.from(data[0].b64_json, 'base64');
        return this.bufferToDataUrl(buffer, 'image/png');
      },
      1,
      { label: 'Pollinations I2I', retryOnStatus: [429, 500, 502, 503, 504] }
    );

    return { image: result, seed: useSeed };
  }
}

module.exports = { PollinationsProvider };
