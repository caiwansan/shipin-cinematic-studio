# Security P0 — 修复行动计划

> 基于 2026-07-28 第三方安全审计报告
> Sprint 12.6 Governance Closure — 安全 P0 同步修复

---

## P0-1: 凭据治理（C-1）

### 风险
`backend/.env` + 5 份 `.env.bak.*` 备份中明文存储全部生产凭据

### 立即执行

| # | 操作 | 命令 |
|---|------|------|
| 1 | 备份当前 .env | `cp backend/.env backend/.env.encrypted` |
| 2 | 删除所有 .env.bak 文件 | `rm -f backend/.env.bak.*` |
| 3 | .env 权限收紧 | `chmod 600 backend/.env` |
| 4 | 轮换所有密码 | PostgreSQL、Redis、JWT_SECRET、CRYPTO_ENCRYPTION_KEY |
| 5 | 移动凭据到环境变量 | 从 .env 迁移到 PM2 ecosystem 或 vault |

### 依赖
- 轮换 JWT_SECRET → 所有用户需重新登录
- 轮换 CRYPTO_ENCRYPTION_KEY → 需用新 Key 重新加密所有 ApiKey 记录
- 轮换 DB/REDIS 密码 → 需更新 PM2 和 systemd 配置

### 预估
**2-4 小时**

---

## P0-2: 系统监控端点加认证（C-2）

### 风险
`/api/v1/system/env-key/:name` 可明文返回 `JWT_SECRET` 等任意环境变量

### 修复

**文件**: `backend/src/routes/system-health.ts`

```typescript
// 为每个端点添加 requireAdmin
import { requireAdmin } from '../middleware/require-admin.js'

// 或者文件级统一控制
fastify.addHook('preHandler', requireAdmin)
```

### 受影响端点

| 端点 | 加 requireAdmin |
|------|-----------------|
| `GET /api/v1/system/env-keys` | ✅ |
| `GET /api/v1/system/env-key/:name` | ✅ **最高优先级** |
| `GET /api/v1/system/providers-test` | ✅ |
| `GET /api/v1/system/provider-state` | ✅ |
| `GET /api/v1/system/provider-state/:userId` | ✅ |
| `GET /api/v1/system/health` | ✅ |

### 预估
**30 分钟**

---

## P0-3: SSRF 修复（C-3）

### 风险
`/api/proxy/image?url=` 域名检查 `includes('volces.com')` 可被绕过

### 修复

**文件**: `backend/src/routes/proxy-image.ts`

```typescript
// 修改前
if (!decodedUrl.includes('tos-cn-beijing.volces.com') && !decodedUrl.includes('volces.com')) {

// 修改后
const parsedUrl = new URL(decodedUrl)
const allowed = ['tos-cn-beijing.volces.com', 'volces.com']
if (!allowed.includes(parsedUrl.hostname)) {
```

### 预估
**15 分钟**

---

## P0-4: Talent/Interview Agent 路由加认证（H-1）

### 风险
`enterprise-talent-agent.ts` 和 `enterprise-interview-agent.ts` 无 preHandler 鉴权

### 修复

**文件**: `backend/src/routes/enterprise-talent-agent.ts`

```typescript
// 在文件顶部添加
export async function registerTalentAgentRoutes(app: FastifyInstance) {
  // ⬇️ 新增
  app.addHook('preHandler', app.authenticate)
  
  // ... 现有路由代码
}
```

**文件**: `backend/src/routes/enterprise-interview-agent.ts`

```typescript
export async function registerInterviewAgentRoutes(app: FastifyInstance) {
  // ⬇️ 新增
  app.addHook('preHandler', app.authenticate)
  
  // ... 现有路由代码
}
```

### 预估
**15 分钟**

---

## P0-5: 独立 PrismaClient 修复

### 风险
`recruitment-conversation.routes.ts` 使用独立的 `new PrismaClient()`，不共享连接池

### 修复

**文件**: `backend/src/routes/recruitment-conversation.routes.ts`

```typescript
// 修改前
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 修改后
import { prisma } from '../utils/index.js'
```

### 预估
**5 分钟**

---

## P0-6: Nginx 配置重复路由清理

**文件**: `/www/server/panel/vhost/nginx/aigc.fushtn.com.conf`

`/admin/` 路由定义出现 3 次，合并为统一规则指向 Nuxt SSR 4001。

### 预估
**10 分钟**

---

## P0 修复顺序

```
1. SSRF 修复 (C-3)         — 15min   🔴 最小改动，即时生效
2. Agent 认证 (H-1)        — 15min   🔴 最小改动
3. 独立 PrismaClient (M-x)  — 5min    🔴 最小改动
4. 凭据治理 (C-1)           — 2~4h   🔴 影响面大，需规划
    4a. 删除 .env.bak.*         5min
    4b. .env 权限调整           2min
    4c. 密钥轮换                2h
    4d. 依赖项更新             30min
5. 监控端点认证 (C-2)       — 30min   🟠 配合凭据治理
6. Nginx 清理 (C-4)         — 10min   🟢
```

---

*生成时间：2026-07-28*  
*基于当晚全站安全审计报告*
