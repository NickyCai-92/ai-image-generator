// ============ State ============
const state = {
  config: null,
  providers: [],
  activeProvider: 'aihubmix',
  uiFlags: { hiddenTabs: [] },
  selected: {
    tab: 't2i',
    model: 'gemini-3-pro-image-preview',
    style: '',
    aspectRatio: '1:1',
    resolution: '1K 高清',
    count: 1,
  },
  uploadedImage: null, // { dataUrl, name }
  studioImages: [],     // [{ dataUrl, name }] — 创意工坊多图
  studioScene: 'edit',  // 当前选中的场景模板
  isGenerating: false,
  // 每个 provider 的凭证按各自 storageKey 存本地（fal_key / poll_token）
};

// 可见 provider 列表（过滤掉 hidden: true 的）
function visibleProviders() {
  return state.providers.filter((p) => !p.hidden);
}

// 读取某 provider 的本地凭证
function getCred(provider) {
  const cred = provider && provider.credential;
  if (!cred) return '';
  return localStorage.getItem(cred.storageKey) || '';
}
function setCred(provider, value) {
  const cred = provider && provider.credential;
  if (!cred) return;
  if (value) localStorage.setItem(cred.storageKey, value);
  else localStorage.removeItem(cred.storageKey);
}
function activeProviderInfo() {
  return visibleProviders().find((p) => p.id === state.activeProvider)
      || state.providers.find((p) => p.id === state.activeProvider)
      || null;
}

// ============ DOM ============
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ============ 初始化 ============
async function init() {
  await loadConfig();
  applyHiddenTabs();
  buildProviderSwitcher();
  setupCredentialUI();
  buildDropdowns();
  bindEvents();
  syncPillsFromState();
  updateI2IAvailability();
  updateFooterProvider();
  _setGenState('placeholder'); // 初始显示占位
  initScrollReveal(); // 滚动渐入
  initStudio(); // 创意工坊
  loadShowcase(); // Showcase 作品墙
}

