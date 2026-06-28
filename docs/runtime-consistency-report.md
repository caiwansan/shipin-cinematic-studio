# Runtime Consistency Report

**Date**: 2026-05-20
**Target**: shipin-cinematic-studio/backend

---

## Runtime Architecture

```text
Frontend
  │ POST /api/tasks/ai-generate
  ▼
api-router.service.ts
  │ selectProvider()
  ▼  
worker-runtime.ts (BullMQ Worker)
  │ callProvider()
  │
  ├─ SiliconFlow (image/tts/llm)
  ├─ Bailian/Aliyun (image/tts/llm/video)
  ├─ Volcengine (image/tts)
  └─ DeepSeek (llm, via narrative-llm.ts)
```

---

## Consistency Check: Provider Routing

### ✅ Fixed
- TTS 现在按 `input.provider` 路由（用户选择优先）
- SiliconFlow handler 已添加 TTS 支持
- Volcengine handler 已添加 TTS 支持
- `selectProvider` 新增 `preferProvider` 参数

### ⚠️ Remaining
- **bailian handler** 的 TTS 未注册到 TASK_PROVIDERS 的 tts 列表（`api-router.service.ts`）
  - 实际上 bailian=aliyun 两者共享 TTS，但 Task Provider 路由表不包含 bailian 的 tts
- **DeepSeek handler** 无 TTS（本就不支持，没问题）
- **custom handler** 无 TTS（本地 TTS 不支持是合理的）

---

## Consistency Check: API Key Injection

### Injection Points

| Point | Method | Risk |
|-------|--------|------|
| `worker-runtime.ts:callProvider` | `process.env[KEY] = cfg.apiKey` | ✅ 单线程无并发问题 |
| `api-router.service.ts:selectProvider` | 只读查询，不注入 | ✅ |
| `with-user-model-config.ts` | 封装 `getUserModelConfig` | ✅ |

### 🔴 Risk: Process.env Pollution
```text
Worker A (userId=5, aliyun key) → process.env.ALIYUN_API_KEY = "xxx"
Worker B 同时使用 process.env.ALIYUN_API_KEY → 读到的是 key of userId=5
```
**Fix**: Worker 使用局部变量而非 process.env 传递 API key

---

## Consistency Check: Queue Reliability

### Current Implementation
- **Queue**: BullMQ on Redis (Redis 未确认是否独立部署)
- **DB**: PostgreSQL (via Prisma)
- **Worker**: 5 workers via `job-queue.ts` (SKIP LOCKED)

### ✅ Verified
- BullMQ 自带 ACK/retry/dead-letter
- PostgreSQL SKIP LOCKED 防止并发抢任务

### ⚠️ To Verify
- Redis 是否已部署且高可用
- BullMQ 连接超时配置
- Worker crash 后任务重入机制

---

## Consistency Check: Database Commit

### Checked Endpoints

| Endpoint | Write Confirmed | Async un-awaited |
|----------|----------------|-----------------|
| `POST /api/user-model-config` | ✅ Prisma upsert | ✅ All awaited |
| `POST /api/auth/register` | ✅ | ✅ |
| `POST /api/payment/*` | ✅ | ✅ |
| `POST /api/tasks/ai-generate` | ✅ BullMQ + DB | ✅ |

### No evidence of "toast success before DB commit" issue found.

---

## Runtime Graph Check

### Current Status: ❌ NOT PERSISTED

The runtime graph (node/edge topology + execution order) exists only in:
- Pinia store: `runtimeGraph`
- Component state: GraphEditor.vue

### Impact
- 刷新页面 → runtime graph 为空
- 已生成的 AI results 无法和 graph 节点关联
- 用户必须从零重新编排

### Fix Required
```typescript
// Option A: Store in project JSON field
prisma.project.update({
  where: { id: projectId },
  data: { runtimeGraph: JSON.stringify(graph) }
})

// Option B: New table `project_runtime`
// projectId, graph JSON, executionResults JSON, checkpoint timestamp
```

---

## Token / Auth Consistency

### ✅ Working
- JWT token 验证正确（fastify.authenticate）
- Token 双键名兼容（token vs auth_token）
- Admin 独立认证

### ⚠️ Warning
- `wechat-oauth.ts` 引用了不存在的 `avatar` 字段和 `jsonwebtoken` 类型
- 代码未被实际执行（只走 tsc 报错），但如果在生产路径中被调用会报运行时错误
