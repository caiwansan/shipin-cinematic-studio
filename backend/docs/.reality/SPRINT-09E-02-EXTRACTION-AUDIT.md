# Sprint-09E-02 Extraction Reality Audit

**Date:** 2026-07-31 01:00 CST
**State:** Code RESTRICTED — 只读审计，未改代码
**Auditor:** 杨玉环

---

## 完整 Extraction 管线图

```
Path A (原招生)                          Path B (新 Orchestrator)
─────────────                           ───────────────────────
用户消息                                     用户消息
  ↓                                           ↓
CareerAdvisorService.buildContext()          extractInfoViaLLM()
  → Three-layer context (Confirmed/Derived)    → Stage-specific JSON schema
  → 3-layer prompt + COLLECT_START tag         → LLM → JSON
  ↓                                           ↓
AI 回复 + COLLECT_START tag ★                mergeExtractedFields()
  ↓                                           → ConversationState.profile
parseCollectMarkers()                         ↓
  → parseCollectMarkers()                    syncToCareerProfile()
  → extractConfirmedFacts()                   → CareerProfile ⚠️
  → saveExtractedFields()
    → CareerProfile ⚠️
                                          ⚠️ 写入同一张表
```

**两条管线并行写入同一个 CareerProfile 表，无冲突检测，无来源标识。**

---

## 字段一览（CareerProfile Model）

| # | 字段 | 来源管线 | LLM 来源 | 可信度 | 证据 | 危险等级 |
|---|------|---------|----------|--------|------|---------|
| 1 | fullName | Path A/B | user_statement | 高 | COLLECT_START tag / 正则匹配 "我叫XX" | 🟢 安全 |
| 2 | headline | Path A | LLM 推断 / user_statement | 中 | COLLECT_START 字段 | 🟡 中 |
| 3 | bio | Path A | user_statement | 高 | COLLECT_START 字段 | 🟢 安全 |
| 4 | city | Path A/B | user_statement | 高 | COLLECT_START / 正则匹配 | 🟢 安全 |
| 5 | careerDirection | Path A/B | LLM 推断 / user_statement | 🔴 **低** | COLLECT_START / JSON field | 🔴 **污染高风险** |
| 6 | industry | Path A | **auto-inferIndustry()** | 🔴 **不可靠** | 从 directions/skills 推断 | 🔴 **污染高风险** |
| 7 | yearsExperience | Path A/B | user_statement | 高 | COLLECT_START / JSON field | 🟢 安全 |
| 8 | currentLevel | — | — | — | 未实现 | ⚪ 空 |
| 9 | educationLevel | Path B | **LLM 推断** | 🟡 低 | "提到本科→推断educationLevel" | 🟡 推断风险 |
| 10 | school | Path B | user_statement | 高 | JSON field | 🟢 安全 |
| 11 | major | Path B | user_statement | 高 | JSON field | 🟢 安全 |
| 12 | skills | Path A/B | **LLM 抽取** | 🟡 中 | COLLECT_START / JSON array | 🟡 污染风险 |
| 13 | workHistory | Path A/B | **LLM 抽取** | 🔴 **低** | JSON array / COLLECT_START | 🔴 **编造高风险** |
| 14 | targetRole | Path B | LLM 推断 | 🟡 中 | JSON field | 🟡 推断风险 |
| 15 | targetIndustry | Path B | LLM 推断 | 🟡 中 | JSON field | 🟡 推断风险 |

---

## 关键发现

### F1 🔴 CRITICAL — 行业自动推断（silent overwrite）

```typescript
// saveExtractedFields: line ~1168
if (!updateData.industry) {
  const inferred = CareerAdvisorService.inferIndustry({...})
  if (inferred) {
    updateData.industry = inferred
  }
}
```

**问题：** 用户说"我是做销售的" → `careerDirection="销售"` → `inferIndustry()` 输出 `"销售/市场"`。
但用户实际意思只是泛指，不代表行业归属。自动写入无用户确认、无来源标记。

**影响范围：** 所有未显式提供行业的用户。

### F2 🟡 HIGH — 年龄被误认为工作年限

Prompt 显式声明了：

```
⚠️ "我30岁" 表示年龄，不是工作年限
```

但仅仅靠 prompt 约束，**无代码层防护**。LLM 仍然可能在 COLLECT_START 中填入
`yearsExperience: 30`，直接写入 CareerProfile。

### F3 🟡 HIGH — 技能推导无边界

当前 Prompt:

```
技能列表：如果用户说"做过 React 开发"则包含 "React"
```

合理。但无上限约束：

