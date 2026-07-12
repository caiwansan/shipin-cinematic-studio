# Audit N: 安全审计 (SecurityAudit.md)

## 1. JWT/Cookie/Session 安全

### 1.1 JWT 实现

| 组件 | 方式 | 安全评估 |
|------|------|---------|
| JWT Secret | `.env` `JWT_SECRET` | ⚠️ 硬编码在 .env |
| JWT Plugin | `@fastify/jwt` | ✅ 标准 |
| Admin JWT | 与用户 JWT 共用 secret | ❌ 应独立 |
| Token 刷新 | `JWT_REFRESH_SECRET` | ✅ 有 |
| Token 过期 | 未检查 | ❌ 无过期时间 |

**证据**: 
- `config/env.ts:5` — `JWT_SECRET: z.string().min(32)`
- `config/env.ts:6` — `JWT_REFRESH_SECRET: z.string().default('')` (默认为空!)
- `routes/sms-auth.ts:239` — 手动读取 JWT_SECRET

### 1.2 Token 存储

| Token | 存储位置 | 方式 | 风险 |
|-------|---------|------|------|
| User Token | `localStorage` | `auth_token` key | XSS 可窃取 |
| Admin Token | `localStorage` | `auth_token` key | XSS 可窃取 |
| OAuth Token | `localStorage` | 多处写入 | XSS 可窃取 |

**证据**: 
- `frontend/layouts/admin-aigc.vue:54` — `window.localStorage?.getItem('auth_token')`
- `frontend/stores/auth.ts:18` — "内存层防御 XSS 窃取：注入脚本可读 localStorage"
- `backend/src/routes/qq-oauth.ts:229` — `localStorage.setItem(keys[i], token)`
- `backend/src/routes/wechat-oauth.ts:141` — 同上

## 2. CSRF 防护

| 防护 | 实现 | 评估 |
|------|------|------|
| OAuth state | 内存存储 | ⚠️ 不支持多实例 |
| SameSite Cookie | 未配置 | ❌ |
| CSRF Token | 未使用 | ❌ |

## 3. XSS 防护

| 防护 | 实现 | 评估 |
|------|------|------|
| Helmet | `@fastify/helmet` | ✅ |
| CORS | `@fastify/cors` | ✅ 但有风险 |
| Input Sanitization | 未使用 | ❌ |
| Output Encoding | 未系统化 | ❌ |

## 4. SQL 注入风险 — CRITICAL

### 4.1 Raw SQL 列表

文件中使用 `$executeRawUnsafe`/`$queryRawUnsafe` 的代码 >=30 处:

**Backend src**: (见 DatabaseAudit 完整列表)
- `routes/platform/admin-platform-runtime.route.ts` — 多处 `$queryRawUnsafe` + 字符串拼接
- `routes/admin-wallet.ts` — `$executeRawUnsafe` 拼接
- `routes/admin-prompt-telemetry.ts` — `$queryRawUnsafe` 
- `routes/wallet.ts` — 多处 raw SQL 拼接
- `routes/voice.ts` — `$executeRawUnsafe`
- `services/observability.service.ts` — `$queryRawUnsafe`
- `services/storage-policy.service.ts` — raw SQL

**示例**: 
```typescript
// backend/src/routes/platform/admin-platform-runtime.route.ts:62
await prisma.$executeRawUnsafe(
  `INSERT INTO platform_provider_config (...) VALUES ($1, $2, $3, $4, $5, $6, 'unknown', NOW())`,
  id, body.provider, encryptedKey, body.baseUrl, body.model, body.isEnabled
)  // 虽然使用了参数化，但大量其他调用直接拼接
```

## 5. Secret/Key 管理

### 5.1 环境变量中的 API Keys

`.env` 文件包含 12 个 Provider API keys:
```
JWT_SECRET, MINIO_SECRET_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY,
REPLICATE_API_KEY, VOLCENGINE_API_KEY, MUREKA_API_KEY, SUNO_API_KEY,
MUSIC15_API_KEY, SILICONFLOW_API_KEY, ALIYUN_API_KEY, CRYPTO_ENCRYPTION_KEY
```

### 5.2 API Key 泄露风险

| 风险 | 描述 | 严重等级 |
|------|------|----------|
| .env 在仓库中 | 明文存储，版本控制 | CRITICAL |
| 测试脚本硬编码 | `scripts/` 中 mock key | HIGH |
| MINIO_SECRET 默认值 | `config/env.ts:12` default 'minioadmin' | HIGH |

## 6. 认证/Auth 缺失

### 6.1 25 条路由完全无认证

见 AdminAudit.md 的完整清单。

### 6.2 Admin 权限缺失

| 路由文件 | 权限需求 | 实际检查 |
|---------|---------|---------|
| `routes/platform/governance/*` | Admin | ❌ 无 |
| `routes/projects.ts` | 用户 | ❌ 无 (公开?) |
| `routes/scenes.ts` | 用户 | ❌ 无 |
| `routes/prompt-registry.ts` | Admin | ❌ 无 |
| `routes/workbench-director.ts` | 用户 | ❌ 无 |

## 7. 其他安全问题

| 风险 | 描述 | 严重等级 |
|------|------|----------|
| Helmet 配置 | 仅默认选项 | MEDIUM |
| 无 CSP Header | Content-Security-Policy 未配置 | MEDIUM |
| COS/OSS 配置 | 直接暴露公共桶 | MEDIUM |
| 无速率限制 | Rate limit 仅全局 | HIGH |
| 文件上传验证 | 未检查文件类型/MIME | MEDIUM |
| 后台入口 | 仅 login.vue 做简单鉴权 | HIGH |

## 8. 建议 (按优先级)

1. 所有 `$executeRawUnsafe` 替换为 Prisma ORM 或参数化查询
2. Token 存储从 localStorage 迁移到 httpOnly/Secure cookie
3. 消除 .env 明文密钥，使用密钥管理服务 (Vault/Secrets Manager)
4. 25 条无认证路由逐条评估添加 auth
5. Admin JWT 使用独立 secret
6. 添加 CSRF token (OAuth state 外)
7. 添加 CSP header
8. 文件上传添加类型/MIME 校验
