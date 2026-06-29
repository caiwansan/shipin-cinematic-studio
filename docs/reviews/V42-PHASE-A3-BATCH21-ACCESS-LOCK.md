# V4.2 Phase A3 Batch 2.1 — Access Lock

> 日期：2026-07-19
> 目标：锁住已 DEPRECATE 模块的 URL 直接访问

---

## Deprecated Module Access Policy

V4.2 起，所有进入 ⏸️ DEPRECATE 状态的模块必须满足：

| 项目 | 要求 |
|------|------|
| Navigation | 不显示 |
| Search | 不显示 |
| Sidebar | 不显示 |
| Admin Menu | 不显示 |
| Route Guard | 必须（HTTP 410 Gone） |
| Middleware | 必须 |
| Feature Flag | 必须 |
| API | 已标记 Deprecated |
| Database | 保留 |

---

## 修复内容

### Fix 0: 运行时配置 — `runtimeConfig.public.customerServiceEnabled`

**文件：** `frontend/nuxt.config.ts`

在 `runtimeConfig.public` 中新增了 `customerServiceEnabled` 配置项：

```typescript
runtimeConfig: {
  public: {
    // ...
    // @deprecated V4.2 — Customer Service 业务废弃
    customerServiceEnabled: false
  },
}
```

初始设为 `false`（默认关闭），与后端 `CUSTOMER_SERVICE_ENABLED` 环境变量保持一致。如需恢复，可在此处设为 `true` 或通过环境变量注入。

---

### Fix 3: 平台级 Deprecation Guard Middleware

**文件：** `frontend/middleware/deprecated-module.guard.ts`

创建了可复用的 Nuxt Route Middleware，用于所有已 DEPRECATE 的模块。

**核心逻辑：**
1. 从 `to.meta.moduleName` 读取模块标识
2. 从 `useRuntimeConfig().public.customerServiceEnabled` 检查 Feature Flag
3. 若未启用，抛出 HTTP 410 Gone 错误（`fatal: true` 阻止页面渲染）

**扩展性设计：**
- 后续其他模块进入 DEPRECATE 状态时，只需在 `definePageMeta` 中：
  ```typescript
  definePageMeta({
    middleware: ['deprecated-module'],
    moduleName: 'your-module-name',  // 新增的 moduleName
  })
  ```
- 然后在 middleware 中添加对应的 flag 检查分支即可
- 支持多模块同时管理，每个模块独立开关

---

### Fix 1: `/p0/life-assistant` — 路由守卫

**文件：** `frontend/pages/p0/life-assistant.vue`

在 `definePageMeta` 中引用了 deprecation middleware：

```vue
definePageMeta({
  title: '生活助手',
  middleware: ['deprecated-module'],
  moduleName: 'customer-service',
})
```

页面原有的所有业务逻辑、模板、样式均 **未修改**。

---

### Fix 2: Admin / Director OS 页面 — Middleware

以下 4 个页面均通过 `definePageMeta` 引用了相同的 deprecation middleware：

| 页面 | 路径 | 变更 |
|------|------|------|
| Customer Service 管理 | `frontend/pages/director-os/aigc/customer-service.vue` | `definePageMeta` 添加 `middleware: ['deprecated-module']` + `moduleName: 'customer-service'` |
| Life Assistant 路由配置 | `frontend/pages/director-os/aigc/life-assistant-config.vue` | 同上 |
| Customer Service 管理（Admin） | `frontend/pages/admin/aigc/customer-service.vue` | 同上 |
| 种子详情 | `frontend/pages/p0/seeds.vue` | 新增 `definePageMeta` 并添加 middleware 引用 |

所有页面的原有业务逻辑、模板、样式均 **未修改**。

---

## 架构设计

```
用户访问 /p0/life-assistant
        │
        ▼
Nuxt Router 解析路由
        │
        ▼
middleware/auth.ts          ← 认证检查（无需登录的路径跳过）
        │
        ▼
middleware/route-guard.ts    ← 有效路由检查
        │
        ▼
middleware/deprecated-module.guard.ts  ← ⭐ 新增：Feature Flag 检查
        │  ├─ 读取 runtimeConfig.public.customerServiceEnabled
        │  └─ 若 false → throw createError({ statusCode: 410, fatal: true })
        │
        ▼
页面组件渲染               ← 仅当 Flag 为 true 时可达
```

HTTP 410 Gone 会触发 Nuxt 的错误页面渲染（`error.vue`），用户看到友好的"功能已下线"提示。非 SPA 请求则会收到标准的 HTTP 410 响应。

---

## 验证

- [x] `/p0/life-assistant` — `CUSTOMER_SERVICE_ENABLED=false` 时返回 410
- [x] `/director-os/aigc/customer-service` — 锁定
- [x] `/director-os/aigc/life-assistant-config` — 锁定
- [x] `/admin/aigc/customer-service` — 锁定
- [x] `/p0/seeds` — 锁定
- [ ] 开启 Flag 后恢复正常（将 `nuxt.config.ts` 中 `customerServiceEnabled` 设为 `true`）

---

## Gate 2 Exit Checklist（更新后）

| 项目 | Batch 2 | Batch 2.1 |
|------|---------|-----------|
| 用户还能进入吗？ | ❌ | ❌ |
| 后台还能配置吗？ | ❌ | ❌ |
| 是否可以直接 URL 访问？ | ~~⚠️~~ | **❌** |
| API 默认开放吗？ | ✅ | ✅ |
| Feature Flag 关闭？ | ✅ | ✅ |
| 数据保留？ | ✅ | ✅ |
| 可恢复？ | ✅ | ✅ |

---

## 后续维护

### 新增一个 Deprecated Module
1. 在 `frontend/nuxt.config.ts` 的 `runtimeConfig.public` 中新增 flag
2. 在 `frontend/middleware/deprecated-module.guard.ts` 中添加对应的 flag 检查分支
3. 在需要锁住的页面的 `definePageMeta` 中添加 `middleware: ['deprecated-module']` 和 `moduleName`

### 恢复一个模块
1. 将对应 flag 设为 `true`（`nuxt.config.ts` 或环境变量）
2. 用户可直接通过 URL 访问

### 恢复后遗症
若重新开启，之前被隐藏的 Navigation 入口需手动恢复（不在本 Batch 范围内）。

---

*End of Report*
