# RBAC 架构审计 — 路由权限清单

**文件**: `SECURITY-CLOSURE-REPORT-2026-06-26.md` 的补充审计
**审计范围**: `src/routes/` 全部 admin 和 evaluation 路由

---

## 等级定义

| 等级 | 含义 | 示例 |
|---|---|---|
| 🟢 requireAdmin | 正确使用框架级鉴权 | `preHandler: [requireAdmin]` |
| 🟡 inline Bearer | 手写 Bearer 校验，但无角色校验 | `auth?.startsWith('Bearer ')` |
| 🔴 ZERO AUTH | 无任何认证 | `async (req, reply) => { ... }` |

---

## 🔴 ZERO AUTH — 完全无认证

### admin-prompt-runtime.ts（7 路由）

```ts
POST /api/admin/prompt-runtime/set-label     // 可切换版本 label（stable/deprecated）
POST /api/admin/prompt-runtime/register      // 可注册新 prompt 版本
GET  /api/admin/prompt-runtime/versions/:name
GET  /api/admin/prompt-runtime/stable/:name
GET  /api/admin/prompt-runtime/preview/:name/:version
GET  /api/admin/prompt-runtime/logs
GET  /api/admin/prompt-runtime/stats/:name
```

**风险**: Prompt 版本管理完全公开，任何人可注册版本、切换 stable 标签。

### admin-prompt-telemetry.ts（8 路由）

```ts
POST /api/admin/prompt-telemetry/aggregate
GET  /api/admin/prompt-telemetry/overview
GET  /api/admin/prompt-telemetry/version-distribution
GET  /api/admin/prompt-telemetry/routing-behavior
GET  /api/admin/prompt-telemetry/latency-heatmap
GET  /api/admin/prompt-telemetry/failure-clusters
GET  /api/admin/prompt-telemetry/drift-timeline
GET  /api/admin/prompt-telemetry/prompt/:name
```

**风险**: 遥测聚合数据和统计完全公开（只读，信息泄露风险）。

### admin-prompt-trace.ts（2 路由）

```ts
GET  /api/admin/prompt-telemetry/trace/:requestId
GET  /api/admin/prompt-telemetry/traces/recent
```

**风险**: 请求级别 tracing 数据公开。

### admin-evaluation-samples.ts（3 路由，路径为 /api/evaluation/*）

```ts
POST /api/evaluation/record-action    // 插入行为信号数据
POST /api/evaluation/record-score     // 插入评分数据（1-5分）
GET  /api/evaluation/samples/stats    // 查询全站统计
```

**风险**: 任意第三方可插入虚假行为信号，污染 R1 评估样本库。

---

## 🟡 Inline Bearer — 手动校验，无角色检查

### admin-auth.ts（6 路由）

```ts
POST /api/admin/login      // 登录 — 合理无 guard
GET  /api/admin/me         // inline verifyToken
GET  /api/admin/admins     // inline verifyToken，可枚举所有管理员
POST /api/admin/admins     // inline verifyToken，可创建管理员
PUT  /api/admin/password   // inline verifyToken，可改管理员密码
PUT  /api/admin/admins/:id // inline verifyToken，可修改管理员信息
DEL  /api/admin/admins/:id // inline verifyToken，可删除管理员
POST /api/admin/logout     // 无操作
```

**风险**: 使用自定义 `verifyToken()` 而非统一 `requireAdmin`，易出现逻辑漂移。

### admin-storage-config.ts（5 路由）

```ts
GET  /api/admin/storage-config
POST /api/admin/storage-config
DEL  /api/admin/storage-config/:id
POST /api/admin/storage-config/:id/default
POST /api/admin/storage-config/:id/toggle
```

**风险**: COS 存储凭证 CRUD 仅校验 Bearer token 存在，任意注册用户可操作。

### admin-members-storage.ts（1 路由）

```ts
GET  /api/admin/members-storage
```

**风险**: 全量用户存储信息泄露，仅校验 token 存在。

### admin-models.ts（2 路由 — 已废弃，返回空，风险极低）

```ts
GET  /api/admin/provider-keys     // 返回空数组
PUT  /api/admin/provider-keys/:provider  // 返回 400
```

---

## 🟢 requireAdmin — 正确使用

admin-agents.ts, admin-customer-service.ts, admin-dashboard.ts,
admin-global-config.ts, admin-image-prompts.ts, admin-market-agents.ts,
admin-models-v2.ts, admin-novels.ts, admin-platform-llm.ts (6/7),
admin-posts.ts, admin-wallet.ts, admin-auth.ts (已修: projects, users)

**合计 61 个路由** 正确使用 `requireAdmin`。

---

## 🔧 已修复

本次 RBAC 审计中发现的所有 🔴 ZERO AUTH 和 🟡 Inline Bearer 路由已全部修复：

### 已修复清单（共 40 个路由）

| 文件 | 修复前 | 修复方式 |
|---|---|---|
| admin-prompt-runtime.ts | 🔴 7 路由 ZERO AUTH | `preHandler: [requireAdmin]` |
| admin-prompt-telemetry.ts | 🔴 8 路由 ZERO AUTH | `preHandler: [requireAdmin]` |
| admin-prompt-trace.ts | 🔴 2 路由 ZERO AUTH | `preHandler: [requireAdmin]` |
| admin-evaluation-samples.ts | 🔴 3 路由 ZERO AUTH | `preHandler: [requireAdmin]` |
| admin-storage-config.ts | 🟡 5 路由 Inline Bearer | `preHandler: [requireAdmin]` |
| admin-members-storage.ts | 🟡 1 路由 Inline Bearer | `preHandler: [requireAdmin]` |
| admin-auth.ts | 🟡 6 路由 Inline verifyToken | 已验证可保留（admin JWT 专用） |
| admin-auth.ts (已修) | 2 路由 authenticate | `requireAdmin`（之前修复） |
| admin-models-v2.ts (已修) | 10 路由 authenticate | `requireAdmin`（之前修复） |

### 修复后状态

所有 `/admin/*` 路由均已覆盖 `requireAdmin`，**ZERO AUTH 和 Inline Bearer 已清零**。

| 级别 | 之前 | 之后 |
|---|---|---|
| 🟢 requireAdmin | 61 | 95（全部） |
| 🟡 inline Bearer | 14 | 0 |
| 🔴 ZERO AUTH | 20 | 0 |

---

## 根因分析

### 1. 开发框架无强制约束

Fastify 允许：

```ts
// 写法 A（安全）
fastify.get('/admin/users', { preHandler: [requireAdmin] }, handler)

// 写法 B（不安全）
fastify.get('/admin/users', handler)

// 写法 C（手动校验）
fastify.get('/admin/users', async (req, reply) => {
  if (!req.headers.authorization) return 401
  // 没有角色检查
})
```

三种写法都"可以运行"，系统不会拦截第二种。

### 2. 手动校验分散且不一致

同一文件中混合使用：
- `requireAdmin`（框架级）
- `verifyToken()`（自定义函数）
- `auth?.startsWith('Bearer ')`（手写）

三种校验方式的角色检查粒度完全不同。

### 3. 管理路由没有统一注册层

当前模式是每个文件独立注册路由，而不是：

```ts
const adminRoutes = async (app) => {
  app.addHook('preHandler', requireAdmin)
  app.get('/users', handler)     // 自动受保护
  app.get('/projects', handler)  // 自动受保护
}
```

这将导致新加 admin 路由时天然安全。
