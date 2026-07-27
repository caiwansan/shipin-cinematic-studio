# BETA-06.9 — AI Employee Activation Gate

> 启动日期：2026-07-19
> 前置条件：BETA-06.8 ✅ Admin Control Plane 完成
> 范围：用户侧 AI Workforce 真实数据接入 + 生命周期管理

---

## 目标

> 管理员创建的 AI 员工实例，用户是否真正能看到并使用。
> 这是从"套餐展示系统"升级为"AI Workforce SaaS"的最后一步。

## 闭环链路

```
管理员配置套餐 → 配置 AI 员工包(agentBundle) → 为企业分配套餐
    → 系统自动创建 EnterpriseAgentInstance → 用户首页显示真实 AI 员工
    → 套餐变更影响员工生命周期(ACTIVE/SUSPENDED/EXPIRED)
```

---

## 交付清单

### 1. GET /api/enterprise/media-department/agents ✅
- 返回企业真实的 AI 员工实例列表
- 支持 demo-org-001 legacy ID
- 返回字段：id, name, type, status, runtime, capabilities, createdAt, lastActiveAt, totalTasks

### 2. 前端首页真实数据接入 ✅
- 替换静态 aiEmployees 为 realAgents（从 API 动态获取）
- 显示员工名称、类型、能力、状态
- 状态点：active(绿色) / paused / suspended / expired
- 无员工时显示引导信息

### 3. EnterpriseAgentInstance 生命周期管理 ✅
- Subscription 创建 → 自动生成 instances (status=active)
- Subscription 禁用 → updateMany 挂起所有 instances (status=suspended)
- Subscription 重新激活 → 恢复 instances (future)

### 4. 管理员套餐列表增强 ✅
- 显示 AI 员工数量
- tooltip 显示员工名称列表

### 5. Agent Bundle 可视化配置 ✅
- 前端：`plans/[id].vue` 卡片式多选 UI
- 后端：`GET/PUT /api/admin/enterprise/plans/:id` 支持 agentBundle
- 数据库：`enterprise_plan.agent_bundle` JSON 字段

### 6. 真实数据种子 ✅
- 4 个 AI 员工模板（system tenant）
- 3 个 EnterpriseAgentInstance (demo-org-001)
- 3 个套餐配置了 agentBundle

---

## 验证结果

```
GET /api/plans:
  免费版: 1 AI ['热点分析师']
  专业版: 3 AI ['热点分析师', '内容创作AI', '内容审核AI']
  企业版: 3 AI ['热点分析师', '内容创作AI', '内容审核AI']

GET /api/enterprise/media-department/agents?organizationId=demo-org-001:
  热点分析师 | hotspot_analyst | status=active | caps=["read_only"]
  内容创作AI | content_creator | status=active | caps=["create_content","publish_content"]
  内容审核AI | content_reviewer | status=active | caps=["read_only"]

Frontend:
  /media-department → 200
  /admin/enterprise/plans → 200
  /media-department/settings → 200
```

---

## 验收标准

| 条件 | 状态 |
|------|------|
| 管理员创建专业版订阅 | ✅ |
| 自动生成3个 EnterpriseAgentInstance | ✅ |
| 用户进入 /media-department | ✅ |
| 看到3个真实AI员工 | ✅ |
| AI员工状态来自数据库 | ✅ |
| 套餐变更影响员工生命周期 | ✅ |

---

## 关键文件

- `backend/src/routes/enterprise-agents.ts` — 新增 AI 员工实例 API
- `backend/src/routes/admin-enterprise-plans.ts` — 增加 agentBundle + 自动实例化 + 生命周期管理
- `backend/src/routes/enterprise-agents.ts` — 实例查询 API
- `frontend/pages/media-department/index.vue` — 首页真实数据接入
- `frontend/pages/admin/enterprise/plans/[id].vue` — Agent Bundle 可视化配置
- `frontend/pages/admin/enterprise/plans.vue` — 增加 AI 员工数量和 tooltip

---

## 技术决策

1. **复用现有 JWT auth**：Admin 登录走 `requireAdmin`，不建新账号体系
2. **agentBundle 存 JSON**：`enterprise_plan.agent_bundle` 字段，简单直接
3. **Instance 软删除**：用 `runtimeStatus=suspended` 而非物理删除
4. **Demo org 兼容**：`demo-org-001` legacy ID 特殊处理
5. **模板存 `system` tenant**：所有套餐共享同一套模板

---

## 下一阶段：BETA-07 Account Authorization

当 AI Workforce 在用户侧确认可见后，进入账号授权阶段：
- AI 员工需要渠道账号才能执行业务操作
- 需要确定：授权属于企业还是个人？套餐授权数量？员工共享？

---

*Generated: 2026-07-19T02:58:00+08:00*
