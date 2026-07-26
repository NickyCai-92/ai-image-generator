/**
 * APIMart Provider
 *
 * 聚合 API 市场（apimart.ai），500+ AI 模型统一接入，支持支付宝（Antom 通道）。
 * 一个 sk- Key 调全部，OpenAI 兼容，全部模型官方 20% 折扣 + 批量折扣。
 *
 * 两套 API 格式（按模型自动路由）：
 *
 *   A) images/generations（OpenAI 标准）
 *      端点：POST https://api.apimart.ai/v1/images/generations
 *      模型：gpt-image-*, flux-2-pro, flux-kontext-pro
 *      请求：{ model, prompt, size, n, image? }
 *      返回：{ data: [{ url | b64_json }] }
 *
 *   B) chat/completions（Gemini / 字节 / 智谱系）
 *      端点：POST https://api.apimart.ai/v1/chat/completions
 *      模型：nano-banana-*, doubao-seedream-*, z-image-turbo, qwen-image-*, wan2.7-*, grok-imagine-*
 *      请求：{ model, messages: [{ role, content: [{ type, text/image_url }] }] }
 *      返回：{ choices: [{ message: { multi_mod_content: [{ inline_data: { data, mime_type } }] } }] }
 */
const { BaseProvider } = require('./base');
const { PROVIDERS } = require('../config');

const GEN_ENDPOINT  = 'https://api.apimart.ai/v1/images/generations';
const CHAT_ENDPOINT = 'https://api.apimart.ai/v1/chat/completions';

class APIMartProvider extends BaseProvider {
  constructor() {
    super();
    this.id = 'apimart';
    this.meta = PROVIDERS.apimart;
    this.apiKey = process.env.APIMART_KEY || '';
  }

  getModels() { return this.meta.models; }
  get supportsI2I() { return this.meta.supportsI2I; }

  // ---- 路由：该模型用 images/generations 还是 chat/completions ----
  _isGenModel(modelId) {
    return /^(gpt-image-|flux-(2|kontext))/.test(modelId);
  }

