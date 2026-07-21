/**
 * AIHubMix Provider
 *
 * 聚合平台（aihubmix.com），统一接入多家厂商的生图模型，支持支付宝/微信。
 * 一个 sk- Key 调全部，Microsoft/AWS/GCP 授权代理。
 *
 * 两套 API 格式（按模型自动路由）：
 *
 *   A) images/generations（OpenAI 标准）
 *      端点：POST https://api.aihubmix.com/v1/images/generations
 *      模型：gpt-image-*（GPT Image 2 等）
 *      请求：{ model, prompt, size, n, image? }
 *      返回：{ data: [{ url | b64_json }] }
 *
 *   B) chat/completions（Gemini / 字节 / 智谱系）
 *      端点：POST https://api.aihubmix.com/v1/chat/completions
 *      模型：gemini-*, doubao-seedream-*, flux-kontext, z-image-turbo
 *      请求：{ model, messages: [{ role, content: [{ type, text/image_url }] }] }
 *      返回：{ choices: [{ message: { multi_mod_content: [{ inline_data: { data, mime_type } }] } }] }
 */
const { BaseProvider } = require('./base');
const { PROVIDERS, AIHUBMIX_KEY } = require('../config');

const GEN_ENDPOINT  = 'https://api.aihubmix.com/v1/images/generations';
const CHAT_ENDPOINT = 'https://api.aihubmix.com/v1/chat/completions';

class AIHubMixProvider extends BaseProvider {
  constructor() {
    super();
    this.id = 'aihubmix';
    this.meta = PROVIDERS.aihubmix;
    this.apiKey = AIHUBMIX_KEY;
  }

  getModels() { return this.meta.models; }
  get supportsI2I() { return this.meta.supportsI2I; }

  // ---- 路由：该模型用 images/generations 还是 chat/completions ----
  _isGenModel(modelId) {
    // GPT 系走 text-to-image 专用端点
    return /^gpt-/.test(modelId);
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
      throw new Error('AIHubMix 未返回图片，请换一个模型或重试');
    }
    const d = arr[0];
    if (d.b64_json) {
      return `data:image/png;base64,${d.b64_json}`;
    }
    return this.urlToDataUrl(d.url, {}, 60000);
  }

  // ---- 解析 Chat 响应 → dataURL（multi_mod_content[0].inline_data） ----
  _parseChatResponse(res) {
    const choices = res.choices || [];
    if (!choices.length) throw new Error('AIHubMix Chat 返回为空');
    const msg = choices[0].message || {};
    const mmc = msg.multi_mod_content || [];
    if (mmc.length) {
      const inline = mmc[0].inline_data;
      if (inline && inline.data) {
        return `data:${inline.mime_type || 'image/png'};base64,${inline.data}`;
      }
    }
    // 降级：content 字段（部分模型返回文本+图片混合）
    const content = msg.content;
    if (typeof content === 'string' && content.startsWith('data:')) {
      return content;
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          return part.image_url.url;
        }
      }
    }
    throw new Error('AIHubMix Chat 未返回图片（可能模型不支持或需要另一格式端点）');
  }

  // ---- 统一错误映射 ----
  _mapGenError(r, b) {
    if (r.status === 401 || r.status === 403)
      throw Object.assign(new Error('AIHubMix API Key 无效：请检查 .env 或界面粘贴的 Key'), { status: r.status, body: b, code: 'NEED_KEY' });
    if (r.status === 402 || /insufficient|balance|quota/i.test(b))
      throw Object.assign(new Error('AIHubMix 余额不足：请到 aihubmix.com 充值（支付宝/微信）后重试'), { status: r.status, body: b, code: 'NEED_CREDIT' });
    if (/model.{0,12}not.{0,12}found|does not exist|unknown model|invalid model/i.test(b))
      throw Object.assign(new Error('模型不存在或不可用：请确认 ID 在当前账户可用'), { status: r.status, body: b, code: 'BAD_MODEL' });
    // 限流 → 重新抛出让 withRetry 处理
    if (r.status === 429) throw new Error('AIHubMix 限流');
    throw Object.assign(new Error(`AIHubMix 请求失败 ${r.status}: ${b.slice(0, 240)}`), { status: r.status, body: b });
  }

  _mapChatError(r, b) {
    // 限流单独处理
    if (r.status === 429 || /TooManyRequests/i.test(b))
      throw new Error('AIHubMix 限流');
    if (r.status === 401 || r.status === 403)
      throw Object.assign(new Error('AIHubMix API Key 无效'), { status: r.status, body: b, code: 'NEED_KEY' });
    if (r.status === 402 || /insufficient|balance|quota/i.test(b))
      throw Object.assign(new Error('AIHubMix 余额不足'), { status: r.status, body: b, code: 'NEED_CREDIT' });
    if (/model.{0,12}not.{0,12}found|does not exist|unknown model|invalid model/i.test(b))
      throw Object.assign(new Error('模型不存在或不可用'), { status: r.status, body: b, code: 'BAD_MODEL' });
    throw Object.assign(new Error(`AIHubMix Chat 请求失败 ${r.status}: ${b.slice(0, 240)}`), { status: r.status, body: b });
  }

  // ---- 跑一张：按模型路由 ----
  async _generateOne({ prompt, model, w, h, seed, n, isI2I, image, extraImages, key }) {
    const useKey = key || this.apiKey;
    if (!useKey) {
      throw Object.assign(
        new Error('AIHubMix API Key 未配置：请在界面上方粘贴你的 AIHubMix API Key（aihubmix.com 控制台获取），或在 .env 配置 AIHUBMIX_KEY'),
        { code: 'NEED_KEY' }
      );
    }

    const isGen = this._isGenModel(model);
    const endpoint = isGen ? GEN_ENDPOINT : CHAT_ENDPOINT;
    const body = isGen
      ? this._buildGenBody({ prompt, w, h, model, n, isI2I, image })
      : this._buildChatBody({ prompt, w, h, model, isI2I, image, extraImages });
    const mapErr = isGen
      ? (r, b) => this._mapGenError(r, b)
      : (r, b) => this._mapChatError(r, b);

    let res;
    try {
      res = await this.withRetry(
        async () => {
          const r = await this.fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: this._headers(useKey),
              body: JSON.stringify(body),
            },
            180000
          );
          if (!r.ok) {
            const b = await r.text().catch(() => '');
            mapErr(r, b);
          }
          return r.json();
        },
        2,
        { label: 'AIHubMix', retryOnStatus: [429, 500, 502, 503, 504] }
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('AIHubMix 生成超时，请稍后重试'), { name: 'AbortError' });
      }
      throw err;
    }

    const dataUrl = isGen
      ? await this._parseGenResponse(res)
      : this._parseChatResponse(res);
    const usedSeed = res.seed != null ? res.seed : seed;
    return { image: dataUrl, seed: usedSeed };
  }

  /** 批量文生图 */
  async generateT2I({ prompt, model, w, h, count, key }) {
    const tasks = Array.from({ length: count }, () =>
      this._generateOne({
        prompt, model, w, h,
        seed: Math.floor(Math.random() * 100000000),
        key,
      }).catch((e) => ({ error: e.message }))
    );
    return Promise.all(tasks);
  }

  /** 图生图 */
  async generateI2I({ prompt, model, w, h, image, key, extraImages, scene }) {
    return this._generateOne({
      prompt, model, w, h,
      seed: Math.floor(Math.random() * 100000000),
      isI2I: true,
      image,
      extraImages,
      key,
    });
  }
}

module.exports = { AIHubMixProvider };
