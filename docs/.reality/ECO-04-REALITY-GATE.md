# ECO-04-REALITY-GATE.md — License & Entitlement Boundary

> **SPRINT-ECO-04 完成报告** | 日期：2026-08-04 00:20 | 状态：✅ PASS（28/28）
> 掌柜批准（2026-08-03 22:18）：License System 升级为 **License & Entitlement Boundary**——未来插件商城/开发者收入/订阅/推广分佣/本地App授权/AI员工使用权的统一入口

---

## 1. 数据模型（掌柜指定，纯新增 3 表）

### ecology_licenses（PluginLicense）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| organization_id | TEXT NOT NULL | 组织隔离（G8 基础） |
| plugin_id | TEXT NOT NULL | FK → ecology_plugins.id |
| plugin_version | VARCHAR(30) | 许可对应插件版本（默认取最新 published） |
| status | VARCHAR(20) | **ACTIVE \| EXPIRED \| SUSPENDED（掌柜冻结）** |
| license_type | VARCHAR(20) | trial \| subscription \| lifetime |
| start_at / expire_at | TIMESTAMP | 授权区间 |
| source_subscription_id | TEXT? | 预留：未来订阅体系来源 |
| machine_id | VARCHAR(120)? | 预留：本地 App 机器标识（非纯网页授权） |
| entitlements | JSONB | 能力授权清单（预留） |

唯一约束：`(organization_id, plugin_id)` — 组织对插件唯一许可

### ecology_license_events（LicenseEvent）
`INSTALL / ACTIVATE / RENEW / EXPIRE / SUSPEND / RESTORE` 全事件审计（detail JSONB 含原因/操作人/变更前后）

### ecology_license_check_logs（LicenseCheckLog）
每次运行校验落日志：`result(allowed|denied) + reason(OK|NO_LICENSE|EXPIRED|SUSPENDED|PLUGIN_NOT_FOUND) + source(kaor|local_app) + machine_id`

## 2. 状态机（掌柜冻结，已实现）

```
subscribe → ACTIVE
ACTIVE ──renew──→ ACTIVE        （续期延长 expireAt）
ACTIVE ──expire──→ EXPIRED      （到期/强制）
ACTIVE ──suspend──→ SUSPENDED   （风控/违约）
SUSPENDED ──restore──→ ACTIVE
EXPIRED ──renew──→ ACTIVE       （续费恢复）
SUSPENDED 不可 renew（须先 restore）✅ 非法流转防护
```

- 惰性到期：check 时发现 ACTIVE 且 expireAt < now → 自动流转 EXPIRED + 记录 EXPIRE 事件
- 主动扫描：`POST /license/scan-due` + 服务启动自动扫描（幂等）

## 3. API（/api/ecosystem/license，12 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /license/grant | 授权（subscribe→ACTIVE，幂等：重复 grant 返回现有） |
| POST | /license/check | **运行校验（G7 核心）**，organizationId 由 JWT 强制解析 |
| POST | /license/check-many | 批量校验（KAOR 插件加载前） |
| GET | /license/mine | 当前组织全部许可 |
| GET | /license/:licenseId | 许可详情 |
| GET | /license/:licenseId/events | 授权事件审计 |
| POST | /license/:licenseId/renew | 续期（ACTIVE/EXPIRED→ACTIVE） |
| POST | /license/:licenseId/suspend | 暂停（→SUSPENDED） |
| POST | /license/:licenseId/restore | 恢复（SUSPENDED→ACTIVE） |
| POST | /license/:licenseId/expire | 强制过期（→EXPIRED） |
| GET | /license/checks/:organizationId | 校验日志（org 归属强校验，跨组织 403） |
| POST | /license/scan-due | 到期批量流转 |

## 4. 本地 App 预留（掌柜要求：不设计成纯网页授权）

- **check 为平台无关语义**：`organizationId + pluginId + source + machineId`，不依赖浏览器会话
- 实测 `source='local_app' machineId='WIN-ABC123'` 链路 ✅（check 正常 + 日志记录 source/machineId）
- 未来链路已通：`Kunlun Media.exe → KAOR → License Check → Plugin Load`

