/**
 * Fal.ai Provider
 *
 * 基于 Fal.ai queue API（submit → poll status → get result），生产级模型。
 * 需要 FAL_KEY 环境变量。支持文生图 + 图生图。
 *
 * 队列流程：
 *   1. POST  /submit            → { request_id }
 *   2. GET   /status/{id}       → { status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED }
 *   3. GET   /requests/{id}/get → { images: [{ url }], seed }
 */
const { BaseProvider } = require('./base');
const { PROVIDERS, FAL_KEY } = require('../config');

const FAL_QUEUE_BASE = 'https://queue.fal.run';
const POLL_INTERVAL = 1500; // 轮询间隔
const MAX_POLL_MS = 180000; // 最长等待 3 分钟

class FalProvider extends BaseProvider {
  constructor() {
    super();
    this.id = 'fal';
    this.meta = PROVIDERS.fal;
    this.apiKey = FAL_KEY;
  }

  getModels() {
    return this.meta.models;
  }

  get supportsI2I() {
    return this.meta.supportsI2I;
  }

  // ---- 内部：统一请求头（key 可来自每请求，回退到 env） ----
  _headers(key, extra = {}) {
    return {
      Authorization: `Key ${key || this.apiKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  // ---- 内部：提交队列请求 ----
  async _submit(modelId, input, key) {
    const res = await this.fetchWithTimeout(
      `${FAL_QUEUE_BASE}/${modelId}/submit`,
      {
        method: 'POST',
        headers: this._headers(key),
        body: JSON.stringify(input),
      },
      30000
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let msg = `Fal.ai 提交失败 ${res.status}`;
      try {
        const j = JSON.parse(body);
        if (j.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        /* ignore */
      }
      // 鉴权失败给出明确引导
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(
          new Error('Fal.ai API Key 无效或缺失：请在界面上方粘贴有效的 Fal.ai API Key（fal.ai/dashboard/keys 获取），或在 .env 配置 FAL_KEY'),
          { status: res.status, body, code: 'NEED_KEY' }
        );
      }
      throw Object.assign(new Error(msg), { status: res.status, body });
    }
    const data = await res.json();
    if (!data.request_id) {
      throw new Error('Fal.ai 未返回 request_id');
    }
    return data.request_id;
  }

  // ---- 内部：轮询状态直到完成 ----
  async _pollUntilDone(modelId, requestId, key) {
    const start = Date.now();
    let lastStatus = '';
    while (Date.now() - start < MAX_POLL_MS) {
      const res = await this.fetchWithTimeout(
        `${FAL_QUEUE_BASE}/${modelId}/status/${requestId}`,
        { headers: this._headers(key) },
        30000
      );
      if (!res.ok) {
        throw Object.assign(new Error(`Fal.ai 状态查询失败 ${res.status}`), { status: res.status });
      }
      const data = await res.json();
      lastStatus = data.status;

      if (data.status === 'COMPLETED') {
        return;
      }
      if (data.status === 'FAILED') {
        const reason = data.error || 'Fal.ai 生成失败';
        throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
      }
      // IN_QUEUE / IN_PROGRESS → 继续轮询
      await this.sleep(POLL_INTERVAL);
    }
    throw new Error(`Fal.ai 生成超时（最后状态: ${lastStatus}）`);
  }

  // ---- 内部：获取结果 ----
  async _getResult(modelId, requestId, key) {
    const res = await this.fetchWithTimeout(
      `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/get`,
      { headers: this._headers(key) },
      30000
    );
    if (!res.ok) {
      throw Object.assign(new Error(`Fal.ai 结果获取失败 ${res.status}`), { status: res.status });
    }
    return res.json();
  }

  // ---- 内部：根据模型推断推理参数 ----
  _buildInput({ prompt, w, h, seed, isI2I, imageUrl }) {
    const input = {
      prompt,
      image_size: { width: w, height: h },
      num_images: 1,
      seed: seed != null ? seed : Math.floor(Math.random() * 1000000),
    };

    // schnell 是蒸馏模型，4 步、无 guidance
    if (/schnell/i.test(prompt)) {
      // 不在此判断，改用 model 判断
    }

    // 图生图：附加 image_url（fal 接受 data URL）
    if (isI2I && imageUrl) {
      input.image_url = imageUrl;
    }

    return input;
  }

  // 按模型设置推理参数
  _tuneForModel(input, modelId) {
    if (/schnell/i.test(modelId)) {
      input.num_inference_steps = 4;
      input.guidance_scale = 0;
    } else if (/pro/i.test(modelId)) {
      input.num_inference_steps = 28;
      input.guidance_scale = 3.5;
    } else {
      // dev / realism / anime / 3d
      input.num_inference_steps = 28;
      input.guidance_scale = 3.5;
    }
    return input;
  }

  // ---- 内部：完整跑一张图 ----
  async _runOne({ prompt, model, w, h, seed, isI2I, imageUrl, key }) {
    let input = this._buildInput({ prompt, w, h, seed, isI2I, imageUrl });
    input = this._tuneForModel(input, model);

    const requestId = await this._submit(model, input, key);
    await this._pollUntilDone(model, requestId, key);
    const result = await this._getResult(model, requestId, key);

    if (!result.images || !result.images.length) {
      throw new Error('Fal.ai 未返回图片');
    }

    // fal 返回的是托管 URL，统一拉取转 data URL
    const imgUrl = result.images[0].url;
    const dataUrl = await this.urlToDataUrl(imgUrl, {}, 60000);
    const usedSeed = result.seed != null ? result.seed : seed;
    return { image: dataUrl, seed: usedSeed };
  }

  /** 校验凭证：无 key（每请求 + env 都没有）时抛清晰错误 */
  _ensureKey(key) {
    const useKey = key || this.apiKey;
    if (!useKey) {
      throw Object.assign(
        new Error('Fal.ai API Key 未配置：请在界面上方粘贴你的 Fal.ai API Key（fal.ai/dashboard/keys 获取），或在 .env 配置 FAL_KEY'),
        { code: 'NEED_KEY' }
      );
    }
    return useKey;
  }

  /**
   * 批量文生图
   * @param {string} [key] - 每请求携带的 API Key（优先于 env FAL_KEY）
   */
  async generateT2I({ prompt, model, w, h, count, key }) {
    let useKey;
    try {
      useKey = this._ensureKey(key);
    } catch (e) {
      // 无 key：每张都返回同一个引导错误
      return Array.from({ length: count }, () => ({ error: e.message }));
    }
    const tasks = Array.from({ length: count }, () =>
      this._runOne({ prompt, model, w, h, key: useKey }).catch((e) => ({ error: e.message }))
    );
    return Promise.all(tasks);
  }

  /**
   * 图生图
   * @param {string} image - data URL 格式的参考图
   * @param {string} [key] - 每请求携带的 API Key
   */
  async generateI2I({ prompt, model, w, h, image, key }) {
    const useKey = this._ensureKey(key);

    // 注意：flux-realism/anime/3d 等 LoRA 模型不支持 i2i，回退到 flux-dev/pro
    let useModel = model;
    const i2iCapable = /flux\/(dev|pro)|flux-pro/i.test(model);
    if (!i2iCapable) {
      console.warn(`[Fal] 模型 ${model} 不支持图生图，降级到 fal-ai/flux/dev`);
      useModel = 'fal-ai/flux/dev';
    }

    return this._runOne({
      prompt,
      model: useModel,
      w,
      h,
      isI2I: true,
      imageUrl: image,
      key: useKey,
    });
  }
}

module.exports = { FalProvider };
