# GEO Verification Wireframe v1.0
## Brand Knowledge OS — 信任中心（Confidence Center）

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Health / Recommendations Wireframe 组件语言 + Product Principles / Vocabulary / IA

---

# 一、产品定义（必须先冻结）

## Verification ≠ Evidence Center

它的真实定位是：

> **Confidence Center（信任中心）**

回答的不是"系统做了什么"，而是：

> **这次优化真的让品牌变得更容易被 AI 理解了吗？**

## 用户来到这里的唯一原因

不是来看日志、API、检测结果、证据条目——而是来看：

> **我的品牌真的变好了吗？**

---

# 二、页面回答的四层问题

页面必须按顺序回答四个问题：

| 层级 | 问题 | 内容 |
|------|------|------|
| 第一层 — Outcome | 有没有变好？ | Brand Health before → after |
| 第二层 — Confidence | 为什么我们认为它变好了？ | 做了什么（摘要级） |
| 第三层 — Proof | 我们有什么依据？ | Before / After 指标对比 |
| 第四层 — Trust | 下一步呢？ | 引导至 Growth |

---

# 三、页面结构（Wireframe）

```
┌──────────────────────────────────────────────────────────┐
│  Verification                                            │
│  "Did your brand really improve?"                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─── LAYER 1: Outcome ─────────────────────────────┐   │
│  │                                                    │   │
│  │  Brand Health                                      │   │
│  │                                                    │   │
│  │  82  ────────  88                                   │   │
│  │        +6 this improvement                         │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── LAYER 2: Confidence ─────────────────────────┐   │
│  │                                                    │   │
│  │  Why we believe this                              │   │
│  │                                                    │   │
│  │  ✓ Brand description updated                       │   │
│  │  ✓ FAQ content expanded (3 new entries)            │   │
│  │  ✓ AI Feed synchronized                            │   │
│  │  ✓ Website re-published                            │   │
│  │                                                    │   │
│  │  (All complete — no pending items)                 │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── LAYER 3: Proof ─────────────────────────────┐   │
│  │                                                    │   │
│  │  Before vs After          Δ                       │   │
│  │  Knowledge Coverage  68% → 82%    +14%   ▸Learn   │   │
│  │  AI Visibility       61% → 74%    +13%   ▸Learn   │   │
│  │  Authority           72  → 79     +7     ▸Learn   │   │
│  │  Trust               85  → 91     +6     ▸Learn   │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── LAYER 4: Trust ──────────────────────────────┐   │
│  │                                                    │   │
│  │  AI has re-verified your brand.                    │   │
│  │  Results may take 24–48 hours to reflect           │   │
│  │  across external AI systems.                       │   │
│  │                                                    │   │
│  │  [ View Growth Trends ]                            │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

# 四、组件规范

## 4.1 Outcome Banner（Layer 1）

### 结构
```
Brand Health

82 ──────── 88
     +6 this improvement
```

### 规则
- 始终显示 Before → After
- 不使用 "Verification Passed / Failed" 语言
- 无提升时不显示负数，显示 "No change detected"
- 使用与 Health 页相同的 Brand Health 视觉语言

---

## 4.2 Confidence Summary（Layer 2）

### 结构
```
Why we believe this

✓ Brand description updated
✓ FAQ content expanded (3 new entries)
✓ AI Feed synchronized
✓ Website re-published

(All complete — no pending items)
```

### 规则
- 使用 ✅ / ❌ 图标
- 每一项是做了什么（动词开头），不是技术过程
- 限制 5-7 项，超出折叠
- 底部显示完成度状态

---

## 4.3 Before/After Comparison（Layer 3）

### 结构
```
Before vs After          Δ
Knowledge Coverage  68% → 82%    +14%   ▸Learn
AI Visibility       61% → 74%    +13%   ▸Learn
Authority           72  → 79     +7     ▸Learn
Trust               85  → 91     +6     ▸Learn
```

### 规则
- 统一数据格式：`Before → After    Δ`
- 每行可点击展开 "Learn" → 显示维度详情
- Δ 正值绿色，负值红色，零值灰色
- 默认显示 4 个核心维度，更多折叠
- 不使用表格边框——使用列表式卡片

---

## 4.4 Trust Footer（Layer 4）

### 结构
```
AI has re-verified your brand.
Results may take 24–48 hours to reflect across external AI systems.

[ View Growth Trends ]
```

### 规则
- 连接 Verification → Growth
- 不强推下一步，但提供明确路径
- 使用自然语言，不使用技术预测

---

# 五、UI 设计约束

| 约束 | 说明 |
|------|------|
| No logs | 禁止展示日志、Trace、Verification Record |
| No lists of evidence | 禁止证据编号列表（Evidence #1, #2） |
| No technical terms | 禁止 Hash, Package, Runtime, Adapter, Pipeline |
| Before/After always visible | 第一屏必须展示 Outcome |
| Confidence before Proof | 信任摘要优先于数据对比 |
| Four-layer order locked | Outcome → Confidence → Proof → Trust |

---

# 六、页面行为模型

## Entry Flow

```
Recommendations (执行完成)
   ↓
Toast: "Brand Health improved: +6"
   ↓
Auto-navigate to Verification (or manual)
   ↓
Outcome Banner animates in (82 → 88)
```

## Re-verify Flow

```
用户回到 Verification 查看已完成优化的结果
   ↓
显示最近一次优化记录
   ↓
如有多次 → 显示 Timeline 选择器（极简，dropdown）
```

---

# 七、状态系统

## 7.1 Empty State — No verifications yet

```
No verifications yet

Run your first recommendation to see how your brand improves.
```

## 7.2 Loading State — Verification in progress

```
Verifying your brand...

Checking AI visibility...
Checking knowledge coverage...
```

逐步提示，非单纯 spinner。

## 7.3 No Change State

```
Brand Health remained the same

No significant change was detected. 
This is expected — some improvements take time.
```

---

# 八、被禁止的内容（进入 Studio）

以下内容**不得出现在 Verification 页面**：

| 禁止内容 | 归属 |
|----------|------|
| Verification Record ID | Studio |
| JSON / API Response | Studio |
| Package Hash | Studio |
| Runtime Log | Studio |
| Pipeline Trace | Studio |
| Evidence #1, #2, #3 | Studio |
| Adapter Config | Studio |

---

# 九、四层页面与产品闭环

```
Health (知道现在状态)
   ↓
Recommendations (知道该做什么)
   ↓
Verification (知道是否真的改善)
   ↓
Publishing (知道被分发到哪里)
   ↓
Growth (知道长期趋势)
   ↓
Health (更新后重新开始)
```

Verification 的第四层（Trust）是 Growth 的入口。

---

# 十、冻结声明

> Verification Wireframe v1.0 defines the confidence layer of Brand Knowledge OS.
> It answers: "Did the brand really improve?"
> It does NOT answer: "What did the system do?"
> All implementations must conform to the four-layer structure.
