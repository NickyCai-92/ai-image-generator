/**
 * AI 图片生成器 —— 服务端
 *
 * 架构：Provider 抽象层，支持 AIHubMix（默认·统一接入）↔ Hugging Face（免费）↔ Pollinations（备用）切换。
 * 可通过 config.js 的 hidden:true 隐藏 provider，通过 UI_FLAGS.hiddenTabs 隐藏 tab。
 * 切换方式：
 *   1. 环境变量 PROVIDER=xxx + 对应 KEY=xxx（启动时生效）
 *   2. 前端运行时切换（每个请求带 X-Provider 或 body.provider）
 */
// 必须在最顶部加载 .env，确保 config.js 读取环境变量前已注入
require('dotenv').config();

const express = require('express');
const path = require('path');
const { D1Client } = require('./db/d1');
const { R2Client } = require('./db/r2');
const {
  getProvider,
  listProviders,
  resolveProvider,
  STYLES,
  ASPECT_RATIOS,
  RESOLUTIONS,
  MAX_COUNT,
  UI_FLAGS,
} = require('./providers');

const app = express();
const PORT = process.env.PORT || 3000;

// D1 数据库（可选，只有配了 D1 环境变量才启用）
let d1 = null;
if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.D1_DATABASE_ID && process.env.D1_API_TOKEN) {
  d1 = new D1Client({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.D1_DATABASE_ID,
    apiToken: process.env.D1_API_TOKEN,
  });
  d1.initSchema().then(() => {
    console.log('✅ D1 Showcase 已就绪');
  }).catch((err) => {
    console.error('❌ D1 初始化失败:', err.message);
    d1 = null;
  });
} else {
  console.log('ℹ️  D1 未配置，Showcase 功能禁用（设置 CLOUDFLARE_ACCOUNT_ID / D1_DATABASE_ID / D1_API_TOKEN 启用）');
}

// R2 图片存储（可选）
let r2 = null;
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL) {
  try {
    r2 = new R2Client({
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL,
    });
    console.log('✅ R2 图片存储已就绪');
  } catch (err) {
    console.error('❌ R2 初始化失败:', err.message);
  }
} else {
  console.log('ℹ️  R2 未配置，图片将用 base64 内联存储（设置 R2_* 环境变量启用）');
}

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============ 中间件：解析本次请求使用的 provider ============
app.use((req, res, next) => {
  // 优先 header，其次 body，最后默认
  const requested =
    req.headers['x-provider'] ||
    (req.body && req.body.provider) ||
    null;
  req.providerId = resolveProvider(requested);
  req.provider = getProvider(req.providerId);
  next();
});

// ============ API: 配置 ============
app.get('/api/config', (req, res) => {
  const providers = listProviders();
  const provider = req.provider;

  res.json({
    providers,
    activeProvider: req.providerId,
    models: provider.getModels(),
    styles: STYLES,
    aspectRatios: Object.keys(ASPECT_RATIOS),
    resolutions: Object.keys(RESOLUTIONS),
    maxCount: MAX_COUNT,
    supportsI2I: provider.supportsI2I,
    uiFlags: UI_FLAGS, // 前端按需过滤（隐藏的 provider/tab）
  });
});

