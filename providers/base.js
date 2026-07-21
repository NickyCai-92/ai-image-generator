/**
 * Provider 基类 —— 共享工具方法。
 * 每个 provider 继承并实现 getModels / generateT2I / generateI2I。
 */
const { STYLES, ASPECT_RATIOS, RESOLUTIONS } = require('../config');

class BaseProvider {
  constructor() {
    this.styles = STYLES;
    this.aspectRatios = ASPECT_RATIOS;
    this.resolutions = RESOLUTIONS;
  }

  // ---- 子类必须实现 ----
  // getModels() -> [{ id, name, icon, desc }]
  // async generateT2I({ prompt, model, w, h, count, seed }) -> [{ image, seed }]
  // async generateI2I({ prompt, model, w, h, image, seed }) -> [{ image, seed }]

  // ---- 共享工具 ----

  /** 拼接风格提示词 */
  buildPrompt(userPrompt, styleId) {
    const style = this.styles.find((s) => s.id === styleId);
    const styleText = style && style.prompt ? style.prompt : '';
    return [userPrompt, styleText].filter(Boolean).join(', ');
  }

  /** 根据比例 + 分辨率档位算出像素尺寸 */
  buildDimensions(ratioId, resolutionId) {
    const ratio = this.aspectRatios[ratioId] || this.aspectRatios['1:1'];
    const scale = this.resolutions[resolutionId] || 1;
    return {
      w: Math.round(ratio.w * scale),
      h: Math.round(ratio.h * scale),
    };
  }

  /** 带超时的 fetch */
  async fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 带重试的执行器
   * @param {Function} fn   - 异步函数，返回结果
   * @param {number} retries - 最大重试次数
   * @param {Array} retryOn - 哪些状态码/错误触发重试
   */
  async withRetry(fn, retries = 2, { label = '请求', retryOnStatus = [429, 500, 502, 503, 504] } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn(attempt);
        return result;
      } catch (err) {
        lastErr = err;
        const shouldRetry =
          err.name === 'AbortError' ||
          (retryOnStatus.includes(err.status)) ||
          (err.code === 'ECONNRESET');
        const isLast = attempt >= retries;
        if (!shouldRetry || isLast) break;
        // 指数退避：1s, 2s, 4s...
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        console.warn(`[${label}] 第 ${attempt + 1} 次重试（${delay}ms 后）: ${err.message}`);
      }
    }
    throw lastErr;
  }

  /** 把 Buffer 转成 data URL */
  bufferToDataUrl(buffer, mime = 'image/png') {
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  /** 把远程图片 URL 拉取并转成 data URL（统一前端处理） */
  async urlToDataUrl(url, headers = {}, timeoutMs = 60000) {
    const res = await this.fetchWithTimeout(url, { headers }, timeoutMs);
    if (!res.ok) {
      throw Object.assign(new Error(`图片下载失败 ${res.status}`), { status: res.status });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const mime = ct.includes('png') ? 'image/png' : 'image/jpeg';
    return this.bufferToDataUrl(buffer, mime);
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = { BaseProvider };
