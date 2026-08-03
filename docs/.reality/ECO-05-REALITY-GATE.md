# ECO-05-REALITY-GATE.md — Developer Center Foundation

> **SPRINT-ECO-05 完成报告** | 日期：2026-08-04 01:10 | 状态：✅ PASS（46/46）
> 掌柜批准（2026-08-03 22:28）：ECO-05 Developer Center Foundation——只建设「开发者身份 + 插件发布基础」；
> 禁止开发者商城 / 收益提现 / 推广系统 / 审核后台 UI（后置到 Marketplace / Revenue Settlement / Partner 阶段）

---

## 1. 数据模型（掌柜指定，纯新增 3 表）

### ecology_developers（开发者身份）

| 字段 | 类型 | 说明 |
|------|------|------|
| developer_id | VARCHAR(64) UNIQUE | 公开开发者 ID（`dev-xxxxxxxx`），**ecology_plugins.author 引用此值** |
| user_id | TEXT UNIQUE | 平台 User.id（一用户一开发者） |
| organization_id | TEXT | 归属组织（G8 隔离语义延续） |
| developer_name | VARCHAR(100) | 开发者名称 |
| status | VARCHAR(20) | **CREATED \| VERIFIED \| SUSPENDED（掌柜冻结）** |

### ecology_plugin_publish_requests（插件发布申请）

| 字段 | 类型 | 说明 |
|------|------|------|
| plugin_id | TEXT FK | ecology_plugins.id（CASCADE） |
| version_id | TEXT FK | ecology_plugin_versions.id（CASCADE） |
| developer_id | TEXT FK | ecology_developers.id（RESTRICT） |
| status | VARCHAR(20) | **DRAFT \| SUBMITTED \| APPROVED \| REJECTED（掌柜冻结）** |
| review_note / reviewed_by / reviewed_at | — | 审核意见留痕（不做审核 UI，仅登记） |

唯一约束 `(plugin_id, version_id)`：一个版本一个发布申请（G3 防恶意覆盖）

### ecology_developer_agreements（开发者协议记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| developer_id | TEXT FK | 归属开发者 |
| agreement_type | VARCHAR(30) | developer_terms \| revenue_share \| ip_ownership \| plugin_liability |
| version / content | — | 协议版本 + 条款摘要（分成 / IP / 插件责任留痕） |
| signed_at / status | — | SIGNED \| REVOKED |

唯一约束 `(developer_id, agreement_type, version)`：幂等签署

## 2. 业务链路（掌柜目标：Developer → Plugin Author → Plugin Version → Review Status → Marketplace Ready）

```
开发者注册(CREATED) → 签署协议(留痕) → 验证(VERIFIED)
    → 注册插件(author=developerId) → 创建发布申请(DRAFT)
    → 提交(SUBMITTED) ← G2 权限交集校验
    → 审批(APPROVED) → 插件 PUBLISHED（Marketplace Ready 登记）
    → 驳回(REJECTED) ← 意见留痕
```

## 3. 三个 Reality Gate（掌柜指定）

### G1 Author Ownership — 开发者 A 不能修改开发者 B 的插件
- 所有开发者侧操作（建发布申请/提交）强制校验 `plugin.author === developer.developerId`
- devB 操作 devA 插件 → `403 AUTHOR_MISMATCH` ✅
- SUSPENDED 开发者不可操作插件（`DEVELOPER_SUSPENDED`）

### G2 Permission Intersection — 声明 ∩ 开发者允许 ∩ 平台白名单
```
三层交集校验（发布提交前强制）：
  1. Plugin Manifest permissions（插件声明，ECO-02 枚举已过 zod 校验）
  2. Developer Allowed Permissions（身份分级）：
       VERIFIED → 全量白名单（KNOWN_PERMISSIONS 6 项）
       CREATED  → 基础集 [content, analytics]
       SUSPENDED→ 空
  3. Platform Allowed（KNOWN_PERMISSIONS：ECO-02 白名单 SSOT，注释「未来扩展只改这里」）
交集为空 → 拒绝发布（PERMISSION_OUT_OF_SCOPE）
```
- devA(VERIFIED) browser → allowed ✅ / devB(CREATED) browser → 拒绝 ✅ / devB(CREATED) content → 通过 ✅
- manifest 枚举外权限（root）→ 注册层 zod 拒绝（第一道防线）✅

### G3 Version Ownership — (plugin-id + version + author) 唯一，防恶意覆盖
- 跨插件挂版本 → `403 VERSION_MISMATCH` ✅
- `(plugin_id, version_id)` DB 唯一约束兜底 + API 幂等 ✅
- 同 author 独立新插件 → 新记录，不覆盖 ✅

