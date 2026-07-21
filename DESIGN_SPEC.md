# Atelier — AI 图片生成器 设计系统规范

> 文档版本：v1.0 · 创建：2026-07-19
> 作者：UI Designer
> 适用范围：D:\Downloads\ai-image-generator（Web 单页应用）

---

## 0. 概览

| 维度 | 决策 |
|------|------|
| **设计语言** | Atelier（工作室 / 画廊式）—— 编辑感、衬线、克制、纸质 |
| **主色** | 酒红 #7a1f2b + 暖米白 #f1ebdb + 深炭墨 #1a1714 |
| **字体** | Fraunces（display 衬线）+ Inter（body 无衬线）+ JetBrains Mono（UI 标签） |
| **圆角** | 2-14px（编辑感方角为主，pills 14px 限定） |
| **投影** | 极淡暖色 + 1px 高光（避免冷灰阴影） |
| **对比度** | 全部文字 ≥ 7:1（AAA），UI 元件 ≥ 4.5:1（AA） |
| **动效** | 入场 fade+rise，hover 微动 1-2px，避免反弹/旋转 |
| **响应式** | 移动优先，3 档断点（640 / 1024 / 1280） |

**核心反"通用 AI 审美"原则**：
- 不用 emoji 装饰 hero/按钮/统计
- 不用全圆角 / 大渐变 / 玻璃拟态
- 不用 emoji 当图标（用衬线 italic + 数字编号 + 1px 几何符号）
- 装饰字符必须是"有意义的文字"（如 A. / Atelier / 章节编号）

---

## 1. 设计令牌（Design Tokens）

### 1.1 色板

#### 主色：酒红系列（accent）
| Token | Hex | 用途 |
|-------|-----|------|
| `--accent` | #7a1f2b | 主品牌色、CTA hover、强调字 |
| `--accent-soft` | #f4e6e3 | 酒红 5% 背景（hover state） |
| `--accent-ink` | #4a1018 | 酒红深色（按下态 / 强文字） |
| `--accent-line` | rgba(122,31,43,0.35) | 1px 边框 |

#### 中性色：墨色（ink）
| Token | Hex | 用途 |
|-------|-----|------|
| `--ink-primary` | #1a1714 | 主文字、按钮 bg |
| `--ink-secondary` | #5c544a | 副文字 |
| `--ink-tertiary` | #968c80 | 辅助文字、placeholder |
| `--ink-inverse` | #f5f1e8 | 反白（深底上的文字） |

#### 背景色（bg）
| Token | Hex | 用途 |
|-------|-----|------|
| `--bg-base` | #f1ebdb | 主体米白（页面默认） |
| `--bg-elevated` | #faf6ed | 卡片底（比 base 亮） |
| `--bg-sunken` | #e6dec8 | 凹陷/分隔（比 base 深） |
| `--bg-cream` | #ebe2cb | 工具区背景（中性过渡） |
| `--bg-ink` | #1a1714 | 章节反转（hero 装饰 / footer） |
| `--bg-ink-warm` | #2a2421 | footer 暖色变体 |
| `--bg-ink-soft` | #2d2723 | 模板区深底 |

#### 语义色
| Token | Hex | 用途 |
|-------|-----|------|
| `--success` | #4a6b3a | 成功态（深绿） |
| `--warning` | #a86a1a | 警告态（深琥珀） |
| `--error` | #8b2c2c | 错误态（深酒红） |
| `--info` | #2a4a6b | 信息态（深蓝） |

#### 边框 / 线条
| Token | 值 | 用途 |
|-------|-----|------|
| `--line` | rgba(26,23,20,0.10) | 极淡分隔 |
| `--line-strong` | rgba(26,23,20,0.22) | 卡片边框 |
| `--line-accent` | rgba(122,31,43,0.35) | 酒红细线 |

### 1.2 字体（Typography）

#### 字体族
```
--font-display: 'Fraunces', 'Source Han Serif SC', 'Songti SC', 'STSong', Georgia, serif;
--font-body:    'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
```

