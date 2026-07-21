/**
 * 集中式配置 —— 模型按 provider 分组，风格/比例/分辨率 provider 无关。
 *
 * 切换 provider 只需改 PROVIDER 环境变量或前端运行时切换，
 * 模型列表会自动跟着变，前端无需改动逻辑。
 */

// ============ Provider 定义 ============
// 主引擎：Pollinations（性价比最高·支付宝） / AIHubMix（通道稳·支付宝）
// 已隐藏：硅基流动 / Fal.ai（按用户要求）
// 高性价比新进：APIMart（500+ 模型·支付宝 Antom·gpt-image-2 仅 $0.0085）
// 免费：Hugging Face
const PROVIDERS = {
  aihubmix: {
    id: 'aihubmix',
    name: 'AIHubMix',
    badge: '统一接入·支付宝',
    desc: '一个 Key 调全部热门生图模型：GPT-Image / Nano Banana / Seedream / FLUX / Z-Image',
    needsKey: true,
    // 浏览器可直接粘贴 API Key（credential），也可用 .env 的 AIHUBMIX_KEY
    credential: {
      storageKey: 'ahm_key',
      header: 'X-AIHubMix-Key',
      label: 'AIHubMix API Key',
      placeholder: '粘贴你的 AIHubMix API Key（aihubmix.com 控制台获取）',
      help: 'https://aihubmix.com/token',
      hint: '登录 aihubmix.com → 控制台 → API 密钥 → 创建 → 支付宝充值后粘贴',
    },
    models: [
      { id: 'gemini-3-pro-image-preview',     name: 'Nano Banana Pro', icon: '🍌', desc: '谷歌顶配·4K·角色一致（推荐）' },
      { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2',   icon: '🍌', desc: '谷歌高速·低成本·均衡' },
      { id: 'gpt-image-2',                    name: 'GPT Image 2',     icon: '🎨', desc: 'OpenAI·文字渲染强' },
      { id: 'doubao-seedream-5.0-pro',        name: 'Seedream 5.0 Pro', icon: '🌱', desc: '字节·精准编辑·中文强' },
      { id: 'flux-kontext',                   name: 'FLUX Kontext',    icon: '⚡', desc: 'BFL·局部编辑·风格迁移' },
      { id: 'z-image-turbo',                  name: 'Z-Image Turbo',   icon: '🐟', desc: '智谱·极速开源' },
    ],
    supportsI2I: true,
  },

  siliconflow: {
    id: 'siliconflow',
    name: '硅基流动',
    badge: '国内·支付宝',
    desc: '国内直连 · 支付宝/微信充值 · FLUX 全系 + 国风模型',
    needsKey: true,
    hidden: true, // 用户要求隐藏入口（保留配置，将来可恢复）
    // 浏览器可直接粘贴 API Key（credential），也可用 .env 的 SILICONFLOW_KEY
    credential: {
      storageKey: 'sf_key',
      header: 'X-SiliconFlow-Key',
      label: '硅基流动 API Key',
      placeholder: '粘贴你的硅基流动 API Key（siliconflow.cn 控制台获取）',
      help: 'https://cloud.siliconflow.cn/account/ak',
      hint: '登录 siliconflow.cn → 控制台 → API 密钥 → 创建新密钥，粘贴即用',
    },
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', name: 'Flux Schnell', icon: '⚡', desc: '极速·4 步出图' },
      { id: 'black-forest-labs/FLUX.1-dev',     name: 'Flux Dev',     icon: '🎨', desc: '高质量开发版（推荐）' },
      { id: 'black-forest-labs/FLUX.1.1-pro',   name: 'Flux Pro 1.1', icon: '🏆', desc: '顶级画质' },
      { id: 'Kwai-Kolors/Kolors',               name: 'Kolors 国风', icon: '🀄', desc: '中文理解强·国风' },
    ],
    supportsI2I: true,
  },

  fal: {
    id: 'fal',
    name: 'Fal.ai',
    badge: '生产级',
    desc: '生产级 Flux 模型 · 画质与速度俱佳 · 支持图生图',
    needsKey: true,
    hidden: true, // 用户要求隐藏入口（保留配置，将来可恢复）
    // 浏览器可直接粘贴 API Key（credential），也可用 .env 的 FAL_KEY
    credential: {
      storageKey: 'fal_key',
      header: 'X-Fal-Key',
      label: 'Fal.ai API Key',
      placeholder: '粘贴你的 Fal.ai API Key（fal.ai/dashboard/keys 获取）',
      help: 'https://fal.ai/dashboard/keys',
      hint: '登录 fal.ai → Dashboard → Keys 创建，粘贴即用',
    },
    models: [
      { id: 'fal-ai/flux/schnell',    name: 'Flux Schnell', icon: '⚡', desc: '极速·4 步出图' },
      { id: 'fal-ai/flux/dev',        name: 'Flux Dev',     icon: '🎨', desc: '高质量开发版（推荐）' },
      { id: 'fal-ai/flux-pro/v1.1',   name: 'Flux Pro 1.1', icon: '🏆', desc: '顶级画质' },
      { id: 'fal-ai/flux-realism',    name: 'Flux Realism', icon: '📷', desc: '超写实风格' },
      { id: 'fal-ai/flux/anime',      name: 'Flux Anime',   icon: '🌸', desc: '动漫风格' },
      { id: 'fal-ai/flux-3d',         name: 'Flux 3D',      icon: '🧊', desc: '3D 渲染风格' },
    ],
    supportsI2I: true,
  },

  pollinations: {
    id: 'pollinations',
    name: 'Pollinations',
    badge: '性价比·支付宝',
    desc: '直接调原厂、无中间商加价 · 支持支付宝充值 · 30+ 热门模型 · 部分 Quest 模型可免费',
    needsKey: false,
    credential: {
      storageKey: 'poll_token',
      header: 'X-Pollinations-Token',
      label: 'Pollinations Token',
      placeholder: '粘贴 Pollinations API Key（auth.pollinations.ai 创建）',
      help: 'https://auth.pollinations.ai',
      hint: '登录 auth.pollinations.ai → 创建 API Key → 仪表盘充值（支持支付宝，最低约 ¥10）',
    },
    // 模型 ID 来自 pollinations.ai 官方价格页：
    // https://enter.pollinations.ai/pricing  ·  按 pollen 计费
    // Quest 🌱 = 完成任务免费拿 pollen；付费模型按 0.0001~0.1 pollen/张
    // supportsI2I: 模型是否支持图生图（gen.pollinations.ai v1/images/generations 接 image 字段）
    models: [
      // 免费 / Quest 档
      { id: 'nova-canvas',          name: 'Nova Canvas (Quest)',  icon: '🌱', desc: 'AWS Nova · Quest 免费·基础',    supportsI2I: true },
      { id: 'kontekst',             name: 'FLUX.1 Kontext (Quest)', icon: '🌱', desc: 'BFL Kontext · Quest 免费·编辑', supportsI2I: true },
      // 极便宜档（适合频繁预览）
      { id: 'sana',                 name: 'Sana Sprint 1.6B',      icon: '💸', desc: '0.0001 pollen·几乎免费',        supportsI2I: false },
      { id: 'zimage',               name: 'Z-Image Turbo',         icon: '⚡', desc: '0.002 pollen·极速',             supportsI2I: false },
      // 性价比档
      { id: 'gptimage',             name: 'GPT Image 1 Mini',      icon: '🎨', desc: 'OpenAI·轻量',                  supportsI2I: true },
      { id: 'seedream-pro',         name: 'Seedream 4.5 Pro',      icon: '🌱', desc: '字节·0.04 pollen·性价比',      supportsI2I: true },
      { id: 'ideogram-v4-quality',  name: 'Ideogram 4.0 Quality',  icon: '🅰', desc: 'Ideogram·文字渲染强',          supportsI2I: true },
      // 旗舰档
      { id: 'seedream5-pro',        name: 'Seedream 5.0 Pro',      icon: '🌿', desc: '字节最新·0.09 pollen·中文强',  supportsI2I: true },
      { id: 'nanobanana-2',         name: 'NanoBanana 2',          icon: '🍌', desc: '谷歌 Gemini 3.1 Flash·快',     supportsI2I: true },
      { id: 'nanobanana-pro',       name: 'NanoBanana Pro',        icon: '🍌', desc: '谷歌 Gemini 3 Pro·顶配（推荐）', supportsI2I: true },
      { id: 'flux',                 name: 'Flux',                  icon: 'F',  desc: '经典 Flux · 0.002 pollen',     supportsI2I: true },
    ],
    // Pollinations 通过 gen.pollinations.ai 走图生图，data URL 在 image 字段
    // （前端会预先把图压缩到 512px JPEG ~80KB，避免 body 超限）
    supportsI2I: true,
  },

  apimart: {
    id: 'apimart',
    name: 'APIMart',
    badge: '高性价比',
    desc: '500+ 模型 · 官方 20% 折扣 · 支付宝（Antom）· gpt-image-2 仅 $0.0085',
    needsKey: true,
    credential: {
      storageKey: 'apimart_key',
      header: 'X-APIMart-Key',
      label: 'APIMart Key',
      placeholder: '粘贴 APIMart API Key（api.apimart.ai 控制台获取）',
      help: 'https://api.apimart.ai',
      hint: '注册 api.apimart.ai → 控制台创建 Key → 支付宝/微信充值（¥10 起）。全部模型官方 20% 折扣。',
    },
    // 10 个核心生图模型（按价格排序）
    models: [
      { id: 'gpt-image-2-ext',       name: 'GPT Image 2',          icon: 'G',  desc: 'OpenAI · $0.0085 · 推荐',      supportsI2I: true },
      { id: 'z-image-turbo',         name: 'Z-Image Turbo',        icon: 'Z',  desc: '智谱 · $0.01 · 极速',          supportsI2I: false },
      { id: 'grok-imagine-1.5-ext',  name: 'Grok Imagine 1.5',     icon: 'X',  desc: 'xAI · $0.015 · 自然语言编辑',  supportsI2I: true },
      { id: 'flux-kontext-pro',      name: 'FLUX Kontext Pro',     icon: 'K',  desc: 'BFL · $0.02 · 局部编辑',       supportsI2I: true },
      { id: 'qwen-image-2.0',        name: 'Qwen Image 2.0',       icon: 'Q',  desc: '阿里 · $0.02 · 国风',          supportsI2I: true },
      { id: 'flux-2-pro',            name: 'FLUX 2 Pro',           icon: 'F',  desc: 'BFL · $0.025 · 顶级画质',      supportsI2I: true },
      { id: 'nano-banana-2-ext',     name: 'Nano Banana 2',        icon: '🍌', desc: '谷歌 Flash · $0.03 · 快',     supportsI2I: true },
      { id: 'doubao-seedream-5-0-pro', name: 'Seedream 5.0 Pro',   icon: 'S',  desc: '字节 · $0.036 · 中文强',       supportsI2I: true },
      { id: 'nano-banana-pro-ext',   name: 'Nano Banana Pro',      icon: '🍌', desc: '谷歌顶配 · $0.04 · 推荐',    supportsI2I: true },
      { id: 'midjourney',            name: 'Midjourney',           icon: 'M',  desc: 'MJ Imagine · $0.045 · 艺术',   supportsI2I: false },
    ],
    supportsI2I: true,
    // 大部分模型支持 i2i，标记不支持的有明显说明
  },

  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    badge: '免费·无充值',
    desc: '免费推理（HF 免费 token 即可）· SDXL/SD 全开源模型 · 完全零成本',
    needsKey: true,
    credential: {
      storageKey: 'hf_key',
      header: 'X-HuggingFace-Key',
      label: 'Hugging Face Token',
      placeholder: '粘贴你的免费 HF Token（huggingface.co/settings/tokens 创建）',
      help: 'https://huggingface.co/settings/tokens',
      hint: '登录 huggingface.co → Settings → Access Tokens → New token（选 read 权限）→ 粘贴即用',
    },
    models: [
      { id: 'ByteDance/SDXL-Lightning',          name: 'SDXL Lightning', icon: '⚡', desc: '字节·4 步极速·推荐免费' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL 1.0',     icon: '🎨', desc: '高画质开源' },
      { id: 'stabilityai/stable-diffusion-2-1',  name: 'SD 2.1',         icon: '🖼', desc: '稳定基础款' },
      { id: 'runwayml/stable-diffusion-v1-5',    name: 'SD 1.5',         icon: '🧪', desc: '经典基础款' },
    ],
    supportsI2I: true, // 标记为支持，实际效果取决于模型
  },
};

