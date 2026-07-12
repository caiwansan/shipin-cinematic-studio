# Audit D: 后台权限审计 (AdminAudit.md)

## 1. Admin 入口分析

### 1.1 Admin 页面入口

| 入口 | 路径 | 认证方式 |
|------|------|----------|
| Admin Login | `frontend/pages/admin/aigc/login.vue` | 账号密码 |
| Admin Dashboard | `frontend/pages/admin/aigc/overview.vue` | localStorage token |
| Admin 其他页面 | `frontend/pages/admin/aigc/*.vue` (19 pages) | localStorage token |

前端 Admin Layout: `frontend/layouts/admin-aigc.vue`
- 在 `onMounted` 时从 `window.localStorage` 读取 `auth_token`
- 无 token 时自动跳转登录页
- 清除 token 操作: `localStorage.removeItem('auth_token')`

**问题**: Admin Layout 使用 `localStorage` 存储 token，容易受 XSS 攻击窃取。

### 1.2 后端 Admin Routes

| 路由文件 | Admin 检查 |
|----------|:----------:|
| `routes/admin-auth.ts` | ✅ 登录认证 |
| `routes/admin-prompt-runtime.ts` | ✅ requireAdmin |
| `routes/admin-prompt-telemetry.ts` | ✅ requireAdmin |
| `routes/admin-wallet.ts` | ✅ requireAdmin |
| `routes/admin-customer-service.ts` | ✅ requireAdmin |
| `routes/admin-storage-config.ts` | ✅ requireAdmin |
| `routes/admin-prompt-trace.ts` | ✅ requireAdmin |
| `routes/admin-global-config.ts` | ✅ requireAdmin |
| `routes/admin-evaluation-samples.ts` | ✅ requireAdmin |
| `routes/admin-platform-runtime.ts` | ✅ requireAdmin |
| `routes/admin-dashboard.ts` | ✅ requireAdmin |
| `routes/admin-members-storage.ts` | ✅ requireAdmin |
| `routes/admin-image-prompts.ts` | ✅ requireAdmin |
| `routes/admin-models-v2.ts` | ✅ requireAdmin |
| `routes/admin-market-agents.ts` | ✅ requireAdmin |
| `routes/admin-novels.ts` | ✅ requireAdmin |
| `routes/admin-agents.ts` | ✅ requireAdmin |
| `routes/admin-platform-llm.ts` | ✅ requireAdmin |
| `routes/admin-posts.ts` | ✅ requireAdmin |

### 1.3 requireAdmin Middleware

**文件**: `backend/src/middleware/require-admin.ts`

```typescript
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization
  if (!auth) return reply.status(401).send(...)
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  return verifyToken(token)  // 验证 JWT + 角色检查
}
```

## 2. 问题: 非唯一 Admin 入口

### 2.1 非 admin 前缀的路由包含敏感操作

以下路由**不是** admin 前缀但包含敏感操作:

| 路由文件 | 敏感操作 | 是否有 Admin 检查 |
|----------|----------|:-----------------:|
| `routes/projects.ts` | 项目管理 | ❌ 无 |
| `routes/scenes.ts` | 场景管理 | ❌ 无 |
| `routes/pipeline.ts` | 流水线操作 | ❌ 无 |
| `routes/voice.ts` | 语音配置 | ❌ 无 |
| `routes/wallet.ts` | 钱包操作 | ❌ 无 |
| `routes/style-profiles.ts` | 风格配置 | ❌ 无 |
| `routes/hdz/` | HDZ 项目管理 | ❌ 无 |
| `routes/platform/` | 平台操作 | ❌ 无 (部分有) |

### 2.2 `routes/platform/` 的问题

`platform/` 目录意图作为平台管理入口，但:
- `routes/platform/admin-platform-runtime.route.ts` → ✅ 有 requireAdmin
- `routes/platform/governance/` 系列 → ❌ 无统一 Admin 检查
- `routes/platform/resource/` 系列 → ❌ 无统一 Admin 检查
- `routes/platform/workspace/` 系列 → ❌ 无统一 Admin 检查

### 2.3 admin-auth.ts 存在的风险

**文件**: `backend/src/routes/admin-auth.ts`
- 实现了独立的 admin JWT 签发
- `verifyToken` 与普通用户 JWT 共用 secret
- 但角色校验不严格

## 3. 无认证路由清单 (25 条)

以下路由文件**完全没有任何认证**:

1. `api-video-optimize.ts`
2. `desktop-comfy.ts`
3. `desktop-update.ts`
4. `desktop-video.ts`
5. `director-v2.ts`
6. `export.ts`
7. `fight-templates-meta.ts`
8. `models.ts`
9. `novel-cleanup.ts`
10. `novel-cron.ts`
11. `observability.ts`
12. `p0-gateway-route.ts`
13. `p1.8-evaluate.ts`
14. `pipeline-jobs.ts`
15. `projects-v2.ts`
16. `prompt-registry.ts`
17. `proxy-image.ts`
18. `r11-console.ts`
19. `script-breakdown.ts`
20. `sms.ts`
21. `style-profiles.ts`
22. `system-version.ts`
23. `tasks-telemetry.ts`
24. `video-merge.ts`
25. `workbench-director.ts`

## 4. 建议

1. **统一 Admin 入口**: 所有 admin 操作使用 `/api/admin/` 前缀
2. **强制 Admin Middleware**: 所有 admin 路由继承 requireAdmin 检查
3. **消除 localStorage token**: 改为 httpOnly cookie
4. **平台路由统一检查**: `routes/platform/` 全部增加 requireAdmin
5. **无认证路由审计**: 25 条无认证路由需逐条判断是否需要 auth
6. **Admin JWT 独立 Secret**: Admin token 使用独立 JWT_SECRET