#### 字号比例（1.250 — Major Third）
| Token | 像素 | 用途 |
|-------|-----|------|
| `--t-display` | 64px | Hero 大标题 |
| `--t-h1` | 40px | 章节标题 |
| `--t-h2` | 28px | 卡片标题 |
| `--t-h3` | 20px | 区块小标题 |
| `--t-body-lg` | 17px | 引导文字 |
| `--t-body` | 15px | 正文 |
| `--t-body-sm` | 14px | 副文 |
| `--t-caption` | 12px | 标签、辅助 |
| `--t-eyebrow` | 11px | 章节小标（UPPERCASE + tracking 0.2em） |

#### 字重
- Display（衬线）：300 / 400（推荐 300 + 衬线 italic 做强调）
- Body：400 / 500（推荐 500 做按钮、tab 激活态）
- Mono：400

#### 行高
- Display: 1.05 - 1.15（紧凑）
- H1-H3: 1.2 - 1.3
- Body: 1.55 - 1.65
- Caption/Eyebrow: 1.4

### 1.3 间距（Spacing · 4px 基）
| Token | 像素 | 用途 |
|-------|-----|------|
| `--s-1` | 4px | 微调 |
| `--s-2` | 8px | 元素间最小间距 |
| `--s-3` | 12px | 内边距小 |
| `--s-4` | 16px | 卡片内边距 |
| `--s-5` | 20px | 段落间距 |
| `--s-6` | 24px | 章节内边距 |
| `--s-7` | 32px | 卡片间距 |
| `--s-8` | 40px | 区块间距 |
| `--s-9` | 80px | 章节外边距 |
| `--s-10` | 120px | 章节大间距 |

### 1.4 圆角（Border Radius）
| Token | 像素 | 用途 |
|-------|-----|------|
| `--r-0` | 0 | 编辑感方角（首选） |
| `--r-1` | 2px | 卡片、按钮（默认） |
| `--r-2` | 4px | 输入框、tag |
| `--r-pill` | 14px | 极少量圆角（如 stat 数字胶囊） |

### 1.5 阴影（Shadow）
```css
--shadow-1: 0 1px 0 rgba(255,255,255,0.5) inset;  /* 内高光 */
--shadow-2: 0 4px 12px -2px rgba(26,23,20,0.08);
--shadow-3: 0 18px 36px -18px rgba(26,23,20,0.18),
            0 30px 60px -20px rgba(122,31,43,0.10);
--shadow-4: 0 30px 60px -20px rgba(26,23,20,0.30); /* 弹窗 */
```

### 1.6 动效（Motion）
| Token | 值 | 用途 |
|-------|-----|------|
| `--t-fast` | 150ms | hover、active 微动 |
| `--t-base` | 280ms | 卡片浮起、tab 切换 |
| `--t-slow` | 600ms | 进场、淡入 |
| `--ease` | cubic-bezier(0.16, 1, 0.3, 1) | 全局缓动（缓出） |
| `--ease-in` | cubic-bezier(0.7, 0, 0.84, 0) | 退场用 |

### 1.7 渐变
- `--grad-bg`: 顶部暖光 + 左中高光 + 右下酒红氛围 + linear 米白
- `--grad-accent`: 90deg 酒红 → 透明（用于卡片顶边）
- `--grad-text`: 米白 0% → 90% → 30% 米白（用于 hero 装饰字符）

---

## 2. 组件库（Component Library）

### 2.1 按钮（Button）

**变体**：
- **Primary**（CTA）：黑底 + 米白字 + 酒红 hover
  - bg: `--ink-primary`, color: `--ink-inverse`
  - hover: bg `--accent`, transform `translateY(-1px)`
- **Secondary**（次操作）：米白底 + 1px 墨边
  - bg: transparent, border: 1px `--ink-primary`
  - hover: bg `--ink-primary`, color: `--ink-inverse`
- **Tertiary**（文字按钮）：无边框，酒红下划线
  - color: `--accent`, text-decoration: underline
  - hover: color `--accent-ink`
- **Ghost**（图标按钮）：方角 4px，hover 加 `--accent-soft` 底

