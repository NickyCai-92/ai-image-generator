/**
 * SiliconFlow (硅基流动) Provider
 *
 * 国内 AI 推理平台，API 兼容 OpenAI 协议，支持支付宝/微信充值，国内高速直连。
 * 图像生成走统一端点：POST https://api.siliconflow.cn/v1/images/generations
 * 鉴权：Authorization: Bearer <api_key>
 * 返回 { images: [{ url }], seed }，图片 URL 仅 1 小时有效，统一拉取转 data URL。
 *
 * 支持文生图 + 图生图（FLUX.1-dev 支持 image 参数做 img2img）。
 */
const { BaseProvider } = require('./base');
const { PROVIDERS, SILICONFLOW_KEY } = require('../config');

const SF_ENDPOINT = 'https://api.siliconflow.cn/v1/images/generations';

class SiliconFlowProvider extends BaseProvider {
  constructor() {
    super();
    this.id = 'siliconflow';
    this.meta = PROVIDERS.siliconflow;
    this.apiKey = SILICONFLOW_KEY;
  }

  getModels() {
    return this.meta.models;
  }

  get supportsI2I() {
    return this.meta.supportsI2I;
  }

  // ---- 内部：统一请求头 ----
  _headers(key) {
    return {
      Authorization: `Bearer ${key || this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  // ---- 内部：把 w/h 规整为 FLUX 友好的尺寸（16 的倍数，256~1440） ----
  _fmtSize(w, h) {
    const clamp = (v) => Math.max(256, Math.min(1440, Math.round(v)));
    const snap = (v) => Math.round(clamp(v) / 16) * 16;
    return `${snap(w)}x${snap(h)}`;
  }

  // ---- 内部：构造请求体 ----
  _buildBody({ prompt, w, h, seed, isI2I, imageUrl, model }) {
    const isSchnell = /schnell/i.test(model);
    const body = {
      model,
      prompt,
      image_size: this._fmtSize(w, h),
      num_inference_steps: isSchnell ? 4 : 20,
      guidance_scale: isSchnell ? 0 : 3.5,
    };
    if (seed != null) body.seed = seed;
    // 图生图：附加参考图（data URL 或外链），FLUX.1-dev 支持
    if (isI2I && imageUrl) body.image = imageUrl;
    return body;
  }

  // ---- 内部：跑一张图 ----
  async _generateOne({ prompt, model, w, h, seed, isI2I, imageUrl, key }) {
    const useKey = key || this.apiKey;
    if (!useKey) {
      throw Object.assign(
        new Error('硅基流动 API Key 未配置：请在界面上方粘贴你的硅基流动 API Key（siliconflow.cn 控制台获取），或在 .env 配置 SILICONFLOW_KEY'),
        { code: 'NEED_KEY' }
      );
    }

    const body = this._buildBody({ prompt, w, h, seed, isI2I, imageUrl, model });

    let res;
    try {
      res = await this.withRetry(
        async () => {
          const r = await this.fetchWithTimeout(
            SF_ENDPOINT,
            {
              method: 'POST',
              headers: this._headers(useKey),
              body: JSON.stringify(body),
            },
            120000
          );
          if (!r.ok) {
            const b = await r.text().catch(() => '');
            // 鉴权失败
            if (r.status === 401 || r.status === 403) {
              throw Object.assign(
                new Error('硅基流动 API Key 无效或缺失：请检查 Key 是否正确（siliconflow.cn 控制台获取），或在 .env 配置 SILICONFLOW_KEY'),
                { status: r.status, body: b, code: 'NEED_KEY' }
              );
            }
            // 余额不足（SiliconFlow 用 402 / insufficient 提示）
            if (r.status === 402 || /insufficient|balance|quota/i.test(b)) {
              throw Object.assign(
                new Error('硅基流动账户余额不足：请到 siliconflow.cn 账户余额页充值（支持支付宝/微信）后重试'),
                { status: r.status, body: b, code: 'NEED_CREDIT' }
              );
            }
            throw Object.assign(new Error(`硅基流动请求失败 ${r.status}: ${b.slice(0, 240)}`), {
              status: r.status,
              body: b,
            });
          }
          return r.json();
        },
        2,
        { label: 'SiliconFlow', retryOnStatus: [429, 500, 502, 503, 504] }
      );
    } catch (err) {
      // withRetry 可能因超时被 AbortError 中断
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('硅基流动生成超时，请稍后重试'), { name: 'AbortError' });
      }
      throw err;
    }

    if (!res.images || !res.images.length || !res.images[0].url) {
      throw new Error('硅基流动未返回图片，请换一个模型或重试');
    }

    // SiliconFlow 返回的 URL 仅 1 小时有效，统一拉取转 data URL
    const dataUrl = await this.urlToDataUrl(res.images[0].url, {}, 60000);
    const usedSeed = res.seed != null ? res.seed : seed;
    return { image: dataUrl, seed: usedSeed };
  }

  /** 批量文生图 */
  async generateT2I({ prompt, model, w, h, count, key }) {
    const tasks = Array.from({ length: count }, () =>
      this._generateOne({
        prompt,
        model,
        w,
        h,
        seed: Math.floor(Math.random() * 100000000),
        key,
      }).catch((e) => ({ error: e.message }))
    );
    return Promise.all(tasks);
  }

  /** 图生图 */
  async generateI2I({ prompt, model, w, h, image, key }) {
    // 仅 FLUX.1-dev / 1.1-pro 稳定支持 image 参数；其余模型降级到 dev
    const i2iCapable = /FLUX\.1-(dev|1\.1-pro)/i.test(model);
    const useModel = i2iCapable ? model : 'black-forest-labs/FLUX.1-dev';
    if (!i2iCapable) {
      console.warn(`[SiliconFlow] 模型 ${model} 不支持图生图，降级到 black-forest-labs/FLUX.1-dev`);
    }
    return this._generateOne({
      prompt,
      model: useModel,
      w,
      h,
      seed: Math.floor(Math.random() * 100000000),
      isI2I: true,
      imageUrl: image,
      key,
    });
  }
}

module.exports = { SiliconFlowProvider };
