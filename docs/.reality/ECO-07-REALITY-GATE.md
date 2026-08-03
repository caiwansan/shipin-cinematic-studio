# ECO-07-REALITY-GATE.md — Revenue Settlement Foundation

> **SPRINT-ECO-07 完成报告** | 日期：2026-08-04 02:50 | 状态：✅ PASS（46/46）
> 掌柜批准（2026-08-03 23:00）：ECO-07 Revenue Settlement Foundation——**收入计算基础设施**，不是财务系统。
> 允许：收入快照确认 / 插件订阅收入归属 / 开发者分成计算模型 / 平台收入记录；禁止：提现 / 钱包 / 支付改造 / 推广奖励 / 银行接口。

---

## 1. 核心链（掌柜指定）

```
License → License Events → Revenue Snapshot → Settlement Record → Developer Share
```

## 2. 数据模型（只新增 ecology_*，零商业系统改动；ecology 18 → 21 张）

**ecology_revenue_share_policies（分成规则配置化，不写死）**

| 字段 | 说明 |
|------|------|
| developer_id | NULL = 平台默认策略（种子 70/30，配置数据可管理） |
| plugin_id UNIQUE | NULL = 开发者级默认；非 NULL 必须带 developer_id（插件级） |
| developer_rate / platform_rate | 0-1，之和必须 = 1（服务层强校验） |
| status | ACTIVE / DISABLED |

**策略解析优先级（G1）：** 插件级 > 开发者级 > 平台默认；平台默认缺失 → 0/0 + `MISSING_DEFAULT_POLICY` 标注（绝不静默用代码写死比例）

**ecology_settlements（掌柜字段全落地）**

| 字段 | 说明 |
|------|------|
| period + plugin_id UNIQUE | 一插件一周期一条结算 |
| developer_id | 收入归属（上架者） |
| gross_amount | **应计收入** = 单价登记 × 许可数（REGISTERED 语义，未接支付非实收） |
| developer_amount / platform_amount | 分成计算结果（策略解析） |
| status | DRAFT → CONFIRMED → FINALIZED（不可回退） |
| detail JSONB | 对账结果 / 策略来源 / 单价来源（全留痕） |

**ecology_settlement_items（逐许可可追溯）**

| 字段 | 说明 |
|------|------|
| settlement_id + license_id | 每条明细对应一个真实 License（G2 可追溯） |
| amount / source | LICENSE_EVENT（逐许可）\| SNAPSHOT（无事件汇总） |

**扩展：** ecology_marketplace_items.price（订阅单价登记，应计收入计算依据；ECO-06 未加，ECO-07 补）

## 3. 五个 Reality Gate（掌柜 G 系列，46/46 PASS）

### G1 配置化分成 ✅
- 平台默认 70/30（种子配置）→ devA 开发者级 80/20 → 插件 B 插件级 90/10 逐级覆盖
- 非法比例（1.5）/ 比例之和 ≠1 → `INVALID_RATE` 拒绝
- **插件 A 按 80% 分：dev=160/platform=40；插件 B 按插件级 90% 分：dev=45/platform=5**（不同插件不同协议实证）

### G2 结算可追溯 ✅
- settlement → items → licenseId → license_events 全链路可查
- items 来源标注 LICENSE_EVENT，逐许可明细

### G3 对账一致性 ✅
- 对账报告：快照 subscriptionCount（2）vs 周期内 license_events 去重许可数（2）→ match
- Σitems.amount = grossAmount；developerAmount + platformAmount = grossAmount（金额闭环）

### G4 结算状态机 ✅
- DRAFT → CONFIRMED → FINALIZED；重复 confirm/finalize → 拒绝；DRAFT 直接 finalize → 拒绝
- 同周期重复 settle → 幂等不覆盖

### G5 平台收入记录 ✅
- platformAmount 独立可查（API 开发者隔离视角 = DB 同口径聚合）
- detail.note = REGISTERED（未接支付实收 0，诚实标注）
- 开发者隔离：组织 B 视角仅见 devB 插件结算

## 4. API（/api/ecosystem/settlements，8 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | /policies | G1 分成规则配置（配置化） |
| GET | /policies | 策略列表（含 level 解析） |
| POST | /settle | 生成周期结算（快照确认 + 对账 + 分成 + 落库） |
| GET | /reconcile?period= | 对账报告 |
| GET | /settlements?period=&status= | 结算列表（开发者隔离） |
| GET | /settlements/:id | 详情 + items 可追溯 |
| POST | /settlements/:id/confirm | DRAFT → CONFIRMED |
| POST | /settlements/:id/finalize | CONFIRMED → FINALIZED |

## 5. 回归与纪律

- ✅ ECO-01~06 全回归：License / Marketplace / Developer / runtime-health 正常
- ✅ ecology 18 → 21 张；Payment/Subscription/Commerce/钱包/提现/银行 零改动
- ✅ 回滚验证：DROP 3 新表 + 还原 price 列 → 18 张 → 重建幂等（21 张 + 种子 + 唯一索引）→ 恢复现场重结算

## 6. 生态闭环全景（ECO-01 → ECO-07）

```
开发者注册 → 插件生产 → 发布审批 → 应用市场登记定价
      → 用户安装 → License 授权 → KAOR 运行
      → 收入快照 → 对账 → 结算记录 → 开发者分成（配置化）
```

**昆仑镜第一次具备：插件从生产到收入归属的完整商业数据链**

## 7. 下一阶段

掌柜路线图：ECO-08 Partner Revenue Share → ECO-09 Application Center UI → ECO-10 Kunlun Media Local App；产品任务 ECO-NAV-01（首页导航「应用中心」入口，只读展示）已记录待排期。

ECO-08 设计提示（掌柜已定调）：
- 推广分佣必须基于**真实插件订阅收入**（ECO-07 settlements 数据），禁止基于注册量/安装量/虚假市场数据
- 新增 ecology_partners / ecology_partner_commissions（partner 归属 + 佣金按结算分成比例计算留痕）
- 继续禁提现/禁钱包/禁支付改造

## 8. 交付物清单

```
backend/prisma/schema.prisma                          (+3 模型 + marketplace_items.price)
backend/prisma/migrations/sprint-eco-07-revenue-settlement-foundation/migration.sql
backend/src/ecosystem/settlement.service.ts           (RevenueSettlementService：G1-G5)
backend/src/routes/ecology-settlement.routes.ts       (/api/ecosystem/settlements 8 端点)
backend/src/index.ts                                  (+ECO-07 注册)
backend/scripts/reality-check-eco-07.mjs              (Reality Gate 46 项)
docs/.reality/ECO-07-REALITY-GATE.md                  (本报告)
```

**提交：** SPRINT-ECO-07 Revenue Settlement Foundation — 46/46 Reality Gate PASS（G1 配置化分成 + G2 可追溯 + G3 对账一致 + G4 状态机 + G5 平台收入记录）
