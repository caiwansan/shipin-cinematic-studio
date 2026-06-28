# Persistence Validation Report

**Date**: 2026-05-20
**Method**: Code review + manual endpoint verification

---

## Endpoint Persistence Mapping

| Endpoint | Method | DB Write | Verification |
|----------|--------|----------|-------------|
| `/api/user-model-config` | GET/POST | ✅ `UserModelConfig.upsert` | Re-reading returns same data |
| `/api/auth/login` | POST | ✅ JWT stateless | ✅ |
| `/api/auth/register` | POST | ✅ Prisma create | ✅ |
| `/api/payment/create-order` | POST | ✅ Prisma create | ✅ |
| `/api/payment/notify` | POST | ✅ DB update | ✅ |
| `/api/community/*` | CRUD | ✅ Prisma | ✅ |
| `/api/tasks/ai-generate` | POST | ✅ BullMQ + DB | ✅ |

---

## User Model Config Persistence Test

### Manual Test Steps (verify by running):
```bash
# 1. Save config
curl -X POST http://localhost:4002/api/user-model-config \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"apiKey":"sk-test-xxx","provider":"aliyun","ttsEnabled":true}'

# 2. Read config back  
curl http://localhost:4002/api/user-model-config/aliyun \
  -H 'Authorization: Bearer <token>'
```

### Result: ⚠️ PARTIAL

- **API Key** 通过 AES-GCM 加密存储 ✅
- **modelName** 正确持久化 ✅
- **provider** 字段当前只存在 `modelCardProviderMap`(localStorage)，不是 DB 的一部分 ❌
- **baseUrl** 正确持久化 ✅

---

## LocalStorage vs DB Divergence

```text
modelCardProviderMap (localStorage)
  { "llm": "volcengine", "image": "aliyun", "video": "volcengine", "tts": "siliconflow" }
  
UserModelConfig (DB)
  { provider: "siliconflow", apiKey: "sk-xxx", ttsEnabled: true, ttsModel: "..." }
  { provider: "volcengine", apiKey: "sk-yyy", llmEnabled: true, llmModel: "..." }
```

**Divergence**: DB 按(provider)组织，localStorage 按(taskType)组织。前端保存时只存 DB，不存 localStorage 的 providerMap。

**Evidence**: 
- `submitAiTask()` 提交时从 localStorage 读 `modelCardProviderMap`
- 后端 worker 从 DB `UserModelConfig` 读 API Key
- 这两个从不一起更新，可能读到不一致的值

---

## Key Injection Verification

### Code Path
```typescript
// worker-runtime.ts:callProvider
const cfg = await getUserModelConfig(userId, prov)
process.env[envKey] = cfg.apiKey  // ✅ 从加密 DB → process.env
```

### Risk: process.env lasts beyond request lifecycle
```typescript
callProvider() → process.env.ALIYUN_API_KEY = "key-A"
// Next request from different user:
callProvider() → process.env.ALIYUN_API_KEY = "key-B"
// But first user's job still running, now has key-B instead of key-A
```

**Fix**: 在 Worker handler 中直接传递 key，不通过 process.env

---

## Build Persistence Check

### Current
```bash
rm -rf .nuxt .output
npx nuxi build
pm2 restart frontend
```

### Risk
- `.nuxt` 缓存旧构建产物 → 增量构建可能保留已删除文件
- 强制清空重建已解决此问题
- 但没有自动化的 build 版本验证

### Recommendation
- 部署脚本增加 `BUILD_VERSION` 注入
- 前端启动时与后端校验版本一致性