## 5. Reality Gate 结果（28/28 PASS）

| Gate | 验证内容 | 结果 |
|------|---------|:----:|
| G1 | 现有 23 AI 员工全部正常 | ✅ instances=23 active=23 bindings=23 |
| G2 | Agent 创建流程不变 | ✅ templates=10 + overview 可用 |
| G3 | Hermes 调用链不变 | ✅ 工作流模板链路 |
| G4 | Plugin/Runtime 生态链回归 | ✅ 注册+绑定+runtime-health |
| G5 | 数据库只增 ecology_license* 表 | ✅ ecology 10→13；schema 差异仅 3 License 模型；迁移 SQL 只建 license 表 |
| G6 | 零修改现有商业系统 | ✅ PaymentOrder/Subscription/User/Organization/Agent/Hermes 零改动 |
| **G7** | **插件过期：应用继续打开，插件不可运行** | ✅ 过期前 allowed → expire → denied EXPIRED；agent-profiles/templates 正常；renew 恢复 |
| **G8** | **组织隔离：A 购买 B 不能用** | ✅ A allowed；B check NO_LICENSE；B 许可列表不含 A 插件 |
| 回滚 | DROP 3 新表无依赖 → 重建幂等 | ✅ 唯一约束保留 |

## 6. 纪律遵守确认

- ✅ 零破坏：只新增 ecology_license* 3 表（ecology_plugins 仅加关系声明字段，无 DB 变更）
- ✅ 禁止清单全遵守：未碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes
- ✅ 不开发商城 UI / 不开发本地 exe / 不接支付
- ✅ 只登记授权 / 只校验不执行（无插件代码执行路径）
- ✅ 全事件审计（INSTALL→ACTIVATE→RENEW→EXPIRE→SUSPEND→RESTORE）+ 校验日志

## 7. 生态商业闭环进度

| 层 | 状态 |
| --- | -- |
| Application Identity | ✅ ECO-01 |
| Plugin Identity | ✅ ECO-02 |
| Runtime Boundary | ✅ ECO-03 |
| Agent 兼容 | ✅（23 实例零改动） |
| **License & Entitlement** | ✅ **ECO-04（本 Sprint）** |
| 开发者生态 | 后续（Developer Center） |
| 商城 | 后续（Marketplace） |
| Local App | 后续（Kunlun Media.exe 授权链路已预留） |

## 8. 下一阶段 ECO-05 建议

掌柜路线图：Developer Center → Marketplace → Kunlun Media Local App

建议 ECO-05 Developer Center（开发者生态，延续「登记优先」纪律）：
1. **Developer 身份**：developer_id ↔ ecology_plugins.author 关联 + 开发者 Profile（纯新增 ecology_developer 表）
2. **插件发布流程登记**：REGISTERED → SUBMITTED → REVIEWED → PUBLISHED 状态流转登记（不做人工审核 UI）
3. **授权数据回填**：License entitlements 与插件 manifest.permissions 交集校验（开发者声明的能力 ≤ 授权能力）
4. Reality Gate：G7/G8 回归 + 开发者隔离（A 开发者插件 B 开发者不可见）

## 9. 交付物清单

```
backend/prisma/schema.prisma                           (+3 License 模型)
backend/prisma/migrations/sprint-eco-04-license-entitlement-boundary/migration.sql
backend/src/ecosystem/license.service.ts               (LicenseService：状态机/事件/校验/日志)
backend/src/routes/ecology-license.routes.ts           (/api/ecosystem/license 12 端点)
backend/src/index.ts                                   (+ECO-04 注册 + 启动到期扫描)
backend/scripts/reality-check-eco-04.mjs               (Reality Gate 28 项)
docs/.reality/ECO-04-REALITY-GATE.md                   (本报告)
```

**提交：** SPRINT-ECO-04 License & Entitlement Boundary — 28/28 Reality Gate PASS（G7 过期隔离 + G8 组织隔离）