**尺寸**：
- sm: 36px 高 / 13px 字 / 内边距 12px 16px
- md: 44px 高 / 15px 字 / 内边距 16px 24px（推荐）
- lg: 56px 高 / 17px 字 / 内边距 20px 32px（hero CTA）

**状态**：
- default / hover / active（按 -1px） / disabled（opacity 0.4 + cursor not-allowed）
- focus-visible: 2px 实线 outline，`outline-color: var(--accent)`, `outline-offset: 3px`

**反通用 AI 审美决策**：
- 不加 box-shadow（靠 1px 内高光 + 颜色对比做层次）
- 不加 transform: scale（用 1-2px translateY，避免"按压"感）

### 2.2 输入框（Input / Textarea）

**变体**：
- **Default**（单行）：高 44px，1px `--line-strong` 边，2px 圆角
- **Multiline**（提示词）：高 120px 自适应，min 80px
- **Search**（下拉搜索）：左侧 mono 图标

**状态**：
- default: border `--line-strong`
- focus: border `--ink-primary`, 内 1px 高光（`box-shadow: inset 0 0 0 1px var(--ink-primary)`）
- error: border `--error`, helper text 红色
- disabled: bg `--bg-sunken`, color `--ink-tertiary`

**字符**：
- 字体 `--font-body` 15px
- placeholder: color `--ink-tertiary`
- label: 12px eyebrow 大写（用 `<label>` 包裹）

### 2.3 卡片（Card）

**变体**：
- **Default**（主工具卡）：`--bg-elevated`，1px 边，3px 酒红顶边，shadow-3
- **Sunken**（参数选择卡）：`--bg-sunken`，无投影，1px 边
- **Inverse**（深色卡）：`--bg-ink-soft`，米白字，1px 米白 12% 边

**结构**（语义化）：
```
.card
  .card-header (可选：eyebrow + 标题 + 操作)
  .card-body
  .card-footer (可选：状态 + 元数据)
```

### 2.4 Tab（标签页）

**样式**：
- 文生图 / 图生图：底部对齐，1px 细线下划线激活态
- 激活：color `--ink-primary`，下划线 2px `--ink-primary`
- 非激活：color `--ink-tertiary`，hover color `--ink-secondary`
- 字体：`--font-display` 18px（衬线，编辑感）
- 间距：每个 tab 左右内边距 24px

**反通用决策**：不用顶部蓝条 + 圆角背景的 Material 风

### 2.5 Dropdown（下拉菜单）

**结构**：
- 触发器：方角 2px + 1px 边 + 14px 衬线字
- 菜单：方角 + 米白底 + 1px 边 + shadow-3
- 选项：左 icon + 主文（衬线 14px）+ 副文（mono 11px）

**状态**：
- default / hover（`--accent-soft` 底）/ selected（左侧 3px 酒红竖条）

**动效**：fade + 8px rise, 180ms ease

### 2.6 Provider Switcher（引擎切换）

**结构**（横向 tabs）：
- 3 个：AIHubMix / Pollinations / Hugging Face
- 激活：黑底 + 米白字 + 1px 酒红重音条（顶部 2px）
- 非激活：米白底 + 1px 边 + 墨字
- 状态徽标：右上角 6px 圆点（绿=已配置 / 空=未配置）

### 2.7 Progress（进度条）

**结构**：
- 轨道：2px 高，bg `--ink-primary` 8% 透明
- 填充：2px 高，bg `--accent`，左侧带 30% 透明米色 shimmer 流光
- 文字：mono 11px，`已用 12s · 预计 30s`

**阶段指示器**（4 个圆点）：
- pending: 1px 墨边空心
- current: 墨底 + 中心白点 + 1px pulse 环
- done: 墨底 + ✓（衬线 9px）

### 2.8 Image Result（图片结果）

**网格**：
- 1 张：max-width 720px 居中
- 2 张：2 列 gap 16px
- 4 张：2×2
- 6/9 张：3 列

**图片**：
- 圆角 2px（编辑感）
- hover：显示 2 个操作按钮（下载 / 新窗口打开），黑色 80% 底
- 加载完成：从 95% scale + opacity 0 → 1，320ms

