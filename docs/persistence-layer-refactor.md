# Persistence Layer Refactor

**目标**: 建立可靠的持久化层，终结 "前端 success ≠ DB success" 问题
**阶段**: Phase 2 — Recoverability

---

## 1. 当前架构问题

```text
Frontend                    Backend
  │                           │
  POST /api/save             POST handler
  │                           │
  toast('success')  ←───     Prisma write (maybe fail)
  │                           │
  refetch()                   DB (maybe not committed)
  │                           │
  发现没数据 😱               (silent rollback)
```

**根因**: 前端在 DB write 确认前就显示成功。

---

## 2. 统一持久化契约

### 前端

```typescript
// composables/usePersistence.ts
interface PersistResult {
  success: boolean
  serverTimestamp: string
  version: number
  error?: string
}

async function saveWithConfirm(url: string, data: any): Promise<PersistResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  
  const result = await response.json()
  
  // 真正的成功条件
  if (response.ok && result.success === true) {
    return {
      success: true,
      serverTimestamp: result.timestamp || new Date().toISOString(),
      version: result.version || 0,
    }
  }
  
  // 即使 response.ok 但业务失败
  throw new PersistError(result.error || 'Persistence failed silently')
}
```

### 后端

```typescript
// 所有写操作返回确认
{
  success: true,
  timestamp: "2026-05-20T12:00:00Z",
  version: 5,
  // 或
  success: false,
  error: "DB write timeout after 3 retries"
}
```

### 不可接受的模式

```typescript
// ❌ 假成功
app.post('/api/save', async (req, reply) => {
  try {
    await prisma.project.update({ where: { id }, data })
    return { success: true }  // 即使 Prisma 断开连接也可能返回
  } catch { /* silent */ }
})

// ❌ 前端乐观不验证
toast.success('已保存')
// 没有确认 DB 真的写了
```

---

## 3. 重试策略

### 前端重试

```typescript
async function persistWithRetry(
  url: string, 
  data: any, 
  options?: { maxRetries?: number, timeoutMs?: number }
): Promise<PersistResult> {
  const maxRetries = options?.maxRetries ?? 3
  const timeoutMs = options?.timeoutMs ?? 5000
  
  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) return result
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[Persist] Retry ${i + 1}: timeout`)
      } else {
        console.warn(`[Persist] Retry ${i + 1}: ${err.message}`)
      }
    } finally {
      clearTimeout(timer)
    }
    
    // 指数退避
    await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** i, 5000)))
  }
  
  throw new Error('Persistence failed after retries')
}
```

---

## 4. 用户模型配置持久化重构

### 当前链路

```text
ModelSettingsModal.save()
  ├─ 遍历 modelCards
  │     ├─ 跳过 custom（无 key）
  │     └─ 其余 → POST /api/user-model-config
  │           └─ UserModelConfig.upsert
  └─ saveProviderMap() → localStorage
```

### 目标链路

```text
ModelSettingsModal.save()
  ├─ 并行写入所有 provider
  │     └─ POST /api/user-model-config/batch
  │           └─ prisma.$transaction([upsert, upsert, upsert])
  ├─ 确认 DB 返回 success
  ├─ 再更新 Pinia store
  └─ localStorage 只做 draft fallback（不再作为真相源）
```

### batch API

```typescript
// POST /api/user-model-config/batch
async function batchSave(req, reply) {
  const configs = req.body  // [{ provider, apiKey, ... }]
  
  try {
    const result = await prisma.$transaction(
      configs.map(cfg => 
        prisma.userModelConfig.upsert({
          where: { userId_provider: { userId: req.user.id, provider: cfg.provider } },
          update: { ...cfg, updatedAt: new Date() },
          create: { userId: req.user.id, ...cfg },
        })
      ),
      { timeout: 10000 }
    )
    
    return { 
      success: true, 
      count: result.length,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[BatchSave] Transaction failed:', err)
    return { 
      success: false, 
      error: '部分配置保存失败',
    }
  }
}
```

---

## 5. Prisma 连接可靠性

### 当前配置检查

```typescript
// schema.prisma — 需要确认
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // connection_limit = 10  ← 是否配置？
  // pool_timeout = 10      ← 是否配置？
}
```

### 建议配置

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  connection_limit  = 20    // 同时连接数
  pool_timeout      = 10    // 连接池等待超时（秒）
}
```

### 连接健康检查

```typescript
// 启动时验证
async function checkDBConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('[DB] Connection OK')
    return true
  } catch (err) {
    console.error('[DB] Connection FAILED:', err)
    process.exit(1)  // 停止启动
  }
}

// 定时心跳（可选）
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    console.error('[DB] Heartbeat FAILED')
  }
}, 30000)
```

---

## 6. 审计与监控

### 持久化审计日志

```typescript
// 所有写操作记录日志
const persistLog: Array<{
  action: string
  userId: string
  timestamp: Date
  success: boolean
  duration: number
  error?: string
}> = []

// 记录
function logPersist(action: string, userId: string, success: boolean, duration: number, error?: string) {
  persistLog.push({ action, userId, timestamp: new Date(), success, duration, error })
  if (persistLog.length > 1000) persistLog.shift()
}

// 报告
function persistReport(): string {
  const total = persistLog.length
  const failures = persistLog.filter(l => !l.success).length
  return `Persistence: ${total} writes, ${failures} failures (${(failures/total*100).toFixed(1)}%)`
}
```
