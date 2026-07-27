# SPRINT-07B-1-C REALITY GATE — 岗位状态生命周期

> 生成时间: 2026-07-27 07:35 CST
> 测试范围: 企业招聘工作台岗位状态流转

---

## R1: 创建岗位默认 draft ✅ PASS

**测试方法**: 代码审查
**逻辑**: `createPosting` 发送 `status: 'draft'`，后端 `JobPosting.create` 默认 `'draft'`
**结果**: 新岗位创建后默认草稿状态 ✅

## R2: 发布 draft → published ✅ PASS

**测试方法**: 后端逻辑验证
**前端**: 草稿岗位显示「发布」按钮 → `handlePublish` → `PUT /api/enterprise/postings/:id` `{status:'published'}`
**后端**: `VALID_TRANSITIONS['draft'] = ['published']` → 允许 ✅

## R3: 暂停 published → paused ✅ PASS

**测试方法**: 后端逻辑验证
**前端**: 发布状态岗位显示「暂停」按钮 → `handlePause` → `PUT /api/enterprise/postings/:id` `{status:'paused'}`
**后端**: `VALID_TRANSITIONS['published'] = ['paused', 'closed']` → 允许 ✅

## R4: 关闭 published/paused → closed ✅ PASS

**测试方法**: 后端逻辑验证
**前端**: 发布/暂停状态显示「关闭」按钮 → `handleClose` → `PUT /api/enterprise/postings/:id` `{status:'closed'}`
**后端**: `VALID_TRANSITIONS['paused'] = ['published', 'closed']` → 允许 ✅

## R5: 企业隔离 ✅ PASS

**测试方法**: 代码审查
**后端**: `prisma.jobPosting.findFirst({ where: { id, enterpriseId } })` — 必须匹配 enterpriseId
**结果**: 企业 A 无法操作企业 B 岗位（404 not found）✅

## R6: 非法流转被阻断 ✅ PASS

**测试方法**: 代码审查 + 模拟

| 流转 | 预期 | 实际 |
|------|------|------|
| draft → published | ✅ 允许 | ✅ 允许 |
| published → paused | ✅ 允许 | ✅ 允许 |
| paused → published | ✅ 允许 | ✅ 允许 |
| published → closed | ✅ 允许 | ✅ 允许 |
| paused → closed | ✅ 允许 | ✅ 允许 |
| draft → paused | ❌ 阻断 | ❌ 阻断 |
| draft → closed | ❌ 阻断 | ❌ 阻断 |
| closed → published | ❌ 阻断 | ❌ 阻断 |

**结果**: 5/5 合法允许，3/3 非法阻断 ✅

---

## 变更文件清单

| 文件 | 变更 |
|------|------|
| `backend/src/routes/job-posting.routes.ts` | PUT 接口增加 `status` 字段 + 状态流转验证 |
| `frontend/studio-v2/api/recruitment-api.ts` | 新增 `updatePostingStatus()` |
| `frontend/pages/workspace/recruitment/index.vue` | 岗位卡片增加状态操作按钮 + CSS |

## 后续路线

- **Sprint-07B-1-D**：候选人展示
- **Sprint-07B-2**：Talent Agent 接入
- **Sprint-07B-3**：Interview Agent
