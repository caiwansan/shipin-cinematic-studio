# Frontend Hydration Protocol

**目标**: 消除 hydration race / stale response / watch 链覆盖
**阶段**: Phase 1 — State Governance

---

## 1. 核心问题

```typescript
// ❌ 当前反模式
onMounted(async () => {
  const data = await fetchFromAPI()  // 异步，onMounted 不等待
  state.value = data                 // 可能覆盖后续更新
})

watch(() => props.xxx, () => {
  state.yyy = transform(props.xxx)  // 可能和 onMounted 竞争
})
```

---

## 2. 初始化生命周期协议

### 标准化顺序

```typescript
// ✅ 标准化初始化
const store = useStore()

// 阶段锁
const isHydrating = ref(true)

// 版本控制
const _version = ref(0)

// 加载状态
const _loading = ref(false)

async function initialize(id: string) {
  if (_loading.value) return  // 防重复
  _loading.value = true
  isHydrating.value = true
  
  try {
    const version = ++_version.value
    const data = await fetchFromAPI(id)
    
    // stale response guard
    if (version !== _version.value) return
    
    state.value = data
  } finally {
    isHydrating.value = false
    _loading.value = false
  }
}

// 所有 watch 检查阶段锁
watch(() => props.id, (newId) => {
  if (isHydrating.value) return  // ✅ 初始化阶段不触发
  initialize(newId)
})
```

---

## 3. Store Versioning 模式

### 实现

```typescript
// stores/base-store.ts
export function useVersionedStore() {
  const _version = ref(0)
  const _loading = ref(false)

  function isStale(version: number): boolean {
    return version !== _version.value
  }

  async function guardedFetch<T>(
    fetcher: () => Promise<T>
  ): Promise<T | null> {
    const version = ++_version.value
    _loading.value = true
    try {
      const result = await fetcher()
      if (isStale(version)) {
        console.warn('[Store] Stale response discarded')
        return null
      }
      return result
    } finally {
      _loading.value = false
    }
  }

  return { _version, _loading, isStale, guardedFetch }
}
```

### 使用

```typescript
// stores/pipelineStore.ts
const { _version, guardedFetch } = useVersionedStore()

async function loadPipeline(projectId: string) {
  const data = await guardedFetch(() => 
    fetch(`/api/project/${projectId}/pipeline`).then(r => r.json())
  )
  if (data) {
    runtimeGraph.value = data.runtimeGraph
    executionState.value = data.executionState
  }
}
```

---

## 4. Watch 安全准则

### ✅ 允许

```typescript
// 1. 有阶段锁保护
watch(source, handler)
// handler 内: if (isHydrating.value) return

// 2. 由用户操作触发的 watch
watch(source, handler)
// 用户操作总是在 hydration 完成后

// 3. 基于 id 变化的 watch（防 stale）
watch(() => props.id, initialize)
```

### ❌ 禁止

```typescript
// 1. 无锁的 watch 写 state
watch(source, () => { state.value = newValue })
// → 应加 isHydrating guard

// 2. 多个 watch 写同一字段
watch(a, () => state.x = a)
watch(b, () => state.x = transform(b))
// → 合并为一个 watch

// 3. 深 watch 大对象
watch(obj, handler, { deep: true })
// → 改用 shallow watch + 精确的 key 变化检测
```

---

## 5. 组件级生命周期模板

```typescript
// ✅ 标准模板
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ loaded: [] }>()

const isHydrating = ref(true)
const _version = ref(0)
const store = useStore()

// 初始化
onMounted(async () => {
  await store.initialize(props.id)
  isHydrating.value = false
  emit('loaded')
})

// 响应 id 变化
watch(() => props.id, (newId, oldId) => {
  if (isHydrating.value) return
  if (newId && newId !== oldId) {
    isHydrating.value = true
    store.initialize(newId).finally(() => {
      isHydrating.value = false
    })
  }
})

// 清理
onUnmounted(() => {
  // clean up SSE / interval / watchers
})
```

---

## 6. 竞态检测工具

```typescript
// devtools/race-detector.ts
export function detectRaceCondition() {
  const requests = new Map<string, number>()
  
  return {
    track(key: string) {
      const count = (requests.get(key) || 0) + 1
      requests.set(key, count)
      if (count > 1) {
        console.warn(`[RaceDetector] ${key} 同时有 ${count} 个请求 inflight`)
      }
      return () => {
        const newCount = (requests.get(key) || 1) - 1
        if (newCount <= 0) requests.delete(key)
        else requests.set(key, newCount)
      }
    },
    report() {
      if (requests.size > 0) {
        console.table([...requests.entries()].map(([k, v]) => ({ key: k, inflight: v })))
      }
    }
  }
}

// 使用
const raceDetector = detectRaceCondition()
const cleanup = raceDetector.track('load-pipeline')
const data = await fetchPipeline()
cleanup()
```

---

## 7. 具体文件修改清单

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `stores/pipelineStore.ts` | 加 version + guardedFetch | P0 |
| `stores/projectHydration.ts` | 加 version + stale guard | P0 |
| `components/studio/execution/VoiceGeneration.vue` | isHydrating 保护 watch | P1 |
| `composables/ai-task-util.ts` | AbortController + dedupe | P1 |
| `components/director/ModelSettingsModal.vue` | 保存后刷新 store | P1 |
