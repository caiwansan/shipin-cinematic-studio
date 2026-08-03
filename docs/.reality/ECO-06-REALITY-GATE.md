# ECO-06-REALITY-GATE.md — Marketplace Foundation

> **SPRINT-ECO-06 完成报告** | 日期：2026-08-04 01:50 | 状态：✅ PASS（49/49）
> 掌柜批准（2026-08-03 22:37）：ECO-06 Marketplace Foundation——**数据与交易基础设施**，不是商城产品。
> 允许：上架登记 / 插件发现 / 安装流程 / License 联动 / 结算数据快照；禁止：商城页面 / 支付页面 / 推广系统 / 提现 / 分佣计算。

---

## 1. 目标链路（掌柜）

```
Plugin → Publish Request APPROVED → Marketplace Listing
      → User Install → License ACTIVE → KAOR Load（未来）→ Plugin Available
```

## 2. 数据模型（只新增 ecology_*，未碰 Commerce）

### 新增 2 表（ecology 16 → 18）

**ecology_marketplace_items（插件商品登记）**

| 字段 | 说明 |
|------|------|
| plugin_id UNIQUE | 一插件一商品（FK ecology_plugins CASCADE） |
| developer_id | 上架者（FK ecology_developers RESTRICT，G1 校验依据） |
| display_name / description / category | 商品信息 |
| pricing_model | FREE \| TRIAL \| SUBSCRIPTION（仅登记不接支付） |
| status | **LISTED \| UNLISTED（掌柜冻结）** |
| listed_at | 上架时间 |

**ecology_revenue_snapshots（结算数据快照，非结算）**

| 字段 | 说明 |
|------|------|
| plugin_id + period UNIQUE | YYYY-MM 月度快照 |
| subscription_count | **该周期 ACTIVE 许可数（真实聚合，不编造）** |
| gross_amount | **恒 0（未接支付体系，诚实登记；ECO-07 由 license_events 计算）** |
| status | DRAFT \| FINALIZED（ECO-07 Settlement 使用） |

### 扩展 1 表（复用 ECO-02 ecology_plugin_installations，避免双真源）

- 加列 `license_id`（G2 安装→授权联动）、`removed_at`（G3 卸载时间）
- status 状态机扩展：INSTALL_REQUEST → INSTALLED / FAILED；INSTALLED → REMOVED（卸载）/ DISABLED（停用）
- **决策说明**：掌柜建议的 ecology_plugin_install_events 未单独建表——ECO-02 已有 ecology_plugin_installations 承担安装登记，扩展其状态机 + 事件语义完全覆盖，避免两张表双真源（向掌柜汇报此取舍）

## 3. 四个 Reality Gate（掌柜指定，49/49 PASS）

### G1 发布权限 ✅
- devA 上架自己插件 → LISTED；devB 上架 devA 插件 → `403 AUTHOR_MISMATCH`
- 未审批插件（非 PUBLISHED）→ `400 PLUGIN_NOT_PUBLISHED`
- 下架同理作者专属；重复上架幂等（更新商品信息）

### G2 安装授权联动 ✅
- 安装 → installation INSTALL_REQUEST → **LicenseService.grantLicense 复用 → ACTIVE** → INSTALLED + license_id 回填
- 双组织独立安装 → 双 License（G8 组织隔离延续）
- 已 INSTALLED 重复安装 → 幂等；未上架插件安装 → `ITEM_NOT_FOUND`
- 发现接口（GET /marketplace/items）返回商品 + 当前组织已安装标记

### G3 卸载行为 ✅
- 卸载 = `installation.status → REMOVED`（**行不删**，removed_at 留痕）
- **License 保留历史**（不删除、不挂起、不失效，仅解除当前安装关系）
- 卸载后可重新安装（复用原行，license 重新联动）

### G4 未授权启动 ✅
- launch-check（KAOR Load 前置语义）：已安装 ACTIVE → 可运行；未安装 → `NOT_INSTALLED`；**License 过期 → `EXPIRED`**；恢复后 → 可运行

## 4. API（/api/ecosystem/marketplace，10 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /items | G1 上架登记（作者专属） |
| POST | /items/:pluginId/unlist | 下架（不删记录） |
| GET | /items | 插件发现（LISTED + 已安装标记） |
| GET | /items/:pluginId | 商品详情 |
| POST | /install | G2 安装→License ACTIVE |
| POST | /uninstall | G3 卸载（REMOVED 不删行） |
| GET | /installs | 当前组织安装列表 |
| POST | /revenue-snapshot | 结算快照登记（非结算） |
| GET | /revenue-snapshots | 快照列表 |
| POST | /launch-check | G4 未授权启动校验 |

## 5. 回归与纪律

- ✅ 回归全绿：23 AI 员工 / ECO-04 License 链路 / ECO-05 Developer 链路 / ECO-03 runtime-health / 工作台 overview
- ✅ ecology 16 → 18 张；PaymentOrder/Subscription/User/Organization/Agent/Hermes 零改动
- ✅ 不做商城 UI / 不做支付 / 不做推广 / 不提现 / 不分佣计算
- ✅ 回滚验证：DROP 2 新表 → 16 张无依赖 → 还原 installations 扩展列 → 重建幂等（18 张 + 唯一索引保留）→ 恢复现场

## 6. 生态商品链（掌柜目标达成）

```
开发者生产（ECO-05） → 插件上架（ECO-06） → 用户安装（ECO-06）
      → 授权运行（ECO-04 License）→ 结算快照登记（ECO-06，ECO-07 用）
```

**昆仑镜第一次具备：开发者生产 → 插件上架 → 用户安装 → 授权运行 的完整生态商品链**

## 7. 下一阶段 ECO-07 建议（Revenue Settlement）

掌柜路线图：ECO-07 Revenue Settlement → ECO-08 Partner Revenue Share → ECO-09 Kunlun Media Local App

建议 ECO-07（延续「登记优先」纪律，禁提现/禁支付接入）：
1. **结算单生成**：ecology_revenue_snapshots（FINALIZED）→ ecology_settlement_statements 登记（period/developerId/gross/revenueShare 快照）
2. **对账依据**：license_events（ACTIVATE/RENEW/EXPIRE）聚合验证快照 subscriptionCount
3. **生态分成登记**：按 ecology_developer_agreements（revenue_share 条款）计算分成比例并留痕（计算登记 ≠ 实际打款）
4. Reality Gate：结算快照 → 对账 → 分成留痕 → 提现仍禁止

## 8. 交付物清单

```
backend/prisma/schema.prisma                           (+2 Marketplace 模型 + installations 扩展)
backend/prisma/migrations/sprint-eco-06-marketplace-foundation/migration.sql
backend/src/ecosystem/marketplace.service.ts           (MarketplaceService：G1-G4 + 快照)
backend/src/routes/ecology-marketplace.routes.ts       (/api/ecosystem/marketplace 10 端点)
backend/src/index.ts                                   (+ECO-06 注册)
backend/scripts/reality-check-eco-06.mjs               (Reality Gate 49 项)
docs/.reality/ECO-06-REALITY-GATE.md                   (本报告)
```

**提交：** SPRINT-ECO-06 Marketplace Foundation — 49/49 Reality Gate PASS（G1 发布权限 + G2 安装授权联动 + G3 卸载保留历史 + G4 未授权不可运行）
