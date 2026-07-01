# ADR-020 — Brand Domain Model Engineering Decisions

**日期**: 2026-07-01  
**状态**: 已接受  
**关联文档**: [P2_BRAND_DOMAIN_FREEZE.md](../../product/P2_BRAND_DOMAIN_FREEZE.md)  
**提出者**: 熊大  

---

## 背景

Brand Domain Freeze v2 已通过评审并冻结。在评审中提出了 9 条工程化建议，这些建议不在冻结文档正文中体现（保持冻结文档简洁），但作为 ADR 记录决策上下文，供 Prisma 模型和后续 Phase 参考。

---

## 决策 1 — Brand slug

**建议**: 增加 `slug` 字段作为品牌稳定标识符。

**决策**: **在 Prisma 模型中增加**，Phase 1 实施。
- `slug` 从 `name` 自动生成（小写 + 连字符），允许手动覆盖
- 唯一约束
- 用途：URL `/workspace/geo/brand/{slug}`、API、SEO

---

## 决策 2 — Website 拆分为主域名 + 额外域名

**建议**: `primaryDomain` + `additionalDomains[]`。

**决策**: **采纳**。Phase 1 在 `GEOBrand` 模型中实现。
- `primaryDomain`: string (required)
- `additionalDomains`: string[] (optional JSON)
- 后续可扩展为 `BrandDomain` 独立表（当有域名健康检测时）

---

## 决策 3 — Knowledge Source 状态

**建议**: 将 `isActive` 升级为 `status: pending | verified | error | disabled`。

**决策**: **采纳**。Phase 1 Prisma 模型直接使用 `status` 而非 `isActive`。
- `pending`: 新增未验证
- `verified`: 可正常访问
- `error`: 扫描返回错误
- `disabled`: 手动禁用

---

## 决策 4 — Brand Owner

**建议**: 增加 `ownerId` 和 `organizationId`。

**决策**: **暂不实施**，Prisma 模型**预留注释**，当前不加入字段。
- 当前 GEO 无多用户体系
- 预留方式：在 `GEOBrand` 模型中添加 `// TODO: ownerId + organizationId for enterprise` 注释
- 企业版时通过 Migration 增加

---

## 决策 5 — Project Brand Snapshot

**建议**: Project 增加 `brandSnapshot` (JSON) 保存创建时的 Brand 完整数据。

**决策**: **采纳**。Phase 1 在 `GEOProject` 模型中增加。
- `brandVersion`: int (记录版本号)
- `brandSnapshot`: JSON (记录创建时的完整 Brand 数据)
- 作用：Brand 变更后，历史 Project 仍保留当时的数据，Report/Verification 不受影响

---

## 决策 6 — Completeness Required vs Recommended

**建议**: 将字段区分为 Required 和 Recommended。

**决策**: **采纳**。在 Completeness 计算引擎中实现，不在 Prisma 模型中。
- 区分标准：Website / Description / Knowledge Sources (≥1) = Required，其余为 Recommended
- Dashboard 展示时分别标注

---

## 决策 7 — Workflow Trigger

**建议**: Project 增加 `trigger` 字段标明创建原因。

**决策**: **采纳**。Phase 1 在 `GEOProject` 模型中增加。
- 类型: `manual | scheduled | monitoring_alert | api_import`
- 默认: `manual`
- RC4 时 `monitoring_alert` 和 `scheduled` 正式启用

---

## 决策 8 — Goal KPI

**建议**: Goal 增加 `target` 和 `current` 指标字段。

**决策**: **暂不实施**，在 BrandGoal 接口中预留注释。
- `target`: number | undefined (如 20% 提升)
- `current`: number | undefined (当前值)
- Phase 2 (真实数据接入后) 通过 Migration 或 JSON 扩展支持

---

## 决策 9 — Architecture Constraints

**建议**: 增加不可变约束规则。

**决策**: **采纳**。约束规则写入本文档，作为所有 GEO 开发的架构约束：

### 不可变约束

1. **Brand 是唯一长期业务实体。** 任何模块不得绕过 Brand 直接操作数据。
2. **Project 永远是 Brand 的一次优化周期。** Project 不能脱离 Brand 独立存在。
3. **Workflow 不允许脱离 Brand 和 Project 独立存在。** 没有 Brand 就没有 Workflow。
4. **任何新模块（Discovery、Verification、Publishing、Monitoring）都必须依赖 Brand**，而不是直接依赖 Project。Project 是 Brand 的衍生实体。
5. **BrandSnapshot 是验证的真相源。** Report 和 Verification 依赖 Project 创建时的 snapshot，而非实时 Brand 数据。

---

## 实施影响

| 决策 | Phase | 影响范围 |
|------|-------|----------|
| ① slug | Phase 1 | GEOBrand 模型新增列 |
| ② primaryDomain + additionalDomains | Phase 1 | GEOBrand 模型变更 |
| ③ KnowledgeSource status | Phase 1 | GEOKnowledgeSource 模型变更 |
| ④ Owner 预留 | - | 仅注释 |
| ⑤ brandSnapshot | Phase 1 | GEOProject 模型新增列 |
| ⑥ Required/Recommended | Phase 2 | Completeness 计算 |
| ⑦ trigger | Phase 1 | GEOProject 模型新增列 |
| ⑧ Goal KPI 预留 | - | 仅类型注释 |
| ⑨ 架构约束 | 立即生效 | 所有 GEO 开发 |
