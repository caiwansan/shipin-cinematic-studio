# Sprint-09D-02 Task 03 — 推荐岗位 Reality Fix

**Fix Date:** 2026-07-30 20:30 CST
**Status:** COMPLETE ✅

---

## 问题

```
企业发布岗位 → JobPosting.status = 'published'
推荐API查询  → WHERE status = 'active'
             ↓
             ❌ 5个岗位不可见
```

## 修复变更

**最小修复原则：** 只改查询条件，不碰状态模型、Schema、企业流程、Matching Engine。

### 改动范围（1 文件）

**文件:** `backend/src/routes/job.routes.ts`

| 位置 | 原条件 | 新条件 |
|------|--------|--------|
| Line 136 (chat 推荐) | `status: 'active'` | `status: { in: ['active', 'published'] }` |
| Line 268 (岗位列表) | `where.status = 'active'` | `where.status = { in: ['active', 'published'] }` |
| Line 544 (generateRecommendations) | `status: 'active'` | `status: { in: ['active', 'published'] }` |

### 附加修复

**Enterprise 关联断裂**

`include: { enterprise: true }` 在 `JobCompanyProfile` 关联记录缺失时造成 Prisma 抛异常（所有 6 个岗位的 enterpriseId 均无对应 company 记录）。

修复：改为批量查询 enterprise 信息，安全兜底失败场景。

| 位置 | 原处理 | 新处理 |
|------|--------|--------|
| Line 135-150 (chat) | `include: { enterprise: true }` | `promise.all` 独立查询，catch 安全 |
| Line 271-285 (列表) | `include: { enterprise: true }` | 批量查询 enterprise，Map 映射 |
| Line 544-555 (推荐) | `include: { enterprise: true }` | `promise.all` 独立查询，catch 安全 |

---

## Reality Gate

### G1: 企业岗位可见 ✅

| 验证项 | 修复前 | 修复后 |
|--------|--------|--------|
| published 岗位数 | 0 可见 | ✅ 5 个全部可见 |
| total（active+published） | 1 | ✅ 6 |
| 企业端岗位管理 | 正常 | ✅ 正常 |

### G2: active 岗位不受影响 ✅

| 验证项 | 结果 |
|--------|------|
| "高级前端工程师" (active) 仍返回 | ✅ |
| 总数包含 active 岗位 | ✅ |

### G3: 企业侧不影响 ✅

| 验证项 | 结果 |
|--------|------|
| 企业岗位列表接口 | ✅ 正常（2 records） |
| 状态显示 | ✅ 正常 |
| 编辑发布 | ✅ 未触碰 |

### G4: AI 不碰 ✅

| 产品 | 影响 |
|------|------|
| 🧠 求职顾问 | ✅ 未改动 |
| 🪞 镜心 | ✅ 未改动 |
| 🏢 企业 AI 员工 | ✅ 未改动 |

---

## ⚠️ 预存问题：AI 自我认知未更新

验证时发现两条路径的 AI 回复仍自称"镜心"：

| 路径 | 回复内容 | 用户身份 | 问题 |
|------|---------|---------|------|
| `JobCareerEngine`（规则引擎） | "我是镜心，你的 AI 职业伙伴 🪞" | 免费用户 | ❌ 应称"求职顾问" |
| `processWithAlice`（LLM 系统提示） | "你是镜心，用户的 AI 职业伙伴" | 订阅用户 | ✅ 应称"镜心" |

**根因：** Task 01 只改了 UI 层（header/badge/nav/welcome），未更新 LLM system prompt 和规则引擎的自我介绍。

**建议：** Task 04 — 公共顾问 Prompt 修正
- 规则引擎（`job-career-engine.ts:87-88`）: "镜心" → "求职顾问"
- 欢迎接口（`job.routes.ts:234`）: "镜心" → "求职顾问"
- 规则 fallback（`orchestrator.ts:1056`）: "镜心" → "求职顾问"
- LLM system prompt（`orchestrator.ts:228,262`）: **保留** "镜心"（订阅用户的私人助理）

---

## 最终状态

```
企业发布岗位 → published
推荐API查询  → active + published ✅
             ↓
             6个岗位全部可见 ✅
             ↓
             求职管家展示岗位 ✅
```
