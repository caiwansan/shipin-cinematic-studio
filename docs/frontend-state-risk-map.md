# Frontend State Risk Map

**Date**: 2026-05-20
**Target**: shipin-cinematic-studio/frontend

---

## State Sources Map

| Source | Type | Scope | Persistence | Risk |
|--------|------|-------|-------------|------|
| **localStorage** | Key-value | All tabs | ✅ True | ⚠️ 多人共用浏览器/过期不清理 |
| **sessionStorage** | Key-value | Per tab | ❌ Tab close | ✅ 无风险 |
| **Pinia Store (projectHydration)** | Reactive | All components | ❌ Memory | 🔴 刷新丢失 |
| **Pinia Store (pipelineStore)** | Reactive | Execution | ❌ Memory | 🔴 刷新丢失 |
| **Pinia Store (auth)** | Reactive | Auth state | ⚠️ Partial(token) | 🟡 token 双键名 |
| **Pinia Store (runtimeGraph)** | Reactive | Graph editor | ❌ Memory | 🔴 刷新丢失 |
| **Backend DB (UserModelConfig)** | SQL | User settings | ✅ True | ⚠️ 加密封装层脆弱 |
| **Backend DB (Project)** | SQL | On-disk | ✅ True | ✅ 可靠 |
| **process.env** | Env vars | Server runtime | ⚠️ Session | 🟡 Worker 间不共享 |

---

## State Flow Diagram

```text
ModelSettingsModal
  │
  ├─ localStorage.modelCardProviderMap (provider per type)
  │     └─ VoiceGeneration.vue 读取
  │
  └─ POST /api/user-model-config → DB.UserModelConfig
        └─ worker-runtime.ts → getUserModelConfig → process.env
  
  ┌─ 不一致: localStorage 存储 provider 选择但 DB 存储 apiKey+model
  └─ 真相源: DB > localStorage（当前实现是 DB 和 localStorage 互不通信）
```

---

## Hydration Flow

```text
Page Load
  │
  ├─ Pinia store reset to default values
  │
  ├─ onMounted
  │     ├─ localStorage.getItem → restore providerMap
  │     ├─ fetch('/api/user/info') → restore user config (async)
  │     └─ fetch('/api/pipeline/:id') → restore pipeline (async)
  │
  └─ Watch triggers (hydration change → pipeline update → voice generate)
      └─ ⚠️ 没有版本控制，后完成的 async 可能覆盖前一个
```

---

## Risk Register

### R-S001: Store initialization overrides persisted state
**Severity**: Critical
**Location**: All Pinia stores
**Pattern**: 
```typescript
const store = defineStore('xxx', () => {
  const state = ref(defaultValue) // 覆盖了 hydrate restore
  return { state }
})
```
**Fix**: Store 初始化时先检查 localStorage/SSR state

### R-S002: Async fetch race
**Severity**: High  
**Location**: `components/studio/execution/VoiceGeneration.vue`
**Pattern**: 
```typescript
onMounted(async () => {
  const data = await fetchCharacterSpecs()
  voiceConfigs.value = data // 如果另一个 onMounted 也调用了这个...
})
```
**Fix**: 增加 `_loading` guard 和 `_version` 计数器

### R-S003: localStorage direct access without key prefix
**Severity**: Medium
**Pattern**: 
```typescript
localStorage.getItem('modelCardProviderMap') // 没有版本号/前缀
```
**Risk**: 不同环境(dev/prod)key 冲突

### R-S004: Token dual-key pattern
**Severity**: Medium
**Location**: `composables/ai-task-util.ts`
**Pattern**:
```typescript
const bearerToken = token || localStorage.getItem('token') || ''
```
**Risk**: `'token'` vs `'auth_token'` 两个 key 并存，某些页面只用其中一个

### R-S005: No state validation on load
**Severity**: Medium
**Risk**: 从 localStorage 读取 JSON.parse 无 schema 校验，旧版本格式不兼容报错

---

## File Risk Index

| File | Lines | Risk Score | Key Issue |
|------|-------|------------|-----------|
| `VoiceGeneration.vue` | ~480 | 🔴 HIGH | 多重 watch/onMounted 竞态 |
| `ModelSettingsModal.vue` | ~280 | 🔴 HIGH | 双真相源(DB+localStorage) |
| `ai-task-util.ts` | ~120 | 🟡 MEDIUM | SSE 未 cleanup |
| `projectHydration.store` | ~150 | 🟡 MEDIUM | 无版本化更新 |
| `pipelineStore` | ~100 | 🟡 MEDIUM | Watch chain |
| `usePipelineStage.ts` | ~80 | 🟢 LOW | 简单封装 |
