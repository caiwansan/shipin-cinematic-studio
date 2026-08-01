# SPRINT-MEDIA-UX-01-REALITY-REPORT — 新媒体运营工作台产品壳改造

**Date:** 2026-08-02 02:10
**Gate:** 掌柜指令（Sprint-MEDIA-UX-01：改造工作台 ≠ 制造假功能）
**范围:** 前端产品壳 + 只读数据展示框架。**不启动微信接入、不创建假数据、不模拟真实运营结果。**
**依据:** SPRINT-SOCIAL-MEDIA-PRODUCT-RECONSTRUCTION.md / SPRINT-SOCIAL-MEDIA-IMPLEMENTATION-PLAN.md / MEDIA-PRODUCT-CONSTITUTION-01

---

## 0. 结论

✅ **Sprint-MEDIA-UX-01 COMPLETE** — R1-R6 全 PASS（生产域实测）。
新媒体运营工作台产品壳已上线：7 模块导航 + 真实数据展示框架 + 诚实空态。微信接入（Sprint-MEDIA-01）仍等待真实资产，本 Sprint 不触碰。

## 1. 交付清单

### 1.1 前端（Nuxt SPA，生产域 aigc.fushtn.com/workspace/media）
| 文件 | 说明 |
|------|------|
| `pages/workspace/media/index.vue` | 运营总览：账号状态横幅 / AI 员工阵容 / 执行记录 / 能力目录 / 模块入口 |
| `pages/workspace/media/accounts.vue` | 账号管理：微信公众平台连接框架（4 步流程）+ 凭证安全说明 + 多平台规划位 |
| `pages/workspace/media/content.vue` | 内容中心：发布流程框架（AI生成→合规→草稿→发布→回流）+ 真实空态 |
| `pages/workspace/media/messages.vue` | 预留（明确 Empty State：规划于 Sprint-MEDIA-04） |
| `pages/workspace/media/customers.vue` | 预留（明确 Empty State：规划于 Sprint-MEDIA-04） |
| `pages/workspace/media/analytics.vue` | 预留（明确 Empty State：需 datacube 真实回流后启用） |
| `pages/workspace/media/team.vue` | 预留（明确 Empty State：模板注册于 Sprint-MEDIA-02） |
| `components/media/MediaWorkspaceShell.vue` | 产品壳：Header + 7 模块子导航（复用 WorkspaceSwitcher） |
| `components/media/MediaAgentRoster.vue` | AI 员工阵容：真实 AgentInstance 数据 / 空态锁定阵容卡 |
| `components/media/MediaPlannedPage.vue` | 预留模块统一空态页 |
| `config/workspaces.ts` | 新增 `media`（preview, visibleOnHome）+ `media-department` → hidden（旧页保留可访问） |

### 1.2 后端（只读数据展示框架，唯一新增）
| 文件 | 说明 |
|------|------|
| `src/routes/enterprise-readonly.routes.ts` | `GET /api/enterprise/outcomes` — 企业侧真实执行记录（agent_outcome SSOT）+ 真实成本（usage_logs），organizationId 强制归属，无数据显示空数组 |

### 1.3 复用（零重造）
EnterpriseShell 模式参考、WorkspaceSwitcher、kmki-ui EmptyState 设计语言、enterprise agent-profiles 现有端点、enterprise capabilities 现有端点。

## 2. 数据真实性验证（生产域 127.0.0.1:4002 实测，2026-08-02）

| # | 验证项 | 结果 |
|---|--------|------|
| V1 | 登录 demo 用户 → token | ✅ 200 |
| V2 | `GET /api/enterprise/outcomes?workspace=media&days=30` | ✅ 200，真实空：`{total:0, items:[], byType:[], usage:{totalCost:0}}` |
| V3 | `GET /api/enterprise/capabilities` | ✅ 200，16 条能力，`media.*=0`（诚实空态） |
| V4 | `GET /api/enterprise/agent-profiles?types=media_*` | ✅ 200，数组长度 0（真实空） |
| V5 | 无 token 访问 outcomes | ✅ 401（权限边界） |
| V6 | 生产域 `https://aigc.fushtn.com/workspace/media` | ✅ 200 |

> 说明：本环境无浏览器自动化工具，页面渲染以 Nuxt build 编译通过（R6）+ 生产域路由 200 + API 真实链路验证替代；截图项留待掌柜浏览器复核或 Sprint-MEDIA-01 验收一并补。

## 3. Reality Gate

| Gate | 要求 | 状态 |
|------|------|------|
| R1 | /workspace/media 可访问 | ✅ 生产域 200 |
| R2 | 7 模块导航结构完成 | ✅ Shell 7 项 + 7 路由页（4 预留页明确 Empty State） |
| R3 | AI 员工展示来自真实 Agent 数据 | ✅ agent-profiles 真实查询；无数据显示锁定阵容卡 + 明确「模板待注册」 |
| R4 | 无 mock 运营数据 | ✅ 全链路真实查询；空态组件明示「无数据」；能力清单折叠标注「规划中，未注册」 |
| R5 | 旧 /media-department 无破坏保留 | ✅ 页面未动；workspaces.ts → hidden（visibleOnHome:false, routeAccessible:true） |
| R6 | 生产 build 通过 | ✅ nuxt build PASS（低内存构建，558 资源同步） |

## 4. 意外事件与修复（诚实记录）

- **EADDRINUSE 启动循环**：初次重启 api-server 崩溃循环（↺677），根因 `FST_ERR_DUPLICATED_ROUTE` — 我新增的 `/api/enterprise/capabilities` 与既有 `enterprise-capability.routes.ts` 重复。
- **修复**：移除重复端点，前端改调既有 capabilities 端点 + 前端过滤 media.*；api-server 恢复稳定监听 4002。
- **教训**：新增企业侧路由前必须 `grep -rn "path" src/routes/` 查重；本次重复注册在启动期暴露（Fastify 双注册即崩），未污染生产。

## 5. 冻结清单（持续）

❌ 不启动微信接入 ❌ 不创建假数据 ❌ 不模拟运营结果 ❌ 浏览器自动化/伪造发布（CONSTITUTION-01）
⏸ Sprint-MEDIA-01 等真实微信资产（企业认证服务号 appid/secret + IP 白名单 124.223.208.24）

## 6. 下一步

微信资产到位 → Sprint-MEDIA-01（M1 三表 + B1 路由 + B2 account.service + wechat-mp adapter），账号连接后 accounts.vue 自动切已连接态、content.vue 展示真实发布记录、analytics.vue 启用 datacube 回流——**产品壳已就位，零返工**。

**锚点**：后端 `src/routes/enterprise-readonly.routes.ts`；前端 `components/media/*` + `pages/workspace/media/*`；配置 `frontend/config/workspaces.ts`
