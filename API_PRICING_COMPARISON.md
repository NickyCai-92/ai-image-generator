# 四大聚合 API 平台生图模型价格对比

> 统计日期：2026-07-21 · 模型规格：1K 标准分辨率 · 单位：USD

---

## 一、支付宝支持情况（首要筛选条件）

| 平台 | 支付宝 | 其他支付方式 | 起充金额 |
|------|:-----:|-------------|:-------:|
| **Pollinations** | ✅ 已确认 | Stripe（Visa/MC） | ≈ $5（¥38.62 实测可充） |
| **AIHubMix** | ✅ 已确认 | 微信/Stripe | ≈ ¥10（≈ $1.4） |
| **APIMart** | ✅（Antom 通道） | Visa/MC/Crypto/PayPal | $10 起 |
| **Kie.ai** | ❌ 不支持 | Stripe/Crypto | $5 起（80 免费额度） |

> ⚠️ **Kie.ai 不支持支付宝，且 Trustpilot 仅 2.5/5 分**（用户报错率高、退款难、客服仅亚洲时区），**对你的项目不推荐**。

---

## 二、同模型价格逐项对比

### 1. GPT Image 系列

| 模型 | Pollinations | AIHubMix | APIMart | Kie.ai |
|------|:-----:|:--------:|:-------:|:------:|
| **GPT Image 2 (1K)** | ~$0.03（按 token） | ~$0.07（¥0.5） | **$0.0085** ← 最低 | $0.03 |
| **GPT Image 1.5 (1K med)** | — | — | **$0.022** | $0.025 |
| **GPT Image 1 (1K med)** | — | — | **$0.027** | — |
| **DALL-E 3** | — | — | $0.032 | — |

### 2. Google Nano Banana 系列

| 模型 | Pollinations | AIHubMix | APIMart | Kie.ai |
|------|:-----:|:--------:|:-------:|:------:|
| **Nano Banana (基础)** | ~$0.03（60/M token） | — | $0.031 | — |
| **Nano Banana 2 (1K)** | ~$0.06（60/M token） | ~$0.04（¥0.3） | **$0.03**（ext 版） | $0.04 |
| **Nano Banana Pro (1K)** | ~$0.12（120/M token） | ~$0.14-0.28（¥1-2） | **$0.04**（ext 版 1K） | $0.09（2K） |

### 3. Seedream 系列

| 模型 | Pollinations | AIHubMix | APIMart | Kie.ai |
|------|:-----:|:--------:|:-------:|:------:|
| **Seedream 4.5 Pro** | 0.04 pollen ≈ **$0.04** | — | — | — |
| **Seedream 5.0 Pro (1K)** | 0.09 pollen ≈ $0.09 | ~$0.06（¥0.4） | **$0.036** | **$0.035** |
| **Seedream 5.0 Pro (2K)** | — | — | $0.072 | $0.07 |

### 4. FLUX / 其他模型

| 模型 | Pollinations | AIHubMix | APIMart | Kie.ai |
|------|:-----:|:--------:|:-------:|:------:|
| **Flux Schnell** | 0.0018 ≈ **$0.0018** ← 最便宜 | — | — | — |
| **Flux（通用）** | 0.002 ≈ $0.002 | ~$0.05（¥0.05-0.3） | — | — |
| **FLUX 2 Pro (1K)** | — | — | **$0.025** | $0.032 |
| **FLUX Kontext Pro** | Quest 免费 **$0** | — | **$0.02** | 32 cr ≈ $0.032 |
| **Z-Image Turbo** | 0.002 ≈ $0.002 | ~$0.02 | **$0.01** | — |
| **Ideogram 4.0 Quality** | 0.1 ≈ $0.1 | — | — | — |
| **Midjourney (Imagine)** | — | — | **$0.045** | — |
| **Sana Sprint 1.6B** | 0.0001 ≈ **$0.0001** | — | — | — |
| **Qwen Image 2.0** | — | — | $0.02 | — |
| **Wan 2.7 Image** | — | — | $0.022 | — |

---

## 三、性价比排名（按同模型加权）

| 平台 | 综合性价比 | 一句话评价 |
|------|:---------:|-----------|
| 🥇 **Pollinations** | ⭐⭐⭐⭐⭐ | **原厂直连无加价，Quest 模型可免费**。0.0018-0.12 pollen/张，$1 ≈ 1 pollen，支付宝已实测可用 |
| 🥈 **APIMart** | ⭐⭐⭐⭐ | **支持支付宝**，gpt-image-2 仅 $0.0085（Pollinations 的 1/4），多数模型比 Pollinations 便宜 20-70%。但需 ¥10+ 起充 |
| 🥉 **AIHubMix** | ⭐⭐⭐ | 支付宝方便，价格中等偏上，**优势在 Nano Banana Pro 有正常通道**（Pollinations / APIMart 的 Nano Banana Pro 可能限流或通道不稳定） |
| ❌ **Kie.ai** | ⭐⭐ | **不支持支付宝 + 可靠性争议大**（Trustpilot 2.5/5），虽然部分模型看似便宜，不推荐作为主引擎 |

---

## 四、对你的项目建议

### 当前架构是 3 引擎并存（AIHubMix / Pollinations / HF），我建议：

**1. 主引擎保留 Pollinations（性价比之王）**
- 0.0018 pollen/张的 Flux ≈ $0.0018/张，约 ¥0.013
- 支付宝 $5 起充（¥38.62），够跑约 2777 张 Flux
- Quest 免费模型（Nova Canvas、FLUX Kontext）还能零成本出图
- **但你当前的账户余额已用完**，需再充值

**2. APIMart 可加为高级备选引擎（你项目已有 Provider 抽象层，加一个挺容易）**
- gpt-image-2 仅 $0.0085，同模型 Pollinations 要 $0.03，便宜 3.5 倍
- 支付宝支持、国内直连快
- 模型数量 30+，覆盖 Qwen 国产模型

**3. AIHubMix 作为兜底（优势在通道稳定）**
- Pollinations 有时限流/通道不足，AIHubMix 作为第二付费引擎稳
- 但目前价格偏高，建议**只做兜底不用做主攻**

### 推荐组合策略

```
低成本批量 → Pollinations（支付宝充值，$5 ≈ 2777 张 Flux）
高质量出图 → APIMart（gpt-image-2 $0.0085，Nano Banana Pro $0.04）
兜底备用   → AIHubMix（通道稳定，支付宝¥10起充）
零成本预览 → Hugging Face（4 个免费 SDXL/SD 模型）
```

要不要我把 **APIMart** 也接进项目作为第 4 个引擎（复用你现成的 aihubmix.js provider 逻辑，改 endpoint + 模型列表就行）？
