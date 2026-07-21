/**
 * Provider 注册表 —— 管理当前活跃 provider，支持运行时切换。
 */
const {
  PROVIDERS,
  STYLES,
  ASPECT_RATIOS,
  RESOLUTIONS,
  MAX_COUNT,
  DEFAULT_PROVIDER,
  UI_FLAGS,
  isProviderAvailable,
  hasServerCredential,
} = require('../config');
const { PollinationsProvider } = require('./pollinations');
const { FalProvider } = require('./fal');
const { SiliconFlowProvider } = require('./siliconflow');
const { AIHubMixProvider } = require('./aihubmix');
const { HuggingFaceProvider } = require('./huggingface');
const { APIMartProvider } = require('./apimart');

const instances = {};

function getProvider(providerId) {
  if (instances[providerId]) return instances[providerId];

  let instance;
  switch (providerId) {
    case 'aihubmix':
      instance = new AIHubMixProvider();
      break;
    case 'siliconflow':
      instance = new SiliconFlowProvider();
      break;
    case 'pollinations':
      instance = new PollinationsProvider();
      break;
    case 'fal':
      instance = new FalProvider();
      break;
    case 'huggingface':
      instance = new HuggingFaceProvider();
      break;
    case 'apimart':
      instance = new APIMartProvider();
      break;
    default:
      throw new Error(`未知 provider: ${providerId}`);
  }
  instances[providerId] = instance;
  return instance;
}

/**
 * 列出所有 provider 及其可用状态（供前端渲染切换器）
 */
function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    badge: p.badge,
    desc: p.desc,
    needsKey: p.needsKey,
    hidden: !!p.hidden, // 前端用 hidden 过滤不显示入口
    available: isProviderAvailable(p.id),
    // 服务端 .env 是否已配置凭证（前端据此显示"已配置"状态）
    hasServerKey: hasServerCredential(p.id),
    // 凭证描述符：前端据此渲染"粘贴 Key/Token"输入行
    credential: p.credential || null,
    models: p.models,
    supportsI2I: p.supportsI2I,
  }));
}

/**
 * 解析 provider：优先用户指定的，否则用默认（aihubmix）。
 * 凭证不足不影响选择——生成时若缺凭证会返回清晰引导错误。
 */
function resolveProvider(requestedId) {
  if (requestedId && PROVIDERS[requestedId]) {
    return requestedId;
  }
  if (PROVIDERS[DEFAULT_PROVIDER]) {
    return DEFAULT_PROVIDER;
  }
  return Object.keys(PROVIDERS)[0];
}

module.exports = {
  getProvider,
  listProviders,
  resolveProvider,
  // 透传共享配置
  STYLES,
  ASPECT_RATIOS,
  RESOLUTIONS,
  MAX_COUNT,
  UI_FLAGS,
};