// ============ 风格预设（provider 无关，通过提示词叠加） ============
const STYLES = [
  { id: '',             name: '自动',     prompt: '' },
  { id: 'realistic',    name: '写实',     prompt: 'photorealistic, hyperrealistic, 8k uhd, high detail, sharp focus' },
  { id: 'anime',        name: '动漫',     prompt: 'anime style, vibrant colors, manga art, detailed' },
  { id: 'watercolor',   name: '水彩',     prompt: 'watercolor painting, soft brush strokes, artistic' },
  { id: 'oil',          name: '油画',     prompt: 'oil painting style, visible brush strokes, textured' },
  { id: 'sketch',       name: '素描',     prompt: 'pencil sketch, hand drawn, monochrome' },
  { id: 'digital',      name: '数字艺术', prompt: 'digital art, concept art, trending on artstation' },
  { id: 'chinese',      name: '国风',     prompt: 'traditional chinese ink painting, guofeng, elegant' },
  { id: 'cyberpunk',    name: '赛博朋克', prompt: 'cyberpunk style, neon lights, futuristic, detailed' },
  { id: 'illustration', name: '插画',     prompt: 'book illustration, clean lines, colorful' },
  { id: '3d',           name: '3D 渲染',  prompt: '3d render, octane, unreal engine, cinematic lighting' },
  { id: 'pixel',        name: '像素风',   prompt: 'pixel art, retro game style, 16-bit' },
];

