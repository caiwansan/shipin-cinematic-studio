# GEO Recommendations Wireframe v1.0
## Brand Knowledge OS — 行动中心页面

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Health Wireframe 组件语言 + Product Principles / Vocabulary / IA

---

# 一、页面定位

Recommendations ≠ 建议列表。

它的真实定义是：

> **AI 将 Brand Health 拆解为可执行动作的界面**

## 核心目标

用户进入这个页面只做一件事：选择一个动作，让 Brand Health 变好。

## 与 Health 的关系

```
Health          = "Where you are"         (状态)
Recommendations = "How to improve"        (行动)
```

Health 是状态，Recommendations 是动力系统——如何从 82 → 89。

---

# 二、页面结构（Wireframe）

```
┌──────────────────────────────────────────────────────────┐
│  Recommendations                                         │
│  "3 actions to improve Brand Health"                     │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │  Brand Health Impact Preview                       │  │
│  │                                                    │  │
│  │  82  ────────→  89  (if all actions completed)    │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  PRIORITY ACTIONS (Top 3)                                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  1. Fix Knowledge Coverage Gap                   │   │
│  │     Impact: +4 Brand Health                      │   │
│  │     Effort: Low    ┃  Why: AI cannot fully       │   │
│  │                         understand your brand    │   │
│  │     [ One-click Improve ]                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  2. Improve AI Visibility                        │   │
│  │     Impact: +3 Brand Health                      │   │
│  │     Effort: Medium ┃  Why: Brand not             │   │
│  │                         consistently indexed     │   │
│  │     [ One-click Improve ]                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  3. Publish Latest Brand Update                  │   │
│  │     Impact: +2 Brand Health                      │   │
│  │     Effort: Low    ┃  Why: Publishing cycle      │   │
│  │                         outdated                 │   │
│  │     [ One-click Publish ]                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  EXPLANATION PANEL                                 │  │
│  │  Why these actions?                                │  │
│  │  - AI missing structured brand info                │  │
│  │  - Low keyword coverage                            │  │
│  │  - Outdated publishing cycle                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [ Improve All ]  (Primary CTA)                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

# 三、核心设计原则

## Principle R1 — Action is the Product

这个页面不展示数据、分析或模型——只展示可执行行为。

## Principle R2 — Each Action Must Have Impact

每个 Recommendation 必须包含：Impact (+N Brand Health)、Effort（Low/Medium/High）、Reason（为什么存在）。

## Principle R3 — One-click Execution

禁止多步骤配置、参数选择、表单填写。允许：One-click Improve / Publish / Fix。

## Principle R4 — Preview Before Action

用户必须看到 Impact Preview（82 → 89）后才能执行。

## Principle R5 — Stackable Actions

允许 Improve All（批量执行），但内部仍是单一 action set。

---

# 四、组件规范

## 4.1 Impact Banner

### 结构
```
Brand Health Impact Preview

82 ────────→ 89  (if all actions completed)
```

### 规则
- 左侧当前值（灰色），右侧预期值（绿色）
- 箭头动画方向 → 表示提升
- 预期值 = 当前 + 所有 action 的 Impact 之和

---

## 4.2 Action Card

### 标准结构
```
┌──────────────────────────────────────────────────┐
│  N. Action Title                                 │
│                                                  │
│  Impact: +4 Brand Health    Effort: Low          │
│                                                  │
│  Why: AI cannot fully understand your brand      │
│                                                  │
│  [ One-click Action Button ]                     │
└──────────────────────────────────────────────────┘
```

### 字段规范
| 字段 | 说明 | 格式 |
|------|------|------|
| Title | 可执行标题，动词开头 | Fix / Improve / Publish / Add / Update |
| Impact | 对 Brand Health 的提升 | +N Brand Health |
| Effort | 执行成本 | Low / Medium / High |
| Why | 问题描述 | 自然语言，不多于 2 行 |
| Action Button | 唯一可点击 | "Improve" / "Fix" / "Publish" |

### 状态
- **Pending**: 默认状态，Action Button 可点击
- **Running**: 执行中，Button 变为 Loading Spinner
- **Success**: 执行完成，卡片淡出并移到顶部
- **Error**: 执行失败，显示错误信息 + Retry

---

## 4.3 Explanation Panel

### 结构
```
Why these actions?
- AI missing structured brand info
- Low keyword coverage
- Outdated publishing cycle
```

简单的子弹列表，不使用技术术语。

---

# 五、页面行为模型

## Flow Model

```
Health (状态: 82)
   ↓
Enter Recommendations (入口: Health CTA / 导航)
   ↓
See Impact Preview (82 → 89)
   ↓
Select Single Action
   ↓
One-click Execute
   ↓
Action Card → Success (淡出)
   ↓
Impact Banner 更新 (82 → 86)
   ↓
继续或返回 Health
```

## Stackable Flow

```
Select Multiple / "Improve All"
   ↓
Sequential Execution (每个 action 依次运行)
   ↓
All Completed
   ↓
Impact Banner 更新 (82 → 89)
   ↓
"Brand Health improved: +7" Toast
   ↓
返回 Health
```

---

# 六、UI 设计约束

| 约束 | 说明 |
|------|------|
| No Free-form list | 不能是普通清单或 SEO tips dump |
| Every item must be executable | 不能有纯描述性建议，必须带 Action Button |
| Impact always visible | 每条必须显示 +N Brand Health |
| No technical wording | 禁止 Pipeline / Engine / Workflow 等词 |

---

# 七、组件映射（Design System 准备）

```
Recommendation Page
├── Impact Banner          — 顶部渐变区域
├── Action Card List       — 有序卡片列表（Top 3 优先级）
├── Action Card Component  — 可复用单卡片
├── Explanation Panel      — 底部解释区域
└── Primary CTA Button     — "Improve All"
```

---

# 八、状态系统

## 8.1 Empty State

```
No recommendations available

Your Brand Health is already optimized.
```

## 8.2 Loading State

```
Analyzing your brand...
Generating improvement actions...
```

逐步提示让用户感知进度，而非仅 spinner。

## 8.3 Success State (Toast)

```
┌──────────────────────────────┐
│  ✓ Brand Health improved: +7  │
└──────────────────────────────┘
```

---

# 九、与 Health 的连接

```
Health Page
├── Actions Panel → "Today's Actions" (3 items, abbreviated)
│     ↓ 点击 "View all" 或任意 action
├── Recommendations Page (full list)
│     ↓ 执行完成
├── Health Page (Brand Health 更新)
```

Health 展示缩略版本（3 条 + CTA），Recommendations 展示完整版本。

---

# 十、冻结声明

> Recommendations Wireframe v1.0 defines the execution layer of Brand Knowledge OS.
> It is the only valid representation of actions, improvements, and execution logic.
> All implementations must conform to this structure.
