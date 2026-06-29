# PHASE 0 — Integration Sprint (2026-07-18)

**Status:** COMPLETE

## Deliverables

### 0.1 ✅ 唯一入口
- **首页导航 `KunlunNav.vue`** 已有 `/workspace/geo` 入口，指向唯一路由
- 全站搜索确认**只有一个** GEO 入口：`pages/workspace/geo.vue`
- 旧入口 `modules/geo/pages/` 已标记 DEPRECATED，不参与运行

### 0.2 ✅ 认证统一
- **前端**：`pages/workspace/geo.vue` 已添加 `definePageMeta({ middleware: 'auth' })`
- **后端**：全部 4 个 GEO 路由文件已添加 `preHandler: [fastify.authenticate]`
  - `geo-project.route.ts` — 7 个 handler
  - `geo-entity.route.ts` — 7 个 handler
  - `geo-graph.route.ts` — 6 个 handler
  - `geo-knowledge-quality.route.ts` — 2 个 handler
- 认证来源统一为 `request.user`（从 JWT 解析），不再允许 `body.userId` 或 `query.tenantId` 绕过

### 0.3 ✅ Legacy 清理
- `frontend/modules/geo/`（12 个文件）已标记 DEPRECATED
- 确认**零运行时引用** — 全站 grep 无任何 `import from modules/geo`
- `backend/src/services/geo/` 的活动路由全部保留（有认证保护）
- `backend/src/decision-runtime/evaluation/geometry-*.ts` 与 GEO 无关，保留

### 0.4 ✅ 数据模型冻结
- `docs/reviews/DATA-MODEL-FREEZE.md` 已写入
- 冻结规则：
  - ❌ 不新增 GEO 表
  - ❌ 不新增 GEO 字段
  - ❌ 不新增 Claim/Evidence/Knowledge 实体
  - ❌ 不扩展 Prisma schema 中的 GEO 部分
- 冻结在 Phase 1 完成后解除

## 验收 Gate

| # | 条件 | 结果 |
|---|------|------|
| 1 | 唯一入口：全站只有一个 GEO 入口 | ✅ |
| 2 | 统一认证：页面+API+SSR 三层均挂 auth | ✅ |
| 3 | Legacy 清理：modules/geo 不参与运行 | ✅ |
| 4 | 数据模型冻结：无新增 GEO 表/字段 | ✅ |

**Phase 0 通过。允许进入 Phase 1（Tenant + Project Center）。**