// ============ API: 文生图 / 批量 ============
app.post('/api/generate', async (req, res) => {
  const { prompt, model, style, aspectRatio, resolution, count } = req.body;
  const provider = req.provider;
  // 前端粘贴的凭证（每次请求携带，优先级高于环境变量）
  // 按当前 provider 取对应专属头；历史兼容：pollinations → X-Pollinations-Token
  const reqKeyByProvider = {
    aihubmix: req.headers['x-aihubmix-key'] || '',
    siliconflow: req.headers['x-siliconflow-key'] || '',
    fal: req.headers['x-fal-key'] || '',
    huggingface: req.headers['x-huggingface-key'] || '',
    apimart: req.headers['x-apimart-key'] || '',
  };
  const reqKey = reqKeyByProvider[req.providerId] || '';
  const reqToken = req.headers['x-pollinations-token'] || '';

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: '请输入提示词' });
  }

  const models = provider.getModels();
  const useModel = models.find((m) => m.id === model) ? model : models[0].id;

  const finalPrompt = provider.buildPrompt(prompt, style);
  const { w, h } = provider.buildDimensions(aspectRatio, resolution);
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), MAX_COUNT);

  try {
    const results = await provider.generateT2I({
      prompt: finalPrompt,
      model: useModel,
      w,
      h,
      count: n,
      token: reqToken, // pollinations 用
      key: reqKey,     // aihubmix/siliconflow/fal/huggingface 用
    });

    const ok = results.filter((x) => x && !x.error);
    const failed = results.filter((x) => x && x.error).map((x) => x.error);

    if (ok.length === 0) {
      return res.status(502).json({
        error: '所有图片生成失败',
        details: failed.join('; '),
        provider: req.providerId,
      });
    }

    res.json({
      success: true,
      images: ok.map((r) => r.image),
      seeds: ok.map((r) => r.seed),
      prompt: finalPrompt,
      failed,
      model: useModel,
      provider: req.providerId,
      aspectRatio,
      resolution,
    });
  } catch (err) {
    console.error('Generation error:', err);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '生成超时，请稍后重试' });
    }
    res.status(500).json({ error: '生成失败', details: err.message, provider: req.providerId });
  }
});

// ============ API: 图生图 ============
app.post('/api/i2i', async (req, res) => {
  const { prompt, image, model, style, aspectRatio, resolution, images, scene } = req.body;
  const provider = req.provider;
  const reqKeyByProvider = {
    aihubmix: req.headers['x-aihubmix-key'] || '',
    siliconflow: req.headers['x-siliconflow-key'] || '',
    fal: req.headers['x-fal-key'] || '',
    huggingface: req.headers['x-huggingface-key'] || '',
    apimart: req.headers['x-apimart-key'] || '',
  };
  const reqKey = reqKeyByProvider[req.providerId] || '';
  const reqToken = req.headers['x-pollinations-token'] || '';

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: '请输入提示词' });
  }
  if (!image) {
    return res.status(400).json({ error: '请上传一张图片' });
  }
  if (!provider.supportsI2I) {
    return res.status(400).json({
      error: `${req.providerId === 'pollinations' ? 'Pollinations' : '当前'} provider 不支持图生图，请切换到支持图生图的引擎（如 AIHubMix）`,
      hint: 'switch_provider',
    });
  }

  const models = provider.getModels();
  const useModel = models.find((m) => m.id === model) ? model : models[0].id;
  const finalPrompt = provider.buildPrompt(prompt, style);
  const { w, h } = provider.buildDimensions(aspectRatio, resolution);

  try {
    const result = await provider.generateI2I({
      prompt: finalPrompt,
      model: useModel,
      w,
      h,
      image,
      extraImages: images || [], // 多图融合（创意工坊）
      scene: scene || '',       // 场景模板标识
      key: reqKey,
      token: reqToken,
    });

    res.json({
      success: true,
      images: [result.image],
      seeds: [result.seed],
      prompt: finalPrompt,
      model: useModel,
      provider: req.providerId,
    });
  } catch (err) {
    console.error('I2I error:', err);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '生成超时，请稍后重试' });
    }
    res.status(500).json({ error: '图生图失败', details: err.message, provider: req.providerId });
  }
});

// ============ API: 切换 provider（返回新 provider 的配置） ============
app.get('/api/config/:providerId', (req, res) => {
  const { providerId } = req.params;
  const providers = listProviders();
  const meta = providers.find((p) => p.id === providerId);

  if (!meta) {
    return res.status(404).json({ error: `未知 provider: ${providerId}` });
  }
  if (!meta.available) {
    return res.status(400).json({ error: `${meta.name} 暂不可用（需要 API Key）` });
  }

  const provider = getProvider(providerId);
  res.json({
    providers,
    activeProvider: providerId,
    models: provider.getModels(),
    styles: STYLES,
    aspectRatios: Object.keys(ASPECT_RATIOS),
    resolutions: Object.keys(RESOLUTIONS),
    maxCount: MAX_COUNT,
    supportsI2I: provider.supportsI2I,
  });
});

