# SPRINT-ECO-08 — Partner Revenue Share Foundation — COMPLETE ✅

**Date:** 2026-08-04 00:30
**Gate:** 掌柜批准（Phase 0 Closure Audit 7/7 通过后进入 Phase 1；ECO-08 为 Phase 1 第一个 Sprint）
**范围（掌柜冻结）：** ✅ 数据模型 ✅ 收益计算规则 ✅ 等级模型 ✅ 结算关系 ｜ ❌ 推广页面 ❌ 邀请系统 ❌ 用户裂变 ❌ 奖励发放（仅 ACCRUED 应计，无 PAID 流程）
**术语（掌柜冻结）：** SaaS Affiliate + Partner Revenue Share（不叫 MLM）

## 核心交付（提交 `待填`）

### 1. 数据模型（4 张新表，全 ecology_partner* 前缀）
- **ecology_partner_level_policies** — 等级配置表（PartnerLevelPolicy：level/minPerformance/rewardRate/effectiveDate/status），6 级种子冻结：
  1 普通推广伙伴 0 / 2 生态推广伙伴 10万(2.5%) / 3 区域生态伙伴 30万(3%) / 4 城市生态伙伴 60万(3.5%) / 5 省级生态伙伴 120万(4%) / 6 平台生态合伙人 300万(5%)
- **ecology_partners** — 伙伴身份（sponsor_partner_id = 团队树边；结算关系数据模型，非邀请系统）
- **ecology_partner_performances** — 业绩快照（period 维度：teamPerformance / maxLinePerformance / smallAreaPerformance / level / rewardRate / accruedReward / detail）
- **ecology_partner_rewards** — 应计分红记录（**ACCRUED 止**，PAID/SETTLED 流程冻结，掌柜冻结）

### 2. 收益计算规则（纯函数，可单测）
- **小区算法**：`smallArea = teamPerformance - max(directLinePerformances)`（掌柜定义：团队总业绩 - 最大业绩线 = 小区业绩）
- **等级判定**：按 min_performance 从高到低取第一个达标（配置驱动，零硬编码）
- **应计分红**：`accruedReward = round(smallArea × rewardRate, 2)`（非实收，REGISTERED 标注）

### 3. 收益来源唯一（掌柜红线）
- `computeTeamPerformance` 聚合 SQL **只 join ecology_settlements**（JOIN ecology_developers 按组织归属）
- **禁止 install/download/register/invite 作为收益依据** —— 已写入代码纪律注释 + Gate 代码审计断言（剥注释检查）
- 金额标注 REGISTERED（未接支付实收 0，诚实不编造，ECO-07 沿用）

### 4. 只读 API（/api/ecosystem/partner/*）
- GET /partner/levels — 等级配置只读
- GET /partner/overview?partnerId= — 伙伴概况（等级名/业绩/应计）
- GET /partner/performance?partnerId=&period= — 业绩快照查询
- POST /partner/performance/refresh — 重算（幂等 upsert，计算动作非推广操作）

## Reality Gate — 31/31 PASS

- **G1** 6 级配置冻结（名称/门槛/比例全断言）
- **G2** 小区算法掌柜示例复现：A 树 B100万/C30万/D20万 → 去最大线 → **小区 = 50万** ✅；无下线 → 小区 = 团队
- **G3** 收益来源唯一：构造真实 FINALIZED settlements 数据，A 团队=150万/最大线=B100万/小区=50万；代码审计剥注释后 install/download/invite 零命中，register 仅 REGISTERED 登记标注
- **G4** 等级分红：A 小区 50万 → 等级 3 区域生态伙伴 → **应计分红 15000**（50万×3%）；B 100万 → 等级 4 → 35000
- **G5** 配置驱动：改 level3 rate 0.03→0.04 → 分红变 20000；还原 → 15000（不写死实证）
- **G6** 零污染：ecology_partner* 恰 4 张；ecology_settlements 12 列原样；ecology 下无 payment/subscription/wallet/order 表
- **G7** 团队树递归：孙辈 E(10万) 计入 → A 团队 160万/小区 60万；D 线 = 自身20万+孙辈10万 = 30万

## 回归

- ECO-04 License 回归 26/28：2 FAIL 为「ecology 表恰 13 张」计数断言过期（现 25 张 = 21+4，生态增长证据），非代码回归
- 全量 ecology 表 25 张（ECO-01~08 累计）

## 关键经验

- **Timestamptz vs Timestamp 坑**：等级配置 effective_date 初版用无时区 TIMESTAMP，种子 now() 按 CST 字面量写入，prisma 按 UTC 比较 → 永远查不到（levels 空数组）。修复：`ALTER COLUMN effective_date TYPE TIMESTAMPTZ USING effective_date AT TIME ZONE 'Asia/Shanghai'` + schema @db.Timestamptz(6)。**新增表的时间比较列一律 Timestamptz**
- **自指误报**：代码审计正则匹配到了「禁止 install/download/register/invite」纪律注释本身 → 剥注释后再审计
- **gate 清理纪律**：deleteMany 用宽前缀（dev_%）会撞其他 sprint 测试数据外键（ECO-05 dev-* 有 APPROVED publish_requests）→ 本次 gate 清理一律精确前缀/精确 ID，绝不宽匹配
- prisma 关系字段必须双向声明（EcologyPartner 缺反向 performances/rewards → P1012），generate 前自查
- 小区算法边界：伙伴只有单条下线且自身无业绩时，team == maxLine → smallArea = 0 → 等级 1（严格符合掌柜公式，非 bug）

## 掌柜红线确认

- ✅ 收益来源唯一 = ecology_settlements（插件订阅真实收入）
- ✅ 分红规则配置表驱动（PartnerLevelPolicy，不写死）
- ✅ 不做邀请系统（sponsor 关系仅结算关系数据模型）
- ✅ 不做奖励发放（rewards 状态止于 ACCRUED）
- ✅ 零污染（只新增 ecology_partner* 表 + 生态服务/路由 + index.ts 注册行）

## 下一步（掌柜路线）

ECO-09 应用中心导航入口（首页导航社区后加应用中心，只展示）→ ECO-10 Plugin Marketplace Discovery MVP → ECO-11 新媒体 Local App 试点

报告：docs/reality/ECO-08-PARTNER-REVENUE-SHARE-01.md ｜ 脚本 scripts/reality-check-eco-08.mjs
