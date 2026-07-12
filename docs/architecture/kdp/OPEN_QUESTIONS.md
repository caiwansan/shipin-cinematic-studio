# Knowledge Package Spec v1.0 — Open Questions

**关联**: `KNOWLEDGE_PACKAGE_SPEC_V1.md`
**状态**: DRAFT — Gate 1 未决问题
**日期**: 2026-07-22

---

## Q1: Package 粒度 — 全量 vs 增量？

**问题**: 一个 Package 应该包含实体的完整知识状态，还是仅包含本次变更的增量？

| 维度 | 全量 | 增量 |
|------|------|------|
| 实现复杂度 | 低 | 高 |
| 带宽消耗 | 高 | 低 |
| 客户端合并 | 不需要 | 需要 |
| 调试难度 | 低 | 高 |
| 回溯历史 | 简单（每个版本独立） | 复杂（需逐层合并） |

**建议**: 全量优先，后续可扩展增量支持。
**决策人**: 架构负责人

---

## Q2: Package 嵌套 — 扁平 vs 嵌套？

**问题**: 一个 Package 能否引用或包含另一个 Package？

- **扁平 + 依赖引用**: 通过 `manifest.dependencies` 声明依赖关系
- **嵌套**: Package 可以嵌套包含子 Package

**风险**: 嵌套可能导致循环依赖和无限递归的序列化。
**建议**: 扁平 + 依赖引用。
**决策人**: 架构负责人

---

## Q3: Evidence 数量与内容长度限制？

**问题**: 是否需要限制一个 Package 中 Evidence 的数量或单条内容长度？

- **不限制**: 可能导致包体积过大
- **设限制**: 需要确定合理阈值

**建议**: 暂不设硬限制，但推荐 ≤100 条 Evidence，单条 ≤10KB。
**决策人**: 开发团队（可根据实际数据调整）

---

## Q4: 多语言策略？

**问题**: 同一实体在不同语言下的 Knowledge Package 如何管理？

| 选项 | 优势 | 劣势 |
|------|------|------|
| **同包异语言** | 管理简单 | 包体积大 |
| **按语言拆包** | 体积小，语言独立 | 关联维护复杂 |

**建议**: 先支持单语言（zh-CN），多语言在 v1.1 中定义。
**决策人**: 产品负责人

---

## Q5: AI Response 可作为 Evidence？

**问题**: AI 模型的回答能否作为 Claim 的证据？

**风险**: AI 可能产生幻觉，用 AI 回答去"验证"AI 可读的知识存在循环论证风险。
**建议**: 允许但 trustLevel 自动降级为 LOW，且必须记录 AI 模型名称+版本。不可作为唯一证据。
**决策人**: 产品 + 架构负责人

---

## Q6: 历史版本自动清理？

**问题**: 是否需要自动清理非常旧的 Package 版本？

**建议**: 保留所有历史版本。版本存储成本低，删除后无法追溯。如后续存储压力大，可引入 TTL 策略。
**决策人**: 开发团队

---

## Q7: 多 Adapter 并发发布冲突？

**问题**: 多个 Distribution 同时发布到同一目标渠道（如同一个 CMS），如何处理冲突？

**建议**: `@@unique([packageId, target])` 保证幂等。最后写入者胜出，但所有操作写入 Distribution Log 供审计。
**决策人**: 架构负责人

---

## Q8: Package 如何与现有 Prisma Schema 映射？

**问题**: Knowledge Package 的 TypeScript 类型和数据库表之间可能的映射关系？

**建议**: 
- 核心字段（id, version, status, entityId）作为表字段
- 扩展内容（claims, evidences, citations）存储为 JSON 字段
- 不拆成大量关联表以便于 Package 的序列化/反序列化

**决策人**: 开发团队

---

## Q9: 验证引擎与 KP Spec 的集成点？

**问题**: 现有 GEO V4 Verification Engine（GeoScorer / OptimizationExecution / VerificationJob）如何与 Knowledge Package 的 Verification Contract 对接？

**建议**: 
- Package 的 Verification Status 由现有 Verification Engine 更新
- Package 的 `verification.checksum` 在每次验证通过后刷新
- 避免重复造轮子，复用现有验证能力

**决策人**: 架构负责人