// ============ 滚动渐入（IntersectionObserver） ============
function initScrollReveal() {
  // 模板卡 + FAQ 项自动加 class（也可手动加 .fade-on-scroll）
  document.querySelectorAll('.template-card, .faq-item, .provider-btn').forEach((el, i) => {
    el.classList.add('fade-on-scroll');
    el.style.transitionDelay = `${Math.min(i * 60, 480)}ms`;
  });
  if (!('IntersectionObserver' in window)) {
    // 降级：直接显示
    document.querySelectorAll('.fade-on-scroll').forEach((el) => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.fade-on-scroll').forEach((el) => io.observe(el));
}

// ============ 加载后端配置 ============
async function loadConfig(providerId) {
  // 早失败：file:// 协议下 fetch 同源 API 会被浏览器拒绝，直接告诉用户访问 http://localhost:3000
  if (location.protocol === 'file:') {
    const errUrl = 'http://localhost:3000';
    _setGenState('error');
    $('#errorText').innerHTML = `检测到本地文件访问（<code>file://</code>）——无法连接 API。<br><br>👉 请关闭此页，访问 <a href="${errUrl}" style="color:var(--accent);text-decoration:underline;font-weight:600;">${errUrl}</a>`;
    showToast(`请用 ${errUrl} 打开页面（不是 file://）`, 'error', 10000);
    // 注入最简兜底 config，防止下游 buildDropdowns 报 null destructure
    state.config = {
      models: [],
      styles: [],
      aspectRatios: [],
      resolutions: [],
      maxCount: 1,
      supportsI2I: false,
    };
    return;
  }
  const url = providerId ? `/api/config/${providerId}` : `/api/config?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text) throw new Error('空响应');
    state.config = JSON.parse(text);
    if (!state.config.models || !state.config.providers) throw new Error('响应缺少 models/providers');
    state.providers = state.config.providers;
    state.activeProvider = state.config.activeProvider || state.activeProvider;
    state.uiFlags = state.config.uiFlags || state.uiFlags || { hiddenTabs: [] };
    // 同步默认模型
    if (state.config.models.length) {
      state.selected.model = state.config.models[0].id;
    }
  } catch (err) {
    console.error('[loadConfig] 加载配置失败:', err.message);
    // 仅在第一次初始化时兜底；切换 provider 失败则保留旧状态
    if (!state.config || !state.config.models || state.config.models.length <= 1) {
      console.error('[loadConfig] 后端 /api/config 无法返回完整配置 — 请检查服务是否运行在 :3000');
      _setGenState('error');
      $('#errorText').textContent = `无法连接服务（${err.message}）。请检查 server.js 是否在 :3000 运行，然后 Ctrl+Shift+R 强制刷新。`;
    }
  }
}

// ============ 隐藏 UI Flags 指定的 tab（按需过滤） ============
function applyHiddenTabs() {
  const hidden = (state.uiFlags && state.uiFlags.hiddenTabs) || [];
  if (!hidden.length) return;
  hidden.forEach((tabId) => {
    const tabBtn = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.style.display = 'none';
    const tabPanel = document.querySelector(`.tab-content[data-content="${tabId}"]`);
    if (tabPanel) tabPanel.style.display = 'none';
  });
  // 如果当前选中的 tab 被隐藏，切回 t2i
  if (hidden.includes(state.selected.tab)) {
    state.selected.tab = 't2i';
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 't2i'));
    $$('.tab-content').forEach((c) => c.classList.toggle('active', c.dataset.content === 't2i'));
  }
}

// ============ Provider 切换器（按 hidden 过滤） ============
function buildProviderSwitcher() {
  const wrap = $('#providerSwitcher');
  if (!wrap) return;
  wrap.innerHTML = '';

  visibleProviders().forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'provider-btn';
    btn.dataset.provider = p.id;
    btn.disabled = !p.available;
    btn.innerHTML = `
      <span class="provider-btn-name">${p.name}</span>
      <span class="provider-btn-badge">${p.badge}</span>
      ${!p.available ? '<span class="provider-btn-hint">需 Key</span>' : ''}
    `;
    if (p.id === state.activeProvider) btn.classList.add('active');
    if (!p.available) btn.title = `${p.name} 暂不可用：需要 API Key`;
    btn.addEventListener('click', () => {
      if (!p.available || p.id === state.activeProvider) return;
      switchProvider(p.id);
    });
    wrap.appendChild(btn);
  });
}

async function switchProvider(providerId) {
  // 切换前清空结果
  hideAll();
  await loadConfig(providerId);
  buildProviderSwitcher();
  setupCredentialUI();
  buildDropdowns();
  syncPillsFromState();
  updateI2IAvailability();
  updateFooterProvider();
}

// ============ 通用凭证管理（Fal → API Key / Pollinations → Token） ============
function setupCredentialUI() {
  const row = $('#credRow');
  const input = $('#credInput');
  const help = $('#credHelp');
  if (!row) return;

  const info = activeProviderInfo();
  const cred = info && info.credential;
  // 无凭证描述符（理论上不会）则隐藏
  if (!cred) {
    row.classList.add('hidden');
    return;
  }

  row.classList.remove('hidden');
  input.placeholder = cred.placeholder || '';
  input.value = getCred(info);
  if (help) {
    help.href = cred.help || '#';
    help.textContent = info.id === 'pollinations' ? '获取 Token ↗' : '获取 API Key ↗';
  }
  updateCredStatus();
}

function updateCredStatus() {
  const status = $('#credStatus');
  if (!status) return;
  const info = activeProviderInfo();
  const val = getCred(info);
  const label = info && info.id === 'pollinations' ? 'Token' : 'API Key';
  if (val) {
    status.textContent = `✅ 已配置`;
    status.className = 'token-status ok';
  } else if (info && info.hasServerKey) {
    status.textContent = `✅ 已用 .env 凭证`;
    status.className = 'token-status ok';
  } else {
    status.textContent = `⚠️ 未配置 ${label}，无法生成`;
    status.className = 'token-status warn';
  }
}

function bindCredentialSave() {
  const input = $('#credInput');
  const saveBtn = $('#credSaveBtn');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';

  const doSave = () => {
    const v = input.value.trim();
    setCred(activeProviderInfo(), v);
    updateCredStatus();
  };
  saveBtn.addEventListener('click', doSave);
  input.addEventListener('change', doSave);
  input.addEventListener('blur', doSave);
}

function updateFooterProvider() {
  const active = activeProviderInfo();
  if (active) {
    $('#footerProvider').textContent = `Powered by ${active.name}`;
  }
}

// ============ 图生图可用性 ============
// provider 层面 + 模型层面 双重检查
function updateI2IAvailability() {
  const i2iTab = document.querySelector('.tab[data-tab="i2i"]');
  const supports = state.config.supportsI2I;
  if (supports) {
    i2iTab.classList.remove('disabled');
    i2iTab.title = '';
  } else {
    i2iTab.classList.add('disabled');
    i2iTab.title = '当前 Provider 不支持图生图，请切换到 AIHubMix / Pollinations / Fal.ai 等支持图生图的引擎';
    if (state.selected.tab === 'i2i') {
      switchTab('t2i');
    }
  }
}

/**
 * 当前所选模型是否支持 i2i（用于点击生成时拦截 + 切换 model 时提示）
 */
function currentModelSupportsI2I() {
  if (!state.config.supportsI2I) return false;
  const m = (state.config.models || []).find((x) => x.id === state.selected.model);
  return !m || m.supportsI2I !== false; // 默认 true（除非显式 false）
}

// ============ 构建下拉菜单 ============
function buildDropdowns() {
  const { models, styles, aspectRatios, resolutions, maxCount } = state.config;

  // 模型
  fillDropdown('model', models.map((m) => ({
    value: m.id,
    label: m.name,
    icon: m.icon,
    desc: m.desc,
  })));
  setSelected('model', state.selected.model);

  // 风格
  fillDropdown('style', styles.map((s) => ({
    value: s.id,
    label: s.name,
    icon: s.id ? '🎨' : '🚫',
  })));
  setSelected('style', state.selected.style);

  // 比例
  fillDropdown('ratio', aspectRatios.map((r) => ({
    value: r,
    label: r,
    icon: ratioIcon(r),
  })));
  setSelected('ratio', state.selected.aspectRatio);

  // 分辨率
  fillDropdown('resolution', resolutions.map((r) => ({
    value: r,
    label: r,
    icon: '📐',
  })));
  setSelected('resolution', state.selected.resolution);

  // 数量
  const counts = Array.from({ length: maxCount }, (_, i) => ({
    value: i + 1,
    label: `${i + 1} 张`,
    icon: '🗂',
  }));
  fillDropdown('count', counts);
  setSelected('count', state.selected.count);
}

function ratioIcon(r) {
  const map = {
    '1:1': '⬜', '16:9': '▭', '9:16': '▯',
    '4:3': '▭', '3:4': '▯', '3:2': '▭', '2:3': '▯',
  };
  return map[r] || '⬜';
}

function fillDropdown(key, items) {
  const menu = document.querySelector(`[data-dropdown="${key}"] .dropdown-menu`);
  if (!menu) return;
  menu.innerHTML = '';
  items.forEach((it) => {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.dataset.value = it.value;
    el.innerHTML = `
      <span class="menu-icon">${it.icon || ''}</span>
      <span class="menu-label">${it.label}</span>
      ${it.desc ? `<span class="menu-desc">${it.desc}</span>` : ''}
    `;
    el.addEventListener('click', () => {
      selectOption(key, it.value, it.label, it.icon);
      closeAllDropdowns();
    });
    menu.appendChild(el);
  });
}

function setSelected(key, value) {
  const menu = document.querySelector(`[data-dropdown="${key}"] .dropdown-menu`);
  if (!menu) return;
  menu.querySelectorAll('.menu-item').forEach((el) => {
    el.classList.toggle('selected', String(el.dataset.value) === String(value));
  });
}

function selectOption(key, value, label, icon) {
  const stateMap = {
    model: 'model',
    style: 'style',
    ratio: 'aspectRatio',
    resolution: 'resolution',
    count: 'count',
  };
  state.selected[stateMap[key]] = value;

  const pill = document.querySelector(`[data-dropdown="${key}"] .pill`);
  pill.querySelector('.pill-label').textContent = label;
  if (key === 'model' && icon) {
    pill.querySelector('.pill-icon').textContent = icon;
  }
  setSelected(key, value);
}

function syncPillsFromState() {
  const { config, selected } = state;
  if (!config) return;
  const model = config.models.find((m) => m.id === selected.model) || config.models[0];
  if (model) {
    state.selected.model = model.id;
    const pill = document.querySelector('[data-dropdown="model"] .pill');
    pill.querySelector('[data-pill-icon]').textContent = model.icon;
    pill.querySelector('.pill-label').textContent = model.name;
    setSelected('model', model.id);
  }
  const styleObj = config.styles.find((s) => s.id === selected.style) || config.styles[0];
  selectOption('style', styleObj.id, styleObj.name);
  selectOption('ratio', selected.aspectRatio, selected.aspectRatio, ratioIcon(selected.aspectRatio));
  selectOption('resolution', selected.resolution, selected.resolution);
  selectOption('count', selected.count, `${selected.count} 张`);
}

// ============ 事件绑定 ============
function bindEvents() {
  // Tabs
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('disabled')) return;
      switchTab(tab.dataset.tab);
    });
  });

  // 下拉开关
  $$('.dropdown').forEach((dd) => {
    const trigger = dd.querySelector('.pill');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', closeAllDropdowns);

  // 生成按钮
  $('#generateBtn').addEventListener('click', generate);

  // 凭证保存
  bindCredentialSave();

  // 更多按钮（占位）
  $('#moreBtn').addEventListener('click', () => {
    showToast('更多设置：负面提示词、Seed、CFG 等（占位，待实现）', 'info', 3500);
  });

  // 图片上传
  setupUpload();

  // 提示词 Ctrl/Cmd+Enter 触发生成
  $$('[data-prompt]').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generate();
      }
    });
  });

  // 全局快捷键：Ctrl/Cmd+. 切换 provider；Esc 关闭所有下拉
  document.addEventListener('keydown', (e) => {
    // Esc 关闭下拉 / 取消生成
    if (e.key === 'Escape') {
      const open = document.querySelector('.dropdown.open');
      if (open) {
        open.classList.remove('open');
        e.preventDefault();
        return;
      }
      if (state.isGenerating) {
        $('#genProgressCancel')?.click();
        e.preventDefault();
      }
    }
    // Ctrl/Cmd + . 切换 provider
    if ((e.ctrlKey || e.metaKey) && e.key === '.') {
      e.preventDefault();
      const visible = visibleProviders();
      if (!visible.length) return;
      const idx = visible.findIndex((p) => p.id === state.activeProvider);
      const next = visible[(idx + 1) % visible.length];
      switchProvider(next.id);
      showToast(`已切换到 ${next.name}`, 'info', 2000);
    }
  });
}

function switchTab(tabName) {
  state.selected.tab = tabName;
  // 同步 ARIA：aria-selected + tabindex + hidden
  $$('.tab').forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    t.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  $$('.tab-content').forEach((c) => {
    const isActive = c.dataset.content === tabName;
    c.classList.toggle('active', isActive);
    if (isActive) c.removeAttribute('hidden');
    else c.setAttribute('hidden', '');
  });

  // 切到图生图时，强制 count=1
  if (tabName === 'i2i') {
    state.selected.count = 1;
    setSelected('count', 1);
    const pill = document.querySelector('[data-dropdown="count"] .pill .pill-label');
    if (pill) pill.textContent = '1 张';
  }
  // 切到创意工坊时，隐身素下拉选中模型，count=1
  if (tabName === 'studio') {
    state.selected.count = 1;
    const countPill = document.querySelector('[data-dropdown="count"] .pill .pill-label');
    if (countPill) countPill.textContent = '1 张';
  }
}

// ============ 创意工坊：场景模板 ============
const STUDIO_SCENES = {
  edit: {
    prompt: 'Make the following changes to this image, exactly as described: {prompt}. Keep everything else — pose, lighting, background, and all other objects — completely identical. Do not add or remove anything else.',
    label: '局部编辑',
    hint: '在图生图 tab 的基础上，写更精准的编辑指令',
  },
  outfit: {
    prompt: 'Put the outfit from image 1 onto the person in image 2. Keep the face, hairstyle, pose, and background of image 2 identical. Do not change image 2\'s body shape.',
    label: '换装',
    need: 2,
  },
  fusion: {
    prompt: 'Fuse image 1 and image 2 into one image. Blend the key elements from image 1 into image 2 naturally, keeping a cohesive style and lighting.',
    label: '融合',
    need: 2,
  },
  bg: {
    prompt: 'Replace the background of this image with a new scene: {prompt}. Keep the subject exactly the same — same face, clothes, pose, and lighting on the subject. Only the background should change.',
    label: '换背景',
    need: 1,
  },
};

function initStudio() {
  // 场景模板按键绑定
  document.querySelectorAll('.studio-scene').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.studio-scene').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.studioScene = btn.dataset.scene;
      applyStudioPrompt();
    });
  });
  // 多图上传
  const addBtn = $('#studioAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (state.studioImages.length >= 4) { showToast('最多 4 张', 'warning', 2000); return; }
      $('#studioFileInput').click();
    });
  }
  $('#studioFileInput').addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = 4 - state.studioImages.length;
    files.slice(0, remaining).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.studioImages.push({ dataUrl: ev.target.result, name: f.name });
        renderStudioImages();
        updateStudioCount();
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  });
  // 初始状态
  updateStudioCount();
}

function applyStudioPrompt() {
  const scene = STUDIO_SCENES[state.studioScene];
  if (!scene) return;
  const promptEl = document.querySelector('#prompt-studio');
  if (!promptEl) return;
  promptEl.placeholder = scene.hint || '';
  // 只有局部编辑/换背景需要手动填 prompt（因为只有 1 张图），换装/融合自动填
  if (scene.need >= 2) {
    promptEl.value = scene.prompt;
    promptEl.readOnly = false;
  } else {
    promptEl.value = '';
    promptEl.readOnly = false;
    promptEl.focus();
  }
}

function renderStudioImages() {
  const container = $('#studioImages');
  if (!container) return;
  const addBtn = $('#studioAddBtn');
  container.innerHTML = '';
  state.studioImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'studio-image-preview';
    div.innerHTML = `<img src="${img.dataUrl}" alt="参考图 ${i + 1}"><button class="studio-image-remove" aria-label="移除参考图 ${i + 1}">×</button>`;
    div.querySelector('.studio-image-remove').addEventListener('click', () => {
      state.studioImages.splice(i, 1);
      renderStudioImages();
      updateStudioCount();
    });
    container.appendChild(div);
  });
  container.appendChild(addBtn);
}

function updateStudioCount() {
  const el = $('#studioCount');
  if (el) el.textContent = `${state.studioImages.length} / 4`;
}

function closeAllDropdowns() {
  $$('.dropdown').forEach((d) => d.classList.remove('open'));
}

// ============ 图片上传 ============
function setupUpload() {
  const area = $('#uploadArea');
  const fileInput = $('#fileInput');
  const removeBtn = $('#removeImage');

  area.addEventListener('click', (e) => {
    if (e.target.closest('.remove-image')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  });

  document.addEventListener('paste', (e) => {
    if (state.selected.tab !== 'i2i') return;
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) handleFile(f);
        break;
      }
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });
}

function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showError('图片过大，请控制在 10MB 以内');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.uploadedImage = { dataUrl: e.target.result, name: file.name };
    $('#previewImg').src = e.target.result;
    $('#uploadEmpty').classList.add('hidden');
    $('#uploadPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  state.uploadedImage = null;
  $('#fileInput').value = '';
  $('#uploadPreview').classList.add('hidden');
  $('#uploadEmpty').classList.remove('hidden');
  $('#previewImg').src = '';
}

/**
 * 压缩图片为 512px JPEG（dataURL）——给 i2i 接口减小 body 体积
 * 输入原图（PNG ~1MB），输出 ~80KB
 */
function compressImageForI2I(dataUrl, maxSize = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      let w = w0, h = h0;
      if (Math.max(w, h) > maxSize) {
        if (w >= h) { h = Math.round(h * (maxSize / w)); w = maxSize; }
        else       { w = Math.round(w * (maxSize / h)); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      console.log(`[i2i] 压缩图: ${w0}×${h0} → ${w}×${h}, ${Math.round(dataUrl.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('图片解析失败（请换一张）'));
    img.src = dataUrl;
  });
}

// ============ 生成图片 ============
async function generate() {
  const tab = state.selected.tab;
  const promptInput = document.querySelector(`.tab-content.active [data-prompt]`);
  const prompt = promptInput?.value.trim();

  if (!prompt) {
    showError('请输入提示词');
    promptInput?.focus();
    return;
  }
  if (tab === 'i2i' && !state.uploadedImage) {
    showError('请先上传一张图片');
    return;
  }
  if (tab === 'i2i' && !currentModelSupportsI2I()) {
    const m = (state.config.models || []).find((x) => x.id === state.selected.model);
    showError(`当前模型「${m?.name || state.selected.model}」不支持图生图`, '请在模型下拉中切换到支持 i2i 的模型（如 Flux、NanoBanana、Seedream 5.0 Pro 等）');
    return;
  }

  hideAll();
  setLoading(true);

  try {
    const payload = {
      prompt,
      model: state.selected.model,
      style: state.selected.style,
      aspectRatio: state.selected.aspectRatio,
      resolution: state.selected.resolution,
    };

    let endpoint = '/api/generate';
    if (tab === 'i2i') {
      endpoint = '/api/i2i';
      payload.image = await compressImageForI2I(state.uploadedImage.dataUrl);
    } else if (tab === 'studio') {
      // 创意工坊：走 i2i 接口，传多张图
      if (!state.studioImages.length) { showError('请先添加至少 1 张参考图'); return; }
      endpoint = '/api/i2i';
      // 应用场景模板 prompt
      const scene = STUDIO_SCENES[state.studioScene] || {};
      if (scene.prompt) {
        payload.prompt = scene.prompt.replace('{prompt}', prompt);
      }
      // 传第一张图（局部编辑/换背景），多图场景暂由后端处理
      payload.image = await compressImageForI2I(state.studioImages[0].dataUrl);
      // 多图时把额外图片也传过去
      if (state.studioImages.length > 1) {
        const extra = [];
        for (let i = 1; i < state.studioImages.length; i++) {
          extra.push(await compressImageForI2I(state.studioImages[i].dataUrl));
        }
        payload.images = extra;
        payload.scene = state.studioScene;
      }
    } else if (tab === 'batch') {
      payload.count = state.selected.count;
    } else {
      payload.count = 1;
    }

    // 组装凭证请求头：按当前 provider 的 credential.header 发送本地保存的 Key/Token
    const headers = {
      'Content-Type': 'application/json',
      'X-Provider': state.activeProvider,
    };
    const info = activeProviderInfo();
    const cred = info && info.credential;
    const credVal = getCred(info);
    if (cred && credVal) {
      headers[cred.header] = credVal;
    }

    // 允许取消按钮中止请求
    _progressAbort = new AbortController();
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: _progressAbort.signal,
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        // 取消：静默回到占位
        return;
      }
      throw fetchErr;
    }
    _progressAbort = null;
    const data = await res.json();

    if (!res.ok) {
      // 如果是 provider 不支持 i2i 的提示，引导切换
      if (data.hint === 'switch_provider') {
        showError(data.error, '请在顶部切换到支持图生图的引擎（如 AIHubMix / Fal.ai）后再使用');
      } else {
        showError(data.error || '生成失败', data.details);
      }
      return;
    }

    if (data.failed && data.failed.length) {
      console.warn('部分失败:', data.failed);
    }
    showResult(data.images, data.prompt, data.model, data.provider);
    // 自动保存第一张到 Showcase（异步，不阻塞）
    if (data.images && data.images[0]) {
      saveToShowcase(data.images[0], data.prompt, data.model, data.provider);
    }
  } catch (err) {
    showError(`网络错误：${err.message}`);
  } finally {
    setLoading(false);
  }
}