**反通用决策**：不用大圆角 16px（避免"卡片化"），不用发光阴影

### 2.9 Toast（轻提示）

**位置**：右下角，距底 24px、距右 24px
**样式**：`--bg-ink` 深底 + 米白字 + 2px 边（与主题一致）
**动效**：fade + 12px rise 200ms
**寿命**：4s 自动消失

---

## 3. 信息架构（IA）

### 3.1 页面流程
```
[Hero]                     # 00 — Atelier
  ↓
[Engine Switcher + Key]    # 01 — The Studio
  ↓
[Tool: T2I / I2I Tabs]
  - Left: Prompt + Upload + Params
  - Right: Result
  ↓
[Template Gallery]         # 02 — Curated (深色)
  ↓
[Model Comparison]         # 03 — Library (米白)
  ↓
[FAQ]                      # 04 — Handbook
  ↓
[Footer]                   # 05 — Colophon (深色)
```

### 3.2 关键决策
- **生成区是单列还是两列？** → 两列（左 40% / 右 60%），移动端单列堆叠
- **Tab 在哪？** → 主工具区顶部，与 prompt 在同一视觉块
- **模型下拉是必备还是可选？** → 必备，但折叠在 "Advanced" 内（默认隐藏，减少首屏噪音）

---

## 4. 微交互清单（Microinteractions）

| 触发 | 动效 | 时长 | 缓动 |
|------|------|------|------|
| 页面进场 | opacity 0→1, translateY 12px→0 | 600ms | ease-out |
| Hero 文字 | 字符级 fade+rise（stagger 30ms） | 800ms | ease-out |
| 卡片 hover | translateY -2px + shadow 加深 | 280ms | ease |
| 按钮 hover | bg 渐变 + 1px 上移 | 150ms | ease |
| 按钮 active | translateY 0 | 80ms | ease-in |
| Tab 切换 | 下划线滑动（transform） | 220ms | ease |
| 进度条推进 | 宽度 + shimmer 循环 | 1.5s/loop | linear |
| 结果图出现 | scale 0.95→1 + opacity 0→1 | 320ms | ease-out |
| 上传图片 | 0.3s 高光扫过 + 边框 0.5s 渐变酒红 | 800ms | ease |
| 错误抖动 | translateX 0→4→-4→0 | 240ms | ease-in-out |
| Toast 进出 | fade + rise | 200ms | ease |

**全局**：
- 遵守 `prefers-reduced-motion: reduce`——所有动效降级为 0.01ms opacity-only
- 所有 1px 移动类动效用 `transform`（不开 GPU reflow）

---

## 5. 响应式断点

| 断点 | 宽度 | 关键变化 |
|------|------|---------|
| **Mobile** | < 640px | 单列、tab 顶部、生成按钮置底 sticky、模板 2 列 |
| **Tablet** | 640-1023px | 两列变 1.2:1、tab 横排、模板 3 列 |
| **Desktop** | 1024-1279px | 标准 1.2:1.5、模板 4 列 |
| **Wide** | ≥ 1280px | 限宽 1280px 居中、加大留白 |

**移动端特别处理**：
- Hero 装饰字符 "A." 隐藏（避免溢出）
- 工具卡变全宽，paddings 收缩到 16px
- 进度条贴底
- Provider 切换器横滑（overflow-x: auto）

---

## 6. 可访问性（A11y）

### 6.1 键盘导航
- **Tab 顺序**：Hero CTA → Provider → Key 输入 → Prompt → 上传 → 模型 → 参数 → 生成 → 结果
- **focus-visible**：所有可交互元素必须有 2px 酒红 outline + 3px offset
- **快捷键**：
  - `Cmd/Ctrl + Enter`：生成
  - `Cmd/Ctrl + .`：切换引擎
  - `Esc`：关闭下拉/取消生成

### 6.2 屏幕阅读器
- 所有图标按钮有 `aria-label`（"下载图片"、"在新窗口打开"）
- 进度条 `role="progressbar"` + `aria-valuenow/min/max`
- 结果区 `role="region" aria-live="polite"`
- 上传区 `aria-label="拖拽图片或点击选择"`