## 4. API（/api/ecosystem/developer，13 端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /developer/register | 注册（CREATED，userId/org 从 JWT） |
| GET | /developer/mine | 当前用户开发者 |
| GET | /developer/:developerId | 按公开 ID 查询 |
| POST | /developer/:developerId/verify | CREATED→VERIFIED |
| POST | /developer/:developerId/suspend | →SUSPENDED |
| POST | /developer/:developerId/agreements | 签署协议（幂等） |
| GET | /developer/:developerId/agreements | 协议记录 |
| POST | /developer/publish-requests | 创建发布申请（DRAFT） |
| GET | /developer/publish-requests | 申请列表（仅本人） |
| POST | /developer/publish-requests/:id/submit | DRAFT→SUBMITTED（G2 校验） |
| POST | /developer/publish-requests/:id/approve | →APPROVED（插件→PUBLISHED） |
| POST | /developer/publish-requests/:id/reject | →REJECTED（意见留痕） |
| POST | /developer/permission-check | G2 交集预览（不落库） |

## 5. Reality Gate 结果（46/46 PASS）

| Gate | 验证内容 | 结果 |
|------|---------|:----:|
| 准备 | devA/devB 注册、协议留痕（分成+责任）、列表、验证 | ✅ 10/10 |
| **G1** | **Author Ownership** | ✅ 4/4 |
| **G3** | **Version Ownership** | ✅ 3/3 |
| **G2** | **Permission Intersection** | ✅ 13/13 |
| 回归 | ECO-04 G1-G6（23 agents/overview/workflow/runtime-health/16 表/零商业改动/生态层新增） | ✅ 10/10 |
| 回归 | G7/G8（License 授权链路不受影响） | ✅ 4/4 |
| 回滚 | DROP 3 新表→13 张（无依赖）→重建幂等→唯一约束保留→恢复现场 | ✅ 4/4 |

## 6. 纪律遵守确认

- ✅ 只新增 ecology 3 表（ecology 13 → 16 张）；迁移 SQL 只建 ecology_developer* 表
- ✅ 零修改：PaymentOrder/Subscription/User/Organization/Agent/Hermes 全未碰
- ✅ 不做开发者商城 / 不做收益提现 / 不做推广系统 / 不做审核后台 UI（APPROVED/REJECTED 仅登记留痕）
- ✅ 不碰支付 / 不碰 Hermes / 不碰工作台
- ✅ 协议留痕先行（分成/IP/插件责任——未来 Revenue Settlement 的依据）

## 7. 生态生产链进度

```
ECO-01 Application ✅ → ECO-02 Plugin ✅ → ECO-03 Runtime ✅
→ ECO-04 License ✅ → ECO-05 Developer ✅ → Marketplace ⏳ → Revenue ⏳ → Partner ⏳ → Local App ⏳
```

**昆仑镜已具备：开发者生产 AI 员工 → 发布插件 → 用户订阅 → 授权运行 的第一条生态生产链**

## 8. 下一阶段 ECO-06 建议

掌柜路线图：Marketplace（商城）→ Revenue Settlement → Partner System → Kunlun Media Local App

建议 ECO-06 Marketplace（延续「登记优先」纪律，禁支付/禁 UI 商城）：
1. **上架登记**：APPROVED 插件 → ecology_marketplace_listings 登记（price/currency 展示登记，不接支付）
2. **安装-授权联动**：商城安装 → ecology_plugin_installations + ecology_licenses 联动（试用/订阅登记）
3. **开发者结算对账**：license_events（ACTIVATE/RENEW）→ 按 developer 维度聚合结算快照（纯登记，不提现）
4. Reality Gate：G1-G3 回归 + 安装→授权→校验闭环 + 结算对账隔离

## 9. 交付物清单

```
backend/prisma/schema.prisma                           (+3 Developer 模型)
backend/prisma/migrations/sprint-eco-05-developer-center-foundation/migration.sql
backend/src/ecosystem/developer.service.ts             (DeveloperService：G1/G2/G3 + 状态机 + 协议留痕)
backend/src/routes/ecology-developer.routes.ts         (/api/ecosystem/developer 13 端点)
backend/src/index.ts                                   (+ECO-05 注册)
backend/scripts/reality-check-eco-05.mjs               (Reality Gate 46 项)
docs/.reality/ECO-05-REALITY-GATE.md                   (本报告)
```

**提交：** SPRINT-ECO-05 Developer Center Foundation — 46/46 Reality Gate PASS（G1 作者归属 + G2 权限交集 + G3 版本归属）