  // ---- 通用 ----
  _headers(key) {
    return {
      Authorization: `Bearer ${key || this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  _fmtSize(w, h) {
    const clamp = (v) => Math.max(256, Math.min(2048, Math.round(v)));
    const snap = (v) => Math.round(clamp(v) / 8) * 8;
    return `${snap(w)}x${snap(h)}`;
  }

  // ---- 构造 Generation 请求体 ----
  _buildGenBody({ prompt, w, h, model, n, isI2I, image }) {
    const body = { model, prompt, size: this._fmtSize(w, h), n: n || 1 };
    if (isI2I && image) body.image = image;
    return body;
  }

  // ---- 构造 Chat 请求体 ----
  _buildChatBody({ prompt, w, h, model, isI2I, image, extraImages }) {
    const userContent = [];
    if (isI2I && image) {
      if (Array.isArray(extraImages) && extraImages.length) {
        extraImages.forEach((img) => userContent.push({ type: 'image_url', image_url: { url: img } }));
      }
      userContent.push({ type: 'image_url', image_url: { url: image } });
    }
    userContent.push({ type: 'text', text: prompt });
    return { model, messages: [{ role: 'user', content: userContent }] };
  }

  // ---- 解析 Generation 响应 → dataURL ----
  async _parseGenResponse(res) {
    const arr = res.data || res.images || [];
    if (!arr.length || !(arr[0].url || arr[0].b64_json)) {
      throw new Error('APIMart 未返回图片，请换一个模型或重试');
    }
    const d = arr[0];
    if (d.b64_json) {
      return `data:image/png;base64,${d.b64_json}`;
    }
    return this.urlToDataUrl(d.url, {}, 60000);
  }

  // ---- 解析 Chat 响应 → dataURL ----
  _parseChatResponse(res) {
    const choices = res.choices || [];
    if (!choices.length) throw new Error('APIMart Chat 返回为空');
    const msg = choices[0].message || {};
    const mmc = msg.multi_mod_content || [];
    if (mmc.length) {
      const inline = mmc[0].inline_data;
      if (inline && inline.data) {
        return `data:${inline.mime_type || 'image/png'};base64,${inline.data}`;
      }
    }
    const content = msg.content;
    if (typeof content === 'string' && content.startsWith('data:')) return content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url;
      }
    }
    throw new Error('APIMart Chat 未返回图片（可能模型不支持或需要另一格式端点）');
  }

  // ---- 错误映射 ----
  _mapGenError(r, b) {
    if (r.status === 401 || r.status === 403)
      throw Object.assign(new Error('APIMart API Key 无效：请检查 .env 或界面粘贴的 Key'), { status: r.status, body: b, code: 'NEED_KEY' });
    if (r.status === 402 || /insufficient|balance|quota/i.test(b))
      throw Object.assign(new Error('APIMart 余额不足：请到 api.apimart.ai 充值（支持支付宝）后重试'), { status: r.status, body: b, code: 'NEED_CREDIT' });
    if (/get_channel_failed|channel.*busy/i.test(b))
      throw Object.assign(new Error('APIMart 模型通道繁忙，请稍后重试或换一个模型'), { status: 503, body: b, code: 'CHANNEL_BUSY' });
    if (/model.{0,12}not.{0,12}found|does not exist|unknown model|invalid model/i.test(b))
      throw Object.assign(new Error('APIMart 模型不可用：请确认 ID 在当前账户可用'), { status: r.status, body: b, code: 'BAD_MODEL' });
    if (r.status === 429 || /TooManyRequests/i.test(b))
      throw new Error('APIMart 限流');
    throw Object.assign(new Error(`APIMart 请求失败 ${r.status}: ${b.slice(0, 240)}`), { status: r.status, body: b });
  }

  _mapChatError(r, b) {
    if (/get_channel_failed|channel.*busy/i.test(b))
      throw Object.assign(new Error('APIMart 模型通道繁忙，请稍后重试或换一个模型'), { status: 503, body: b, code: 'CHANNEL_BUSY' });
    if (r.status === 429 || /TooManyRequests/i.test(b))
      throw new Error('APIMart 限流');
    if (r.status === 401 || r.status === 403)
      throw Object.assign(new Error('APIMart API Key 无效'), { status: r.status, body: b, code: 'NEED_KEY' });
    if (r.status === 402 || /insufficient|balance|quota/i.test(b))
      throw Object.assign(new Error('APIMart 余额不足'), { status: r.status, body: b, code: 'NEED_CREDIT' });
    if (/model.{0,12}not.{0,12}found|does not exist|unknown model|invalid model/i.test(b))
      throw Object.assign(new Error('APIMart 模型不可用'), { status: r.status, body: b, code: 'BAD_MODEL' });
    throw Object.assign(new Error(`APIMart Chat 请求失败 ${r.status}: ${b.slice(0, 240)}`), { status: r.status, body: b });
  }

  // ---- 跑一张 ----
  async _generateOne({ prompt, model, w, h, seed, n, isI2I, image, extraImages, key }) {
    const useKey = key || this.apiKey;
    if (!useKey) {
      throw Object.assign(
        new Error('APIMart API Key 未配置：请在界面粘贴你的 Key（api.apimart.ai 控制台获取），或在 .env 配置 APIMART_KEY'),
        { code: 'NEED_KEY' }
      );
    }

    const isGen = this._isGenModel(model);
    const endpoint = isGen ? GEN_ENDPOINT : CHAT_ENDPOINT;
    const body = isGen
      ? this._buildGenBody({ prompt, w, h, model, n, isI2I, image })
      : this._buildChatBody({ prompt, w, h, model, isI2I, image, extraImages });
    const mapErr = isGen ? (r, b) => this._mapGenError(r, b) : (r, b) => this._mapChatError(r, b);

    let res;
    try {
      res = await this.withRetry(
        async () => {
          const r = await this.fetchWithTimeout(
            endpoint, { method: 'POST', headers: this._headers(useKey), body: JSON.stringify(body) },
            180000
          );
          if (!r.ok) { const b = await r.text().catch(() => ''); mapErr(r, b); }
          return r.json();
        },
        2,
        { label: 'APIMart', retryOnStatus: [429, 500, 502, 503, 504] }
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('APIMart 生成超时，请稍后重试'), { name: 'AbortError' });
      }
      throw err;
    }

    const dataUrl = isGen ? await this._parseGenResponse(res) : this._parseChatResponse(res);
    const usedSeed = res.seed != null ? res.seed : seed;
    return { image: dataUrl, seed: usedSeed };
  }

  async generateT2I({ prompt, model, w, h, count, key }) {
    const tasks = Array.from({ length: count }, () =>
      this._generateOne({ prompt, model, w, h, seed: Math.floor(Math.random() * 1e8), key })
        .catch((e) => ({ error: e.message }))
    );
    return Promise.all(tasks);
  }

  async generateI2I({ prompt, model, w, h, image, key, extraImages, scene }) {
    return this._generateOne({
      prompt, model, w, h,
      seed: Math.floor(Math.random() * 1e8),
      isI2I: true,
      image,
      extraImages,
      key,
    });
  }
}

module.exports = { APIMartProvider };