- 用户说"用过 React.js" → 正确识别
- 用户说"开发过商城" → **不会**编造"微服务、高并发"（当前 OK）
- 但无代码层验证

### F4 🟡 MEDIUM — mergeExtractedFields 无条件覆盖

```typescript
if (typeof extracted.name === 'string' && extracted.name && !profile.name) {
  profile.name = extracted.name
}
```

条件 `!profile.name` 防止了覆盖。但其他字段（skills, workHistory）不做存在性检查：

```typescript
if (Array.isArray(extracted.workHistory) && extracted.workHistory.length > 0) {
  profile.workHistory = [
    ...new Set([...(profile.workHistory || []), ...extracted.workHistory])
  ]
}
```

**问题：** Path B 每个阶段的提取会追加到 profile。如果 SKILLS 阶段提取了错误技能，下一个阶段不会移除。

### F5 🟡 MEDIUM — 两条管线竞争写入

Path A (`saveExtractedFields`) 和 Path B (`syncToCareerProfile`) 都写入 CareerProfile 表。

场景：
1. Path A 写入 `fullName="李大牛"`  
2. Path B 写入 `fullName="王大牛"`（来自不同 stage schema）
3. 最终值取决于**执行顺序**，不可预测。

### F6 🟢 LOW — 无 Confidence / Source / Evidence

所有字段写入时无：

- 来源类型（user_statement / ai_inferred / auto_infer）
- 置信度评分
- 原文证据引用
- 状态（confirmed / corrected / outdated）

---

## 污染风险测试场景

### 场景一：厨师

```
用户：我是做西餐的厨师
Path A: careerDirection="厨师" ✓
Path A: 无 industry（LLM 没写）→ 自动 inferIndustry("厨师") → "餐饮/酒店" 🔴
```

**风险：** `industry` 字段被自动推断为"餐饮/酒店"，用户从未说过。

### 场景二：假年龄

```
用户：我今年30岁
LLM 可能输出：yearsExperience=30 🔴
Prompt 说"30岁不是工作年限"，但无法 100% 保证。
```

**风险：** 误填工作年限，无代码层拦截。

### 场景三：假技能

```
用户：开发过商城系统
LLM 正确输出：skills=["商城系统开发"] ✓（当前 LLM 行为良好）
```

**风险：** 当前低，但无代码层防护。如果 prompt 被修改或 LLM 版本升级可能退化。

### 场景四：假公司经历

```
用户：我做过3年销售
LLM 应输出：yearsExperience=3
但 Path B EXPEIRIENCE 阶段可能抽取 workHistory=[{company:"某公司",title:"销售"}]
```

**风险：** LLM 可能编造不存在的公司名。当前 Prompt 有"不要编造"约束。

---

## 双重管线方案（当前架构的合理设计）

两条管线的历史背景：

| | Path A (saveExtractedFields) | Path B (syncToCareerProfile) |
|---|---|---|
| 出生 | Sprint-09A 遗留 | Sprint-09E-01 新引入 |
| 触发 | COLLECT_START tag 解析 | extractInfoViaLLM 调用 |
| 写入方式 | 单个字段覆盖 | merge → sync |
| 阶段 | 全局 | stage-specific |
| 优势 | 用户 AI 双保险 | 结构化抽取 |

**不合理性：** 两条管线同时在跑，写入同一张表。不应长期共存。

**Sprint-09E-02 策略：** 保留两条管线但区分职责。

---

## 审计结论

### 高风险（立即处理）

1. **industry auto-infer** — silent，不可追踪
2. **无 confidence/source/evidence** — 所有字段无元数据
3. **年龄→工龄误填** — 仅靠 prompt 约束

### 中风险（本 Sprint 内）

4. **无冲突检测** — 双管线覆盖
5. **Skills 无上限** — 无代码层验证
6. **Coverage 无标记** — 每条事实不可追溯

### 低风险（后续）

7. **mergeExtractedFields 无条件追加** — 当前行为可接受
8. **教育 level 推断** — 本 Sprint 暂不处理

---

## 当前状态表

```json
{
  "totalFields": 15,
  "highConfidence": 5,
  "mediumConfidence": 4,
  "lowConfidence": 5,
  "unused": 1,
  "contaminationRisk": {
    "industry": "CRITICAL",
    "workHistory": "HIGH",
    "skills": "MEDIUM",
    "careerDirection": "MEDIUM",
    "educationLevel": "LOW"
  },
  "pipelineCoordination": "NONE"
}
```

---

*Audit end. Ready for Task 02 implementation.*