### 6.3 颜色对比（已验证）
- 墨字 / 米白底：14.8:1（AAA）
- 墨字 / 米白卡片：13.2:1（AAA）
- 米白字 / 深炭墨底：14.2:1（AAA）
- 酒红 / 米白底：7.8:1（AAA）
- 墨次字（#5c544a） / 米白底：6.2:1（AA 大字）
- 辅文（#968c80） / 米白底：3.0:1（仅大字号字）

### 6.4 触觉 / 移动
- 最小点击区 44×44px
- 滑动手势不替代可见操作
- 状态变化同时伴随视觉 + ARIA

---

## 7. 内容策略

### 7.1 文案语气
- **专业克制**：不用"超级厉害的 AI"、"一键变大神"等过度营销
- **编辑感**：用 "Atelier · Studio · Curated · Handbook · Colophon" 等"出版业词汇"代替"首页/工具/案例/帮助/底部"
- **技术诚实**：明示价格（"0.002 pollen"）、明示限制（"需 X 元起充"）、不说假大空

### 7.2 术语统一
| 用 | 不用 |
|----|------|
| 引擎 (Engine) | 平台、厂商 |
| 模型 (Model) | 算法、AI |
| 文生图 (Text-to-Image) | 输入文字生成 |
| 图生图 (Image-to-Image) | 上传图片生成 |
| 提示词 (Prompt) | 关键词、描述 |
| 风格 (Style) | 滤镜、模板 |
| 比例 (Aspect Ratio) | 尺寸 |
| 分辨率 (Resolution) | 清晰度 |

---

## 8. 实施优先级（Roadmap）

### P0 — 必做（影响核心体验）
1. **可访问性**（focus-visible + aria-label + reduced-motion）——当前完全缺失
2. **响应式**（640/1024 断点）——当前仅适配桌面
3. **错误状态细化**（toast 替代 alert、抖动反馈）

### P1 — 应做（提升品质感）
4. **结果图进场动效**（scale 0.95→1 + fade）
5. **暗色模式**（auto + toggle）——可选项
6. **键盘快捷键**（Cmd/Ctrl + Enter 触发生成）

### P2 — 锦上添花（差异化）
7. **生成时背景音**（极淡，类似 Pentagram 工作室案例）
8. **模型对比表**（用 Table 展示哪些模型支持 i2i、t2i、价格）
9. **历史记录侧栏**（localStorage 存最近 10 次结果缩略图）

---

## 9. 与现有实现的差异

当前项目（v0.5）已基本实现 §1 设计令牌 + §2.1 按钮 + §2.5 下拉 + §2.7 进度条 + §2.8 结果图。**缺失**：
- §1.1 暗色模式 token
- §2.2 完整 input 状态（focus / error）
- §2.6 provider 状态徽标
- §3 信息架构中的"模型对比"章节
- §4 完整的微交互
- §5 移动端适配
- §6 全部 A11y
- §7 文案重构

下一步可按 §8 优先级分批落地。

---

## 10. 验证清单（QA）

每完成一个改动，需检查：

- [ ] 在 4 个断点（320/640/1024/1280）下表现正常
- [ ] 键盘 Tab 能遍历所有交互元素，focus 可见
- [ ] `prefers-reduced-motion: reduce` 下动效降级
- [ ] 颜色对比度 ≥ 4.5:1
- [ ] 所有图标按钮有 aria-label
- [ ] 错误状态有明确引导（不只是红字）
- [ ] 文案无错别字、术语统一
- [ ] 不引入 emoji 装饰（除非用户明确要求）
- [ ] 投影/边框不出现冷色调

---

**UI Designer 备注**：

本项目已经走出"通用 AI 审美"——暖米白 + 酒红 + 衬线 italic + 编辑感的"Atelier"调性已建立。下一步重点不是再换风格，而是**补齐可访问性、响应式、暗色模式**这三个"工业级"缺口，让它在"工作室感"基础上同时具备"上市产品"的健壮性。
