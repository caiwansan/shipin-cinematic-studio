# ECO-01-REALITY-GATE.md — Application Adapter Layer

> **SPRINT-ECO-01 完成报告** | 日期：2026-08-03 22:05 | 状态：✅ PASS（20/20）
> 技术总监批准开发（2026-08-03 21:52）：增量开发、零破坏、零迁移、零重构

---

## 1. 数据表变化（纯新增 4 表，现有 461 表零修改）

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `ecology_applications` | 应用身份注册 | slug(unique) / category / is_platform_built_in / status(BUILT_IN) / lifecycle_state(ACTIVE) / workspace_entry / metadata(能力+权限声明) |
| `ecology_application_versions` | 应用版本 | application_id+version(unique) / manifest(能力快照) / status(released) |
| `ecology_application_installations` | 组织安装 | organization_id+application_id(unique) / status / lifecycle_state |
| `ecology_application_permissions` | 应用权限 | install_id / permission / status |

- 迁移方式：手写 SQL（`prisma/migrations/sprint-eco-01-application-adapter/migration.sql`）+ `prisma db execute` 双通道（团队模式经验），未碰 `prisma migrate dev`
- 存量回填：9 内置应用 seed（幂等 upsert，slug 唯一键）
- **G6 验证：ecology_* 恰 4 张，其余 461+ 表零结构变更**

## 2. API 变化（新增 /api/ecosystem 前缀，5 端点）

| 方法 | 路径 | 说明 | 验证 |
|------|------|------|:----:|
| GET | /api/ecosystem/applications | 应用目录（含组织安装状态） | ✅ 200, 9 应用 |
| GET | /api/ecosystem/applications/:slug | 应用详情（含版本历史） | ✅ 200 + 404 正确 |
| POST | /api/ecosystem/applications/:slug/install | 组织安装（幂等） | ✅ reused=true 幂等 |
| GET | /api/ecosystem/health | 生态层健康检查 | ✅ 200 |
| — | 启动 seed | 内置应用幂等注册 | ✅ 9 新增→0 跳过 |

- 全部走 `app.authenticate` JWT；组织归属复用现有 resolveOrgId 链（JWT organizationId 优先）

## 3. 前端变化（新增 1 页，零改动现有页面）

- `frontend/pages/ecosystem/applications.vue` — 应用中心（只读）
  - 9 应用卡片：图标/名称/slug/版本/分类/生命周期/能力声明/权限清单/入口/安装按钮
  - 独立路由 `/ecosystem/applications`，默认布局，不触碰任何工作台页面
- 已构建部署：`nuxt build` → asset-sync 到 nginx → pm2 restart nuxt-frontend
- 验证：本地 `:3000` 与线上 `https://aigc.fushtn.com/ecosystem/applications` 均 200

## 4. 现有工作台回归结果（G2-G5）

| Gate | 检查项 | 结果 |
|------|--------|:----:|
| G2 | /api/enterprise/agent-profiles | ✅ 200 |
| G2 | /api/enterprise/subscription/plans | ✅ 200（3 套餐） |
| G3 | 登录 /api/auth/login + /api/auth/me | ✅ 200 |
| G4 | AI员工 agent-profiles 返回 code=0 | ✅ |
| G5 | 订阅体系套餐列表 | ✅ 3 plans |

> 备注：`/api/enterprise/health` 为**存量死路由**（enterprise-health.ts 自 7/17 起从未注册，非本次回归）；`/api/enterprise/subscription/current` 对无 OrgMember 的测试账号返回 404「未找到企业」为数据原因，路由本身工作正常（plans 200 证明订阅体系健康）。

## 5. 数据库迁移记录

- 迁移文件：`backend/prisma/migrations/sprint-eco-01-application-adapter/migration.sql`（4 表 + 索引 + 外键，IF NOT EXISTS 幂等）
- 执行：`npx prisma db execute --schema prisma/schema.prisma --file <migration.sql>` ✅ Script executed successfully
- Prisma Client：`npx prisma generate` ✅（修复 1 处 relation 反向字段缺失）
- 数据：ecology_applications=9 行 / ecology_application_versions=9 行 / installations=1 行（测试安装，可留作验收样例）

## 6. 回滚验证

- **回滚方案**：逆序 DROP 4 张 ecology_* 表（纯新增无依赖，不影响任何现有表/数据）
- **验证**：迁移 SQL 全部 IF NOT EXISTS + 唯一约束，重复执行零副作用（幂等已实证：二次 seed skipped=9）
- 新路由文件独立（ecology-application.routes.ts / ecosystem/ 目录），删除即完全摘除生态入口，工作台零影响

## 7. 下一 Sprint 建议（ECO-02 Plugin Manifest Runtime）

- 前置就绪：`EcologyApplication` 表 + 能力声明已在 metadata，Plugin 的 `application` 关联可直接 FK 到 `ecology_applications.slug`
- 建议 ECO-02 范围：
  1. `ecology_plugins` / `ecology_plugin_versions` / `ecology_plugin_installations` 3 表（纯新增）
  2. plugin.json 只读解析器（纯函数校验：id 命名空间/type/application 关联/permissions/billing）
  3. Plugin Registry API（register/list/detail/install/uninstall）
  4. Reality Gate：合法/非法样本 5+5，不接商城、不执行插件
- 纪律延续：只增不改、手写 SQL 双通道、BUILT_IN 状态语义保留给平台内置

---

## 附：交付物清单

```
backend/prisma/schema.prisma                          (+4 Ecology 模型)
backend/prisma/migrations/sprint-eco-01-application-adapter/migration.sql
backend/src/ecosystem/application-adapter.ts          (Adapter 契约冻结)
backend/src/ecosystem/builtin-applications.ts         (9 内置应用身份 SSOT)
backend/src/ecosystem/application-registry.service.ts (seed/查询/安装)
backend/src/routes/ecology-application.routes.ts      (/api/ecosystem 路由)
backend/src/index.ts                                  (+路由注册 + 启动 seed)
backend/scripts/reality-check-eco-01.mjs              (Reality Gate 20 项)
frontend/pages/ecosystem/applications.vue             (应用中心只读页)
```

**提交：** 待掌柜确认后 git commit（建议 message: `SPRINT-ECO-01 Application Adapter Layer — 20/20 Reality Gate PASS`）
