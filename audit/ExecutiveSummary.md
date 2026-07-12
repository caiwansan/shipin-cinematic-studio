# 昆仑镜 (Kunlun Mirror) 全仓架构审计 — 执行摘要

> 审计时间: 2026-07-08
> 审计工具: 全仓静态扫描 (grep/find/awk)
> 源代码文件: 4,594 (2,288 backend .ts + 1,048 frontend .ts/.vue/.tsx + scripts/tests/etc.)
> 数据库模型: 324 (Prisma Schema)
> Git 提交: 139 commits (audit/reality-v3 分支)
> 后端框架: Fastify 5 + Prisma 6 + BullMQ + ioredis
> 前端框架: Nuxt 3 + Pinia + Vue 3

---

## 核心发现摘要

### 🔴 严重 (Critical) — 必须立即修复

| # | 问题 | 领域 | 证据 |
|---|------|------|------|
| C1 | 324/324 个数据库模型无索引 | DatabaseAudit | schema.prisma 全表扫描 |
| C2 | 25 个路由文件无任何认证/鉴权 | SecurityAudit | `backend/src/routes/*.ts` 中 NO AUTH |
| C3 | 大量 `$executeRawUnsafe`/`$queryRawUnsafe` SQL 注入风险 | SecurityAudit | >= 30 处 raw SQL 拼接 |
| C4 | API Key 明文在 `.env` 和环境变量中 | SecurityAudit | 12 个 provider API keys |
| C5 | 跨工作台数据不统一 (5个独立 workspace 实现) | ArchitectureAudit | brand-geo/brand-geo-v2/studio-v2/workspaces/legacy |
| C6 | 无统一的 User/Auth Guard 链 | SaaSAudit | 仅 customer-service 有 quota check |

### 🟠 高危 (High) — 需尽快修复

| # | 问题 | 领域 | 证据 |
|---|------|------|------|
| H1 | 多个 AI Runtime 并存 (runtime + providers + model-adapters + queue) | AIRuntimeAudit | 4 条独立 AI 调用路径 |
| H2 | 硬编码 Prompt 模板散落 (>=15 处) | PromptAudit | agents/*.ts 中 const FALLBACK_PROMPT |
| H3 | Zustand/Pinia/Composable/LocalStorage 多状态源 | StateAudit | 26 Pinia stores + composables + localStorage |
| H4 | 前端无统一 API 调用层 (fetch/$fetch/ofetch 混用) | APIMap | frontend 中混用 3 种 HTTP 客户端 |
| H5 | 51+ 孤立数据库模型 (无 backend 代码引用) | DatabaseAudit | UNREFERENCED MODEL |
| H6 | 后台 API 入口不唯一 (普通 routes + admin routes + platform routes) | AdminAudit | 多个 admin 入口 |
| H7 | 大量 `$queryRawUnsafe` 可导致 SQL 注入 | SecurityAudit | >= 30 处 |
| H8 | 历史遗留代码 (legacy brand-geo + brand-geo-v2) 仍被引用 | LegacyFilesAudit | frontend/legacy/ + frontend/workspaces/geo |

### 🟡 中危 (Medium) — 架构治理

| # | 问题 | 领域 | 证据 |
|---|------|------|------|
| M1 | Prompt 管理缺乏统一 Registry (硬编码 vs DB 混合) | PromptAudit | 15+ 硬编码 prompts |
| M2 | 数据库 324 模型无任何索引 | DatabaseAudit | 100% 无索引 |
| M3 | Cascade 删除链风险 (Project → 多个子表) | DatabaseAudit | >= 20 onDelete: Cascade |
| M4 | 223 个 index.ts 入口文件 (分散引用) | ArchitectureAudit | 过度模块化 |
| M5 | Subscription/Quota Guard 未在 AI 调用路径全覆盖 | SaaSAudit | 仅 customer-service 有 check, worker-runtime 无 |
| M6 | Nuxt middleware/auth 配置不统一 | SecurityAudit | 前端页面鉴权不一致 |
| M7 | dual_write_watcher_events 表 (DualWrite) 增加写入复杂度 | ArchitectureAudit | dualwrite-manager |
| M8 | OAuth token 写入 localStorage (XSS 可窃取) | SecurityAudit | qq-oauth.ts, wechat-oauth.ts |

---

## 各审计报告得分

| 审计项 | 得分 | 评级 |
|--------|------|------|
| A: 系统架构 | 45/100 | ⚠️ 较差 |
| B: AI Runtime | 50/100 | ⚠️ 较差 |
| C: SaaS 商业规则 | 35/100 | 🔴 差 |
| D: 后台权限 | 55/100 | ⚠️ 较差 |
| E: Agent | 60/100 | ⚠️ 一般 |
| F: Prompt | 40/100 | 🔴 差 |
| G: 持久化 | 50/100 | ⚠️ 较差 |
| H: Workspace | 30/100 | 🔴 差 |
| I: Project 生命周期 | 45/100 | ⚠️ 较差 |
| J: 资产管理 | 55/100 | ⚠️ 一般 |
| K: API | 50/100 | ⚠️ 较差 |
| L: 数据库 | 25/100 | 🔴 差 |
| M: 前端状态管理 | 45/100 | ⚠️ 较差 |
| N: 安全 | 40/100 | 🔴 差 |
| O: 性能 | 55/100 | ⚠️ 一般 |
| P: 代码质量 | 50/100 | ⚠️ 较差 |
| Q: 配置中心 | 55/100 | ⚠️ 一般 |
| S: 历史演化 | 35/100 | 🔴 差 |

---

## 综合评分

| 维度 | 得分 | 说明 |
|------|------|------|
| **架构健康度** | **42/100** | 多真相源、重复逻辑、历史遗留 |
| **安全性** | **40/100** | 无索引、Raw SQL、硬编码密钥 |
| **代码健康度** | **50/100** | 死代码、TODO、无索引 |
| **可维护性** | **38/100** | 5个workspace、多runtime、223个index.ts |
| **数据治理** | **30/100** | 无索引、孤立表、Cascade链 |
| **商业规则** | **35/100** | Quota Guard 未全覆盖 |
| **AI Runtime** | **50/100** | 多入口、直连Provider |

**综合评分: 42/100 (Severe Technical Debt)**

---

## 推荐立即采取的行动 (Top 10)

1. **所有数据库表添加索引** — 当前 324 表 0 索引，生产环境不可接受
2. **统一 AI Runtime 入口** — 消除 4 条独立调用路径（routes -> providers, model-adapters, queue, runtime）
3. **消除 SQL 注入风险** — 替换全部 `$executeRawUnsafe`/`$queryRawUnsafe`
4. **统一 Workspace 架构** — 合并 5 个独立 Workbench 实现
5. **实现全覆盖 Usage/Quota Guard** — 所有 AI 调用必须经过 quota check
6. **旧代码清理** — 删除 legacy brand-geo, brand-geo-v2, v1, deprecated 目录
7. **Prompt 统一管理** — 去除所有硬编码 Prompt，迁移到 PromptRegistry
8. **统一前端 API 调用** — 单一 HTTP client（apiKernel）
9. **OAuth token 存储从 localStorage 迁移到 httpOnly cookie**
10. **建立统一的 Admin 入口和权限校验**

---

*所有具体证据请参考各分项审计报告和 Evidence 目录。*