// ============ API: 保存生成记录到 Showcase ============
app.post('/api/showcase/save', async (req, res) => {
  if (!d1) return res.status(503).json({ error: 'Showcase 未启用（D1 未配置）' });
  const { image, prompt, model, provider, scene } = req.body;
  if (!image) return res.status(400).json({ error: '缺少图片数据' });
  try {
    let imageUrl = '';
    // 如果有 R2，上传到 R2 再保存 URL
    if (r2) {
      imageUrl = await r2.uploadImage(image);
    }
    await d1.saveImage({
      imageData: r2 ? '' : image, // 有 R2 时不用存 base64
      imageUrl,
      prompt, model, provider, scene,
    });
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ error: '保存失败', details: err.message });
  }
});

// ============ API: 获取最新 10 张 Showcase 图片（不含完整 dataUrl，需单独取） ============
app.get('/api/showcase/latest', async (req, res) => {
  if (!d1) return res.status(503).json({ error: 'Showcase 未启用（D1 未配置）' });
  try {
    const images = await d1.getLatestImages(10);
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ error: '查询失败', details: err.message });
  }
});

// ============ API: 获取单张 Showcase 图片 ============
app.get('/api/showcase/image/:id', async (req, res) => {
  if (!d1) return res.status(503).json({ error: 'Showcase 未启用（D1 未配置）' });
  try {
    const img = await d1.getImage(Number(req.params.id));
    if (!img) return res.status(404).json({ error: '图片不存在' });
    // 如果有 R2 URL，重定向到 R2（304/302 让浏览器直接加载）
    if (img.image_url) {
      return res.redirect(301, img.image_url);
    }
    // 降级：没有 R2 URL 则返回 base64 data URL
    if (img.image_data) {
      const base64 = img.image_data;
      const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const buf = Buffer.from(match[2], 'base64');
        res.set('Content-Type', `image/${match[1]}`);
        res.set('Cache-Control', 'public, max-age=31536000');
        return res.send(buf);
      }
    }
    return res.status(404).json({ error: '图片数据为空' });
  } catch (err) {
    res.status(500).json({ error: '查询失败', details: err.message });
  }
});

app.listen(PORT, () => {
  const providers = listProviders();
  console.log(`🚀 AI 图片生成器已启动: http://localhost:${PORT}`);
  console.log(`📦 主引擎: AIHubMix（统一接入·支付宝）· 备用: 硅基流动 / Fal.ai / Pollinations`);
  providers.forEach((p) => {
    const keyState = p.hasServerKey ? '🔑 已配置凭证' : '🔓 未配置凭证（可在界面粘贴）';
    const hiddenTag = p.hidden ? '（已隐藏入口）' : '';
    console.log(`   • ${p.name}（${p.badge}）— ${p.models.length} 个模型${p.supportsI2I ? ' · 支持图生图' : ''} · ${keyState} ${hiddenTag}`);
  });
  const ahm = providers.find((p) => p.id === 'aihubmix');
  if (!ahm?.hasServerKey) {
    console.log('   💡 AIHubMix：在网页顶部粘贴 API Key 即可出图，或在 .env 配置 AIHUBMIX_KEY');
  }
  const hf = providers.find((p) => p.id === 'huggingface');
  if (hf && !hf.hasServerKey && !hf.hidden) {
    console.log('   💡 Hugging Face：免费推理！去 huggingface.co/settings/tokens 建一个 token 即可');
  }
  if (UI_FLAGS.hiddenTabs && UI_FLAGS.hiddenTabs.length) {
    console.log(`   🙈 UI 隐藏的 tab: ${UI_FLAGS.hiddenTabs.join(', ')}`);
  }
});