// ============ 画幅比例 ============
const ASPECT_RATIOS = {
  '1:1':  { w: 1024, h: 1024 },
  '16:9': { w: 1280, h: 720  },
  '9:16': { w: 720,  h: 1280 },
  '4:3':  { w: 1024, h: 768  },
  '3:4':  { w: 768,  h: 1024 },
  '3:2':  { w: 1200, h: 800  },
  '2:3':  { w: 800,  h: 1200 },
};

// ============ 分辨率档位（缩放系数） ============
const RESOLUTIONS = {
  '标清': 0.75,
  '1K 高清': 1,
  '2K 超清': 1.5,
  '4K 影院': 2,
};

const MAX_COUNT = 4;

// ============ 默认 provider（可被环境变量覆盖） ============
// 默认走 AIHubMix（统一接入·支付宝·覆盖 6 大热门生图模型）；其余引擎可运行时切换。
const DEFAULT_PROVIDER =
  (process.env.PROVIDER && PROVIDERS[process.env.PROVIDER]) ? process.env.PROVIDER : 'aihubmix';

// AIHubMix key（默认引擎）
const AIHUBMIX_KEY = process.env.AIHUBMIX_KEY || '';

// 硅基流动 key（国内·支付宝充值备用引擎）
const SILICONFLOW_KEY = process.env.SILICONFLOW_KEY || '';

