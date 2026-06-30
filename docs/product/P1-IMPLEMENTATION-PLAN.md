# 实施计划：Sprint P1 — Brand Health Report

**批准文号**：熊大 2026-07-21 批准
**Scope Lock**：仅限 Brand Health Report，禁止扩展

---

## 数据流分析

### 数据来源

Brand Health Report 需要整合 5 个现有 API 的数据到单个页面上：

| 数据块 | API | 当前可用性 |
|--------|-----|-----------|
| 品牌总评分 + 等级 | `GET /api/geo/recommendation/score?projectId=` | ✅ 包含 `overall` + 五维 `score` + 每维 `details[]`（label/status/reason） |
| 评分趋势（变化量） | `GET /api/geo/monitor/dashboard/:projectId` → `lastDelta` | ⚠️ Dashboard 当前不返回 delta，需增强 |
| 评分趋势历史 | `GET /api/geo/recommendation/timeline?projectId=` | ✅ 时间序列数据 |
| AI 收录状态 | `GET /api/geo/monitor/dashboard/:projectId` → `publishingHealth` | ✅ |
| 优化建议 | `GET /api/geo/learning/signals?projectId=` | ✅ 含 type/weight/reason/evidence/confidence |
| 验证记录 | `GET /api/geo/verification/timeline/:projectId` | ✅ |
| 完整报告 | `GET /api/geo/reports/generate?projectId=&type=brand` | ✅ 但返回纯文本 sections，UI 直接可用 |

### 关键发现

> **ScoreExplainability 已经包含了每维度的 details[] + reasons**。前端不需要新 API 就能展示"为什么得到这个分数"。这是一个重要的架构资产，此前未被充分利用。

---

## 受影响文件清单

### 修改（2 个）

| 文件 | 变更 | 复杂度 |
|------|------|--------|
| `frontend/studio-v2/workspace/brand-geo-v2/GeoOverview.vue` | 完全重构为 Brand Health Report 视图 | 高 |
| `backend/src/services/geo/recommendation/recommendation.route.ts` | Score API 补充返回 breakdown 详情（如果当前 flatten 后丢失） | 低 |

### 新增（0 个）

当前架构下不需要新增文件。全部在现有 GeoOverview.vue 内完成。

---

## 实施步骤

### Step 1：修复 Score API（如果 flatten 丢失 details）

当前 `recommendation.route.ts` 的 score endpoint 只返回：
```json
{ overall, visibility, authority, content, website, knowledge }
```
**丢失了** `breakdown.visibility.details`（即每个维度的细分项原因）。

需要改为返回完整 `ScoreExplainability`。

变更文件：`backend/src/services/geo/recommendation/recommendation.route.ts`

### Step 2：重构 GeoOverview.vue → Brand Health Report

从当前的三列 Metric 布局重构为六区块报告布局：

```
┌─────────────────────────────────────────────────────────┐
│ Executive Summary（顶部横幅，自动生成总结）               │
│ "你的品牌目前整体健康度良好，AI 已能识别品牌主体..."     │
├─────────────────────────────────────────────────────────┤
│ Level + Score + Delta   │ AI Visibility Summary        │
│ (A/B/C/D + 总分数)     │ (ChatGPT ✅ Gemini ✅ ...)   │
├─────────────────────────────────────────────────────────┤
│ 五维健康评分（每维分数+等级+原因+改进建议）              │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │Brand  │ │Content│ │Auth  │ │Struct│ │AI Rec│         │
│ │Presence│ │Quality│ │&Trust│ │Data  │ │Ready  │         │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
├─────────────────────────────────────────────────────────┤
│ Top Issues（最多 5 条，严重度+原因+修复+收益+难度）     │
│ ⚠️ [HIGH] 缺少结构化数据 → 预计提升 +15%              │
│ ⚠️ [MED] 官网权威性不足 → 预计提升 +8%                │
├─────────────────────────────────────────────────────────┤
│ Recommended Actions（按 High/Medium/Low 分组）          │
├─────────────────────────────────────────────────────────┤
│ 底部：查看优化建议 → 跳转 Insights Tab                  │
└─────────────────────────────────────────────────────────┘
```

### Step 3：执行摘要生成（前端侧）

> 接受策略：执行摘要由前端根据现有数据生成，不依赖后端新 API。

生成规则：
- 总评分 > 80 → "你的品牌目前整体健康度良好..."
- 60–80 → "你的品牌目前表现中等，存在一些可优化的空间..."
- < 60 → "你的品牌当前需要关注以下关键问题..."
- 有风险时追加 → "建议优先处理 HIGH 风险项..."

### Step 4：五维评分卡

每个维度展示：
- 分数（0–100）
- 等级（A 80+ / B 60+ / C 40+ / D <40）
- 原因列表（从 `details[].reason` 取）
- 影响因素（从 `details[].label` + `details[].status` 取）
- 改进建议（如果可用）

### Step 5：Top Issues

从 insights 信号中取前 5 条：
- 按 weight 降序
- 每条显示严重度标记
- 原因 = `reason` 字段（商业语言优先）
- 预计收益 = 暂用固定文案或映射

### Step 6：AI Visibility Summary

从 Monitor Dashboard 取得 publishingHealth，展示当前已对接的平台：
- GPT / Gemini / Claude / Perplexity
- 显示当前接入的 probe 状态（via `GET /api/geo/monitor/probes`）

### Step 7：部署 + 验收

---

## API 变更确认

| Endpoint | 变更 |
|----------|------|
| `GET /api/geo/recommendation/score` | 从 flatten 恢复为完整 `ScoreExplainability`（含 breakdown.*.details） |
| `GET /api/geo/monitor/dashboard/:projectId` | 新增 `lastDelta` 字段（当前版本可能已有） |

---

## 验收条件映射

| 熊大要求 | 对应实现 |
|----------|---------|
| 3 分钟内看懂品牌状态 | Executive Summary + Score + Level |
| 知道为什么分数是这样 | 五维评分卡 + 每维原因列表 |
| 知道先改什么 | Top Issues（按严重度排序） |
| 知道改完能获得什么收益 | Top Issues 预计收益+难度标记 |
| 能够立即开始优化 | 底部"查看优化建议"跳转 |

---

## 风险应对

| 风险 | 应对 |
|------|------|
| Score API flatten 后 details 丢失 | Step 1 修复 API，先后端再前端 |
| Executive Summary 机器感重 | 使用结构化模板 + 动态变量拼接，避免僵硬 |
| Top Issues 信号不足 5 条 | 有多少显示多少，不足时显示空态 |
| 五维维度命名与白皮书不完全一致 | 前端映射层：authority → Authority & Trust |
