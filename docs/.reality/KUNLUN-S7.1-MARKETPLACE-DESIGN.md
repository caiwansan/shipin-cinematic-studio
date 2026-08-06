# KUNLUN-S7.1-MARKETPLACE-DESIGN.md

> S7.1 AI Employee Marketplace — Phase A Design Freeze
> 日期: 2026-08-06 16:50 (CST) | 状态: ✅ **审计完成 + 设计冻结, 待掌柜批准 S7.2 MVP**
> 依据: 掌柜 S7.1 指令（Marketplace 前置设计; Windows RG 并行; 用户从「购买功能」转向「购买员工」）
> 定位: **Marketplace = 商品展示层（不是执行层/不是 Runtime/不是权限层）; Internal Curated, 不扩张风险**

---

## 0. 审计结论（实证）

| 项 | 现状 |
|---|---|
| Employee 商品目录 | 17 active def: **4 商品员工**（Alice 招聘/短剧导演/新媒体/法务）+ 13 组件/test |
| Plugin 商品目录 | 70: 30 PUBLISHED + 40 REGISTERED —— **审核语义天然存在**（REGISTERED=待审, PUBLISHED=上架, DEPRECATED=退役） |
| AgentDefinition 审核态 | status: active/deprecated/disabled（无 draft/review）→ 需语义映射（见 §3） |
| Desktop 消费路径 | 商品卡（目录全量）+ 详情（skills/entitlement/usage/enhancements 4 API）已通; 缺分类/搜索/推荐/审核态展示 |
| 分类先例 | ecology-applications 有 category 字段 |

## 1. 商品模型（冻结: 组合视图, 零新表）

```
AI Employee 商品 = AgentDefinition + Capability + Skill 组件
  + Enhancement（EcologyPlugin.manifest.enhancements, 有授权才展示）
  + Entitlement 状态（企业拥有/未拥有）
  + Usage 摘要（执行/成功/失败）
组合视图 API（S7.2 新增只读）: GET /api/marketplace/employees（列表）+ /:code（详情）
```

## 2. 分类与推荐（规则版, 非算法）

```
分类（按企业部门）:
  人力: Alice 招聘       内容: 短剧导演
  营销: 新媒体运营       风险: 法务合同
  财务: （第五员工候选: financial.report / expense.analysis / business.insight）
推荐规则（S7.2）:
  ① 已授权员工优先 ② 部门分类匹配 ③ 增强包数量排序 ④ 最近使用
```

## 3. 审核机制（Internal Curated Marketplace, 冻结）

```
平台审核（不开放开发者上传）:
  AgentDefinition.status 语义映射（零新表）:
    draft        = 草稿（未上架, 不进目录 API）
    active       = Published（上架）
    disabled     = 下架（目录隐藏）
    deprecated   = Retired（退役）
  Plugin 审核: 既有 REGISTERED→PUBLISHED→DEPRECATED 语义保持
  S7.2 目录 API 只返回 active（员工）+ PUBLISHED（插件）
```

## 4. Desktop 消费路径（S7.2 升级）

```
Marketplace 区块（新增 nav 或升级员工区块）:
  商品列表（分类 tab + 搜索框 + 推荐排序）
  → 商品详情页（头像/名称/岗位/价值一句话/适合部门/能力/增强/使用案例/Seat 与用量估计）
  → 授权状态（已拥有 → 启动; 未拥有 → 「需购买」（入口冻结））
数据: 全部 Cloud（marketplace API + 既有 4 API）, Desktop 零本地逻辑
```

## 5. 边界（冻结确认）

✅ 允许: 只读 marketplace API / 分类搜索推荐（规则版）/ 审核状态展示
❌ 禁止: 支付 / 订单 / 分销 / 开放开发者上传 / 推荐算法黑盒 / 新 Runtime / 权限层改动 / 数据迁移

## 6. S7.2 MVP 范围（待批准）

```
1. GET /api/marketplace/employees（列表: 分类/搜索/推荐排序/审核态过滤）
2. GET /api/marketplace/employees/:code（详情: 商品五要素 + 使用案例 + Seat/用量估计）
3. Desktop Marketplace 视图（列表 + 详情 + 授权态; 启动复用）
4. MT1-MT6 Reality Gate（列表/详情/分类搜索/推荐/审核过滤/四员工回归）
```

## 7. 结论

```
Marketplace Phase A 冻结 ✅
Marketplace = 商品展示层（组合视图零新表, Internal Curated 不扩张风险）
→ 用户从「购买功能」转向「购买员工」
→ 待掌柜批准 S7.2 MVP（Windows RG 并行）
```