// Fal.ai key（fal provider 需要）
const FAL_KEY = process.env.FAL_KEY || '';

// Pollinations 凭证：服务端（Node）调用现在需要 API Key / Token 才能解锁额度。
// 同时兼容两种命名：POLLINATIONS_API_KEY（仪表盘叫 API Key）与 POLLINATIONS_TOKEN。
const POLLINATIONS_TOKEN =
  process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_TOKEN || '';

// Hugging Face Token（免费档推理用，huggingface.co/settings/tokens 创建）
const HUGGINGFACE_KEY = process.env.HUGGINGFACE_KEY || process.env.HF_TOKEN || '';

// APIMart key
const APIMART_KEY = process.env.APIMART_KEY || '';

// ============ UI 开关（前端按需过滤） ============
// 隐藏的 tab 列表（这些 tab 按钮和面板不渲染）
const UI_FLAGS = {
  hiddenTabs: ['batch'], // 用户要求隐藏批量生图
};

/**
 * provider 是否可选（两个都始终可选，凭证在生成时按请求携带，无凭证给清晰引导）
 */
function isProviderAvailable(providerId) {
  return !!PROVIDERS[providerId];
}

/**
 * 该 provider 是否已在服务端配置好凭证（.env）——用于前端展示状态徽标
 */
function hasServerCredential(providerId) {
  if (providerId === 'aihubmix') return !!AIHUBMIX_KEY;
  if (providerId === 'siliconflow') return !!SILICONFLOW_KEY;
  if (providerId === 'fal') return !!FAL_KEY;
  if (providerId === 'pollinations') return !!POLLINATIONS_TOKEN;
  if (providerId === 'huggingface') return !!HUGGINGFACE_KEY;
  if (providerId === 'apimart') return !!APIMART_KEY;
  return false;
}

module.exports = {
  PROVIDERS,
  STYLES,
  ASPECT_RATIOS,
  RESOLUTIONS,
  MAX_COUNT,
  DEFAULT_PROVIDER,
  UI_FLAGS,
  AIHUBMIX_KEY,
  SILICONFLOW_KEY,
  FAL_KEY,
  POLLINATIONS_TOKEN,
  HUGGINGFACE_KEY,
  APIMART_KEY,
  isProviderAvailable,
  hasServerCredential,
};
