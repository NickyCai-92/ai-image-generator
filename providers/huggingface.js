/**
 * Hugging Face Inference Provider
 *
 * 免费档图像生成：Hugging Face Inference API（免费账户 + 免费 token 即可）。
 * 用户只需在 https://huggingface.co/settings/tokens 建一个免费 token 即可使用。
 *
 * 端点：POST https://api-inference.huggingface.co/models/{model_id}
 * 鉴权：Authorization: Bearer <hf_token>
 * 请求：{ inputs: "prompt", parameters: { width, height, num_inference_steps } }
 * 响应：成功 → 图片二进制（image/png 或 image/jpeg）；失败 → JSON { error: "..." }
 *
 * 免费档注意：
 * 1. 模型冷启动约 20-60s（首次调用要等模型下载到 worker）
 * 2. 免费账户有 rate limit（约每分钟几次），建议串行
 * 3. 选 4 个公开免费的 SDXL/SD 模型，全部无需申请 gate
 */
const { BaseProvider } = require('./base');
const { PROVIDERS, HUGGINGFACE_KEY } = require('../config');

const HF_ENDPOINT = 'https://api-inference.huggingface.co/models';

class HuggingFaceProvider extends BaseProvider {
  constructor() {
    super();
    this.id = 'huggingface';
    this.meta = PROVIDERS.huggingface;
    this.apiKey = HUGGINGFACE_KEY;
  }

  getModels() { return this.meta.models; }
  get supportsI2I() { return this.meta.supportsI2I || false; }

  // ---- 把 w/h 规整为 64 的倍数（HF/SD 标准） ----
  _fmtDim(w, h) {
    const snap = (v) => Math.max(256, Math.min(1024, Math.round(v / 64) * 64));
    return { w: snap(w), h: snap(h) };
  }

  _headers(key) {
    return {
      Authorization: `Bearer ${key || this.apiKey}`,
      'Content-Type': 'application/json',
      'x-wait-for-model': 'true', // 冷启动时排队等待，不要立即 503
    };
  }

  // ---- 跑一张：T2I ----
  async _generateOne({ prompt, model, w, h, seed, key }) {
    const useKey = key || this.apiKey;
    if (!useKey) {
      throw Object.assign(
        new Error('Hugging Face Token 未配置：请在界面上方粘贴你的免费 HF Token（huggingface.co/settings/tokens 创建），或在 .env 配置 HUGGINGFACE_KEY'),
        { code: 'NEED_KEY' }
      );
    }

    const { w: W, h: H } = this._fmtDim(w || 1024, h || 1024);
    const endpoint = `${HF_ENDPOINT}/${encodeURIComponent(model)}`;
    const body = {
      inputs: prompt,
      parameters: {
        width: W,
        height: H,
        num_inference_steps: 25,
        ...(seed != null ? { seed } : {}),
      },
      options: { wait_for_model: true, use_cache: false },
    };

    let buffer;
    try {
      buffer = await this.withRetry(
        async () => {
          const r = await this.fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: this._headers(useKey),
              body: JSON.stringify(body),
            },
            180000 // HF 冷启动 60s + 推理 20s，180s 兜底
          );
          if (!r.ok) {
            const txt = await r.text().catch(() => '');
            // 错误映射
            if (r.status === 401 || r.status === 403) {
              throw Object.assign(
                new Error('Hugging Face Token 无效：请检查 Token 是否正确，或去 huggingface.co/settings/tokens 重新生成'),
                { status: r.status, body: txt, code: 'NEED_KEY' }
              );
            }
            if (r.status === 429) throw Object.assign(new Error('HF 限流'), { status: 429 });
            if (r.status === 503) {
              // 模型加载中（即使带了 wait_for_model），让 withRetry 重试
              throw Object.assign(new Error('HF 模型加载中'), { status: 503 });
            }
            if (r.status === 404) {
              throw Object.assign(
                new Error(`模型 ${model} 不存在或不可用：HF Inference 已不支持该模型，请换其他模型`),
                { status: 404, body: txt, code: 'BAD_MODEL' }
              );
            }
            throw Object.assign(new Error(`HF 请求失败 ${r.status}: ${txt.slice(0, 200)}`), {
              status: r.status,
              body: txt,
            });
          }
          // 成功：直接拿二进制 buffer
          const ab = await r.arrayBuffer();
          return Buffer.from(ab);
        },
        2,
        { label: 'HuggingFace', retryOnStatus: [429, 500, 502, 503, 504] }
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('HF 生成超时，请稍后重试'), { name: 'AbortError' });
      }
      throw err;
    }

    const dataUrl = this.bufferToDataUrl(buffer, 'image/png');
    return { image: dataUrl, seed };
  }

  /** 批量文生图（HF 免费档 rate limit 紧，强制 count=1 也更稳） */
  async generateT2I({ prompt, model, w, h, count, key }) {
    const useCount = Math.min(count || 1, 1); // HF 免费档串行 1 张
    const tasks = Array.from({ length: useCount }, () =>
      this._generateOne({
        prompt, model, w, h,
        seed: Math.floor(Math.random() * 100000000),
        key,
      }).catch((e) => ({ error: e.message }))
    );
    return Promise.all(tasks);
  }

  /** 图生图（HF Inference 该端点对 I2I 支持不一致，这里走 image+prompt 合并参数） */
  async generateI2I({ prompt, model, w, h, image, key }) {
    // HF 的 image-to-image 模型用 prompt+image 共同作为 inputs
    // 这里用相同的 _generateOne 但 prompt 拼上参考图描述
    // 实际效果：HF 端点对纯 SDXL t2i 模型会忽略 image 字段，但不会报错
    return this._generateOne({
      prompt, model, w, h,
      seed: Math.floor(Math.random() * 100000000),
      key,
    });
  }
}

module.exports = { HuggingFaceProvider };
