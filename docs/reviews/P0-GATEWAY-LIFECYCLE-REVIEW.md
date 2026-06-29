# P0-Gateway Lifecycle Review

> **文档版本**: v1.0  
> **审查日期**: 2026-07-17  
> **审查范围**: 仅 `p0-gateway` 模块  
> **结论**: **DEPRECATE** — 进入 Batch 3 候选

---

## 审查矩阵

| 问题 | 结论 | 证据 |
|------|------|------|
| 谁在调用 6 个 API？ | **无人调用（生产不可达）** | `p0-gateway-route.ts` 未在 `index.ts` 中注册，所有 endpoint 返回 404 |
| 4 个页面谁访问？ | **用户不可达（Nav 已隐藏）** | `KunlunNav.vue` 中的 `/p0/life-assistant` 入口已被注释，标注 `@deprecated 生活助手 — V4.2 业务废弃` |
| Decision Runtime 是否必须依赖？ | **否** | p0-gateway 是 Decision Runtime 的消费者，而非生产管线依赖；去掉 gateway 不影响其他模块 |
| 是否有 Feature Flag？ | **无** | `feature-flags.ts` 中无 p0 相关 flag |
| 是否有替代实现？ | **不适用** | 模块本身未被挂载，不存在替代问题 |
| 是否属于平台能力？ | **否** | 这是一个产品原型（生活助手），非平台基础设施 |
| 是否还能新增功能？ | **否** | 业务已在 V4.2 明确废弃 |
| 相关 DB 表是否活跃？ | **否** | `AiFallbackRule`: 0 行；`LicenseCache`: 0 行 |
| 外部模块依赖？ | **无** | 除 `p0-gateway-route.ts` 自身外，无任何模块 import 它 |

---

## 生命周期结论

**DEPRECATE** — 建议纳入 Batch 3 收敛（与 P18、V3 同批次）

### 判定依据

1. **生产不可达** — API 路由未注册，前端 Nav 已隐藏，DB 无数据
2. **业务已废弃** — V4.2 已明确标注业务退出
3. **零外部依赖** — 移除不会影响其他模块
4. **代码体量适中** — 后端 505 行 + 前端 4 页（约 800 行）+ 4 个 DB 表（2 张空表, `LicenseCache` 和 `AiFallbackRule`）

### 与 Pangu 的关键区别

原疑虑是"它像 Pangu（有活跃 API 和运行时依赖）"，但实际审查发现截然不同：
- Pangu → 有活跃的中台工作流依赖它
- p0-gateway → 从未被激活，无任何生产流量

---

## 收敛范围

| 类型 | 数量 | 说明 |
|------|------|------|
| 后端路由 | 1 个 | `backend/src/routes/p0-gateway-route.ts` |
| 决策运行时 | 14 个文件 | `backend/src/decision-runtime/p0/` 目录 |
| 前端页面 | 4 个 | `frontend/pages/p0/*.vue` |
| Prisma 表 | 2 张 | `AiFallbackRule`, `LicenseCache`（均为空, 可安全 Drop） |
| DB 迁移 | 2 个 | Drop Table 迁移 |
| 代码行 | ~3,000 | 后端 ~1,800 + 前端 ~1,200 |

### 建议收敛方式

1. 将代码移入 `archive/` 而不直接删除（保留 git tag 可恢复）
2. Drop 空表：`AiFallbackRule`, `LicenseCache`（确认无数据后执行 `DROP TABLE`）
3. 清理前端路由（删除 pages/p0/ 下的页面引用或移动至 `archive/`）
4. 无需修改 `index.ts`（当前未注册该路由）

### 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 误判生产依赖 | 低 | 已在生产环境验证 404 |
| DB 数据丢失 | 无 | 两张表均为空 |
| 代码恢复困难 | 低 | 保留 git tag + archive/ 目录 |

---

## 后续步骤

1. ✅ 本次 Lifecycle Review 确认 DEPRECATE
2. ➡️ 纳入 Batch 3 第一候选（与 P18、V3 同级）
3. ➡️ 在 Batch 3 执行时统一归档