// ============ Gen Slot 状态机（占位 / 进度 / 结果 / 错误） ============
const $genSlot        = () => document.getElementById('genSlot');
const $genPlaceholder = () => document.getElementById('genPlaceholder');
const $genProgress    = () => document.getElementById('genProgress');
const $genProgressFill    = () => document.getElementById('genProgressFill');
const $genProgressStages  = () => document.getElementById('genProgressStages');
const $genProgressTitle   = () => document.getElementById('genProgressTitle');
const $genProgressTimer   = () => document.getElementById('genProgressTimer');
const $genProgressEstimate= () => document.getElementById('genProgressEstimate');
const $genProgressStage   = () => document.getElementById('genProgressStage');
const $genProgressCancel  = () => document.getElementById('genProgressCancel');

let _genState = 'placeholder';
let _progressTimer = null;
let _progressStart = 0;
let _progressAbort = null;
let _progressStage = 'prepare';
const STAGE_ORDER = ['prepare', 'submit', 'generating', 'finalize'];
const STAGE_LABEL = { prepare: '准备提示词', submit: '提交到 AIHubMix', generating: '模型生成中', finalize: '处理输出' };

function _setGenState(state) {
  _genState = state;
  const ph = $genPlaceholder(), pg = $genProgress();
  const ra = $('#resultArea'), ea = $('#errorArea');
  ph.classList.toggle('hidden', state !== 'placeholder');
  pg.classList.toggle('hidden', state !== 'progress');
  ra.classList.toggle('hidden', state !== 'result');
  ea.classList.toggle('hidden', state !== 'error');
  const slot = $genSlot();
  if (slot) {
    slot.classList.toggle('is-progress', state === 'progress');
    slot.classList.toggle('is-empty', state === 'placeholder');
  }
}

