# Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 — 招聘后台 IA 收敛 — COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜纠偏指令（招聘后台产品边界错了：企业 SaaS 控制台 ≠ 平台后台管理）→ G1-G8 全 PASS

## 目标达成

> 求职招聘后台从「25 页运营后台」降级为「5 页商业管理后台」。

```
后台管理
└── 🏭 Workspace工作台管理
     └── 💼 求职招聘管理
          ├── 1. 求职管家 Agent 配置   /admin/recruitment/config
          ├── 2. 套餐订阅管理          /admin/recruitment/plans（双 Tab）
          ├── 3. AI Agent 管理         /admin/recruitment/agents
          ├── 4. 企业用户管理          /admin/recruitment/enterprises
          └── 5. 企业套餐授权          /admin/recruitment/authorization
```

## 任务完成

| Task | 内容 | 状态 |
|------|------|------|
| T01 | 注册表收敛：24 入口 → 5 入口（只隐藏不删代码，URL 仍可达） | ✅ |
| T02 | 5 页面 IA 重构（Agent 产品定义 / 套餐订阅双 Tab / AI员工 / 企业用户 / 套餐授权） | ✅ |
| T03 | 移除招聘后台模型配置入口（config 无 API Key/Provider；agents 无模型池/绑定；index 无内嵌 AI 配置面板） | ✅ |
| T04 | ROI/额度/日报 → 数据罗盘 API（/api/admin/dashboard/roi·quotas·daily-report）+ agents 抽屉企业智能面板 | ✅ |
| T05 | 企业套餐授权链路回归：Admin→Subscription→Entitlement→Provision 26/26 PASS | ✅ |

## 退出后台导航的页面（代码保留）

- 岗位管理 / 候选人管理 / Campaign / 审计中心 / 面试管理 / 会话管理 / 运行监控（业务运营 → 企业工作台）
- ROI / 日报 / 额度 / 模型健康 / AI员工活动 / 企业试运营 / 收入报表 / 企业入驻审核（运营数据 → 数据罗盘）
- 路由注册表全部标记 `deprecated`（孤儿检查 PASS，53 页面 30 active + 23 deprecated）

## 架构修正（掌柜强调）

- 删除方向：`招聘后台 → EnterpriseLlmConfig → 企业 API Key` ❌
- 统一方向：`用户模型设置 UserModelConfigV2 → Runtime Resolver → Agent 执行` ✅（短剧/小说/招聘同一套）
- config.vue 显式展示「模型配置（已移除）」说明 + 指向 🤖 大模型管理

## T05 回归（26/26 PASS，隔离测试企业，测完清理）

```
登录 → 套餐列表 → Agent 产品定义（无模型字段）→ 授权开通
→ Subscription 创建（快照对齐）→ Entitlement 生成（maxAgents 对齐）
→ Provision（Profile + Instance 幂等创建）→ 列表可见
→ 暂停 → 恢复 → 变更套餐 → 取消 → 数据罗盘 ROI/额度/日报 → 清理
```

## 顺带修复的 2 个真实 Bug

1. **`/api/admin/recruitment/subscriptions` limit 字符串 500**：`take: "100"` 触发 Prisma Int 校验错误 → 原订阅列表页实际一直 500（前端静默）。已 parseInt 修复。
2. **provision 死代码**：`prisma.employeeTemplate` model 不存在于 schema（运行时 undefined），原 enterprise-employee-provision.service 从未真正工作 → grant 内置幂等 provision（按套餐 employees 配置创建 Profile + Instance）。

## G8 浏览器验收（全部 PASS）

- 登录链路 ✅ → /admin/dashboard ✅
- 侧边栏「求职招聘管理」仅 5 子项 ✅（岗位/候选人/监控/模型健康等全部消失）
- landing 5 入口卡片 ✅ | config：无密码框/无 provider select，prompt 5527 字符 ✅
- plans：套餐 11 行 + 订阅 Tab（11 订阅 / 4 活跃 / 暂停·变更·取消·详情）✅
- agents：7 员工卡片（企业归属 + 启用/停用/重新部署，无模型池）✅
- enterprises：77 企业 / 7 AI员工 / 20 行列表 ✅
- authorization：11 订阅 + 授权链路 + 开通按钮 ✅
- 数据罗盘 agents 抽屉：企业智能面板（ROI ¥0.03/18.2K tokens/ROI 8013x · 额度 11 企业 · 日报 2 任务）✅

截图：`docs/reality/ADMIN-IA-RECRUITMENT-CLEANUP-01-{landing,agent-config,authorization,dashboard-intel}.png`

## 关键文件

- `frontend/config/admin-workspace-registry.ts`（导航收敛）
- `frontend/config/admin-route-registry.ts`（路由登记 + deprecated 标记）
- `frontend/pages/admin/recruitment/{index,config,plans,agents,enterprises,authorization}.vue`
- `frontend/pages/admin/dashboard.vue` + `frontend/components/admin/dashboard/EnterpriseIntelPanel.vue`
- `backend/src/routes/admin-recruitment.ts`（agent-product / grant / limit 修复 / 内置 provision）
- `backend/src/routes/admin-dashboard-center.routes.ts`（roi / quotas / daily-report）
- `backend/scripts/t05-authorization-regression.ts`（回归脚本）

提交：TBD
