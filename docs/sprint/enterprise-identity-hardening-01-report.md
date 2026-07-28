# Sprint: Enterprise Identity Hardening 01

**完成时间:** 2026-07-27
**状态:** ✅ 全部完成，构建通过

---

## Phase 4: Token 统一化 ✅

**新建文件:**
- `frontend/utils/auth/token.ts` — 统一 Token 管理 API
  - `getAuthToken()` / `setAuthToken()` / `clearAuthToken()` / `isAuthenticated()`

**修改文件:**
- `frontend/utils/token-cache.ts` — 改为兼容层，底层委托给 `auth/token.ts`
- 批量替换 **42 个文件** 中的直接 `localStorage.getItem('token')` / `localStorage.getItem('auth_token')` / `localStorage.getItem('accessToken')` → `getAuthToken()`
- 批量替换 `localStorage.setItem('token', ...)` → `setAuthToken(...)`
- 批量替换 `localStorage.removeItem('auth_token')` → `clearAuthToken()`

**覆盖范围:**
- `stores/` — identity, enterprise-agent
- `modules/` — asset, semantic, goal, capability services
- `components/` — business, wizard, enterprise, ecom, recruitment
- `composables/` — 11 files
- `pages/` — 20+ files (workspace, admin, enterprise, media-department, etc.)
- `studio-v2/` — api, recruitment-api, candidate-api, components, layout, composables
- `legacy/` — brand-geo composable

---

## Phase 5: Onboarding 合并 ✅

- `pages/workspace/recruitment/onboarding.vue` → 改为 redirect 到 `/workspace/enterprise/onboarding`
- 旧 recruitment onboarding 路由保留但自动跳转

---

## Phase 6: WorkspaceSwitcher 修复 ✅

- `components/WorkspaceSwitcher.vue` — 重写
  - `hasEnterprise=true` → 显示"创建招聘空间"（跳转 onboarding?mode=new-workspace）
  - `hasEnterprise=false` → 显示"创建企业"（完整 onboarding）
  - 新增 `switching` 状态、错误提示、点击外部关闭

---

## Phase 7: 招聘页面错误显示修复 ✅

- `pages/workspace/recruitment/index.vue`
  - 新增 `jobsLoadError` / `candidatesLoadError` 状态
  - API 失败时显示 ⚠️ 错误提示 + "重新加载"按钮
  - 区分 loading / success / empty / error 四种状态
  - 候选人加载失败不再静默忽略

---

## 构建验证

```
npx nuxt build → ✅ Build complete!
输出: .output/server/index.mjs
版本: v0.2.0-c1-27-ga54c80b1
资源: 465 files
```

---

## 影响统计

| 指标 | 数值 |
|------|------|
| 修改文件数 | ~45 |
| 统一 Token 访问点 | 42 |
| 删除重复 token key | accessToken / token → auth_token |
| 新增文件 | 1 (auth/token.ts) |
| 构建状态 | ✅ 通过 |