function _setProgressStage(stage) {
  _progressStage = stage;
  const idx = STAGE_ORDER.indexOf(stage);
  const nodes = $genProgressStages()?.querySelectorAll('.gen-stage') || [];
  nodes.forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < idx) el.classList.add('done');
    else if (i === idx) el.classList.add('active');
  });
  const lbl = $genProgressStage();
  if (lbl) lbl.textContent = STAGE_LABEL[stage] || stage;
}

function _setProgress(pct) {
  const fill = $genProgressFill();
  if (fill) fill.style.width = `${Math.max(2, Math.min(100, pct))}%`;
}

function _fmtElapsed(sec) {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m} 分 ${s} 秒`;
}

function _startProgress({ providerName, estimateSec }) {
  _stopProgress();
  _progressStart = Date.now();
  _setProgress(2);
  _setProgressStage('prepare');
  if ($genProgressTitle()) $genProgressTitle().textContent = `正在通过 ${providerName || 'AI'} 生成图片`;
  if ($genProgressEstimate()) $genProgressEstimate().textContent = `预计 ${estimateSec || 30} 秒`;
  // 阶段推进
  setTimeout(() => { if (_genState === 'progress') _setProgressStage('submit'); }, 500);
  setTimeout(() => { if (_genState === 'progress') _setProgressStage('generating'); }, 2000);
  // 进度条自动推进（sigmoid 平滑）
  const _tick = () => {
    const elapsed = Math.floor((Date.now() - _progressStart) / 1000);
    const tm = $genProgressTimer();
    if (tm) tm.textContent = `已用 ${_fmtElapsed(elapsed)}`;
    if (_progressStage === 'finalize') return;
    if (elapsed <= 2) {
      _setProgress(2 + (elapsed / 2) * 16);
    } else {
      const sinceGen = elapsed - 2;
      const target = Math.min(92, 18 + (1 - Math.exp(-sinceGen / 25)) * 70);
      _setProgress(target);
    }
  };
  _tick();
  _progressTimer = setInterval(_tick, 500);
}

function _stopProgress() {
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
}

function _finishProgress() {
  _setProgressStage('finalize');
  _setProgress(100);
  _stopProgress();
}

function _cancelProgress() {
  if (_progressAbort) { try { _progressAbort.abort(); } catch (_) {} }
}

function bindCancelButton() {
  const btn = $genProgressCancel();
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = '取消中...';
    _cancelProgress();
    setTimeout(() => {
      state.isGenerating = false;
      const gb = $('#generateBtn');
      if (gb) gb.disabled = false;
      _stopProgress();
      _setGenState('placeholder');
      btn.disabled = false;
      btn.textContent = '✕ 取消';
    }, 1500);
  });
}

function showError(msg, details) {
  _stopProgress();
  $('#errorText').textContent = details ? `${msg}（${details}）` : msg;
  _setGenState('error');
  // 错误抖动反馈（主卡轻微左右摇晃）
  const card = document.querySelector('.card');
  if (card) {
    card.classList.remove('shake');
    // 强制 reflow 以重启动画
    void card.offsetWidth;
    card.classList.add('shake');
  }
  // 错误自动聚焦到错误区，让读屏立即播报
  setTimeout(() => $('#errorArea')?.focus?.(), 100);
  // 同时用 toast 弹出（更明显）
  showToast(msg, 'error', 5000);
}

function showStatus(text) {
  if ($genProgressTitle() && text) $genProgressTitle().textContent = text;
}

/**
 * Toast 轻提示（取代 alert）
 * @param {string} msg
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration ms，0 = 不自动消失
 */
function showToast(msg, type = 'info', duration = 3500) {
  const container = $('#toastContainer');
  if (!container) { console.warn('[toast]', msg); return; }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent = msg;
  container.appendChild(t);
  if (duration > 0) {
    setTimeout(() => {
      t.classList.add('toast-out');
      setTimeout(() => t.remove(), 220);
    }, duration);
  }
  return t;
}

function showResult(images, prompt, model, provider) {
  _finishProgress();
  _setGenState('result');
  $('#resultMeta').textContent = `${model} · 共 ${images.length} 张`;

  const badge = $('#resultProviderBadge');
  const pInfo = state.providers.find((p) => p.id === provider);
  if (pInfo) {
    badge.textContent = `${pInfo.name} · ${pInfo.badge}`;
    badge.className = `provider-badge provider-badge-${provider}`;
  }

  const grid = $('#resultGrid');
  grid.innerHTML = '';
  grid.className = `result-grid count-${images.length}`;

  images.forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <img src="${src}" alt="生成图片 ${idx + 1}" />
      <div class="result-actions">
        <button class="result-action" data-act="download" title="下载">⬇</button>
        <button class="result-action" data-act="open" title="在新窗口打开">↗</button>
      </div>
    `;
    item.querySelector('[data-act="download"]').addEventListener('click', (e) => {
      e.stopPropagation();
      downloadImage(src, `${model.replace(/\//g, '-')}-${Date.now()}-${idx + 1}.png`);
    });
    item.querySelector('[data-act="open"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openInWindow(src);
    });
    grid.appendChild(item);
  });
  setTimeout(() => {
    $('#resultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function hideAll() {
  _stopProgress();
  _setGenState('placeholder');
}

function setLoading(loading) {
  state.isGenerating = loading;
  const btn = $('#generateBtn');
  btn.disabled = loading;
  if (loading) {
    const providerName = state.providers.find((p) => p.id === state.activeProvider)?.name || 'AI';
    _setGenState('progress');
    _startProgress({ providerName, estimateSec: 30 });
    bindCancelButton();
  } else {
    if (_genState === 'progress') _stopProgress();
  }
}

function downloadImage(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * 在新窗口打开图片。
 * dataURL 太长时（>几 MB）直接 window.open 在多数浏览器会被截断为 about:blank，
 * 所以先把 dataURL 转成 Blob，再 createObjectURL 打开。Blob URL 在新窗口渲染稳定。
 */
async function openInWindow(src) {
  if (!src) return;
  if (src.startsWith('data:')) {
    try {
      const r = await fetch(src);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) {
        // 浏览器拦截弹窗 → 退化为下载
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-${Date.now()}.${(blob.type.split('/')[1] || 'png')}`;
        a.click();
      }
      // 60s 后回收（让新标签页足够时间加载）
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      // 兜底：直接用 dataURL 打开
      window.open(src, '_blank');
    }
  } else {
    window.open(src, '_blank');
  }
}

// ============ Showcase（作品墙） ============

/**
 * 保存生成结果到 Showcase
 */
async function saveToShowcase(image, prompt, model, provider) {
  try {
    await fetch('/api/showcase/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, prompt, model, provider }),
    });
    // 沉默成功，不弹 toast 以免打扰
  } catch (err) {
    console.warn('[showcase] 保存失败:', err.message);
  }
}

/**
 * 加载最新 10 张作品并渲染
 */
async function loadShowcase() {
  const grid = $('#showcaseGrid');
  const loading = $('#showcaseLoading');
  if (!grid) return;
  if (loading) loading.classList.remove('hidden');
  try {
    const res = await fetch('/api/showcase/latest');
    const data = await res.json();
    if (!data.success || !data.images || !data.images.length) {
      if (loading) loading.classList.add('hidden');
      return; // 空状态已由 HTML 内置空占位控制
    }
    renderShowcase(grid, data.images);
  } catch (err) {
    console.warn('[showcase] 加载失败:', err.message);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

/**
 * 渲染 Showcase 网格
 */
function renderShowcase(grid, images) {
  // 移除空占位
  const empty = grid.querySelector('.showcase-empty');
  if (empty) empty.remove();

  images.forEach((img) => {
    const card = document.createElement('div');
    card.className = 'showcase-card';
    card.addEventListener('click', () => {
      // 点击打开详情（全屏看图）
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;cursor:pointer';
      overlay.innerHTML = `<img src="/api/showcase/image/${img.id}" style="max-width:90vw;max-height:90vh;border-radius:2px;object-fit:contain" alt="${img.prompt}">`;
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
    });
    card.innerHTML = `
      <img class="showcase-card-img" src="/api/showcase/image/${img.id}" alt="${img.prompt}" loading="lazy">
      <div class="showcase-card-overlay">
        <div class="showcase-card-prompt">${escapeHtml(img.prompt)}</div>
        <div class="showcase-card-meta">
          <span class="showcase-card-model">${escapeHtml(img.model || img.provider)}</span>
          · ${img.created_at ? new Date(img.created_at + 'Z').toLocaleDateString() : ''}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ============ Start ============
init();

// ============ FAQ & Template 交互（基于原生 <details> / <button>） ============
// HTML 已用 <details> 实现 FAQ 折叠，原生支持键盘 + 读屏，无须额外 JS

// 模板卡：点选把模板描述填入 prompt（占位实现）
document.querySelectorAll('.template-card').forEach((card) => {
  card.addEventListener('click', () => {
    const name = card.querySelector('.template-name')?.textContent || '';
    const desc = card.querySelector('.template-desc')?.textContent || '';
    const promptEl = document.querySelector('.tab-content.active [data-prompt]');
    if (promptEl) {
      promptEl.value = `${name}，${desc}`;
      promptEl.focus();
      showToast(`已应用「${name}」模板`, 'success', 2000);
    }
  });
});

// 上传区：支持键盘 Enter/Space 触发点击
const uploadArea = $('#uploadArea');
if (uploadArea) {
  uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      uploadArea.click();
    }
  });
}

// ============ Header Scroll Effect ============
const header = document.getElementById('header');
let scrollTicking = false;

window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(() => {
      header.classList.toggle('scrolled', window.scrollY > 40);
      scrollTicking = false;
    });
    scrollTicking = true;
  }
});

// ============ Mobile Nav Toggle ============
document.getElementById('navToggle').addEventListener('click', () => {
  document.getElementById('nav').classList.toggle('open');
});

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    document.getElementById('nav').classList.remove('open');
  });
});

// ============ Active Nav Link (scroll spy) ============
const sections = document.querySelectorAll('#hero, #tool, #templates, #faq');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveNav() {
  const scrollPos = window.scrollY + 120;
  let current = '';
  sections.forEach((sec) => {
    const top = sec.offsetTop;
    const bottom = top + sec.offsetHeight;
    if (scrollPos >= top && scrollPos < bottom) current = sec.id;
  });
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

window.addEventListener('scroll', () => {
  window.requestAnimationFrame(updateActiveNav);
});
