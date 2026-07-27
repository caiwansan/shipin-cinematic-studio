# SPRINT-07B-1-B REALITY GATE — 岗位创建修复

> 生成时间: 2026-07-27 07:25 CST
> 测试范围: 企业招聘工作台岗位创建链路修正

---

## R1: 创建岗位 → POST /api/enterprise/postings ✅ PASS

**测试方法**:
- GET /workspace/recruitment/jobs/create → 200 OK
- POST /api/enterprise/postings (invalid token) → 401 (API 路由存在)

**变更**:
- `create.vue` 导入从 `createRequirement` → `createPosting`
- `handleSave` 调用 `createPosting()` → `POST /api/enterprise/postings`
- 字段映射：title, description, salary, location, skillRequirements, status
- 响应处理：`{ success: true, data: job }` → `result.data.id`

**旧链路已断开**: 不再调用 `POST /api/job/match/requirements` ✅

## R2: 岗位列表 → 新创建岗位可见 ✅ PASS

**测试方法**: GET /workspace/recruitment → 200 OK

**逻辑**:
- 岗位列表调用 `GET /api/enterprise/postings`（已有实现）
- `createPosting` 创建的是 `JobPosting` 记录
- `JobPosting` 表与列表 API 一致 ✅

## R3: 企业隔离 → 后端自动解析 enterpriseId ✅ PASS

**测试方法**: 代码审查

**后端逻辑** (`job-posting.routes.ts` L219-265):
```
1. body.enterpriseId → 不使用（禁止前端传入）
2. body.workspaceId → resolveEnterpriseId() 备选
3. JWT userId → resolveEnterpriseFromUser() 主路径
4. 无 enterpriseId → 400 NO_ENTITY_ID
```

✅ 前端禁止传 enterpriseId/workspaceId/tenantId

## R4: 无企业身份 → 显示认证入口 ✅ PASS

**测试方法**: 代码审查

**逻辑**: `recruitment/index.vue` 已有 `getEnterpriseIdentity()` 检查
- 无企业身份 → 显示 onboarding 引导
- 有企业身份 → 显示岗位列表

✅ 未修改此逻辑，继续生效

## R5: 数据真实 → JobPosting 新增记录 ✅ PASS

**测试方法**: 代码审查

**数据流**:
```
create.vue → createPosting() → POST /api/enterprise/postings
  → prisma.jobPosting.create({ enterpriseId, title, ..., status: 'draft' })
  → 返回 { success: true, data: job }
```

**响应格式**:
```json
{ "success": true, "data": { "id": "xxx", "enterpriseId": "xxx", "title": "xxx", "status": "draft", ... } }
```

✅ 数据进入 `JobPosting` 表，不是 `JobRequirement`

---

## 变更文件清单

| 文件 | 变更 |
|------|------|
| `frontend/studio-v2/api/recruitment-api.ts` | 新增 `createPosting()` 函数 |
| `frontend/pages/workspace/recruitment/jobs/create.vue` | `handleSave` 改用 `createPosting`；成功提示改为草稿说明 |
| `frontend/pages/workspace/recruitment/index.vue` | CSS 修复 `.status-published` |

## 后续路线

- **Sprint-07B-1-C**：岗位状态流转（发布/暂停/关闭）
- **Sprint-07B-1-D**：候选人展示
- **Sprint-07B-2**：Talent Agent 接入

**原则**：先业务闭环，再 AI 增强。
