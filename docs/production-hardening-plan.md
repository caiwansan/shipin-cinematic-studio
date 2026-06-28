# Production Hardening Plan

**目标**: 系统达到稳定运营标准
**阶段**: Phase 3 — Production Hardening

---

## 1. SSE / EventSource Cleanup

### 当前问题

```typescript
// ai-task-util.ts — 组件卸载后 SSE 仍在运行
const eventSource = new EventSource(url)
eventSource.onmessage = (e) => {
  // 如果组件已 unmount，仍然在更新内存
}
```

### 修复方案

```typescript
// composables/useTaskStream.ts
import { ref, onUnmounted } from 'vue'

export function useTaskStream() {
  const eventSource = ref<EventSource | null>(null)
  const abortController = new AbortController()

  function connect(url: string, handlers: {
    onProgress?: (data: any) => void
    onComplete?: (data: any) => void
    onError?: (err: any) => void
  }) {
    // 关闭旧的连接
    disconnect()
    
    const es = new EventSource(url)
    eventSource.value = es
    
    es.onmessage = (e) => {
      if (abortController.signal.aborted) {
        es.close()
        return
      }
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'progress') handlers.onProgress?.(data)
        else if (data.type === 'complete') handlers.onComplete?.(data)
      } catch {}
    }
    
    es.onerror = (err) => {
      handlers.onError?.(err)
      es.close()
    }
  }

  function disconnect() {
    eventSource.value?.close()
    eventSource.value = null
  }

  // 组件卸载自动清理
  onUnmounted(disconnect)

  return { connect, disconnect, abortController }
}
```

### 其他 SSE/WS 检查点

| 位置 | 有 cleanup? | 修复 |
|------|-------------|------|
| `ai-task-util.ts` | ❌ | 换用 `useTaskStream` |
| `studio/PipelineProgress.vue` | ❌ | 加 onUnmounted |
| `studio/JobTimeline.vue` | ❌ | 加 onUnmounted |

---

## 2. Request Deduplication

### 问题

```typescript
// 快速切换 tab 时重复请求
// Tab A → fetch('/api/pipeline')  pending
// Tab B → fetch('/api/pipeline')  pending (同样请求)
// 两个都返回，后一个覆盖前一个
```

### 方案

```typescript
// composables/useDedupe.ts
const inflightRequests = new Map<string, Promise<any>>()

export function dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inflightRequests.has(key)) {
    console.log(`[Dedupe] Reusing inflight request: ${key}`)
    return inflightRequests.get(key)!
  }
  
  const promise = fetcher().finally(() => {
    inflightRequests.delete(key)
  })
  
  inflightRequests.set(key, promise)
  return promise
}

// 使用
const data = await dedupe('load-pipeline-' + projectId, () => 
  fetch(`/api/pipeline/${projectId}`).then(r => r.json())
)
```

### 需去重的请求

| 请求 | Key | 优先级 |
|------|-----|--------|
| `/api/pipeline/:id` | `pipeline-${id}` | P1 |
| `/api/user/info` | `user-info` | P1 |
| `/api/project/:id` | `project-${id}` | P1 |
| `/api/model-providers` | `model-providers` | P2 |

---

## 3. 构建版本验证

### 问题

```text
Deploy v5 → nginx cache 旧 chunk
User 浏览器还在加载 v4 的 .js
v4 chunk 请求 v5 的 API → 500
```

### 方案

**后端注入版本号**:

```typescript
// backend/src/config/version.ts
export const BUILD_VERSION = process.env.BUILD_VERSION || 'dev-' + Date.now()
export const BUILD_TIMESTAMP = new Date().toISOString()
```

**前端版本检测**:

```typescript
// plugins/version-check.client.ts
export default defineNuxtPlugin(() => {
  const currentVersion = __BUILD_VERSION__  // 由 Vite define 注入
  
  // 异步检查服务端版本
  async function checkVersion() {
    try {
      const res = await fetch('/api/system/version')
      const { buildVersion } = await res.json()
      
      if (buildVersion && buildVersion !== currentVersion) {
        console.warn('[Version] Mismatch detected, suggesting refresh')
        // 显示版本更新提示
        const shouldRefresh = confirm('系统已更新，请刷新页面')
        if (shouldRefresh) window.location.reload()
      }
    } catch {}
  }
  
  checkVersion()
  setInterval(checkVersion, 60000)  // 每分钟检查
})
```

**Vite define 注入**:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    define: {
      __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || 'dev'),
    }
  }
})
```

---

## 4. Nginx Cache 策略

### 当前配置

```nginx
# /www/server/panel/vhost/nginx/aigc.fushtn.com.conf
# 可能是：
location / {
  proxy_pass http://localhost:4001
}
```

### 建议配置

```nginx
# Hashed assets — 强缓存（文件名 hash 保证一致性）
location ~* \.(js|css|svg|png|jpg|ico) {
  proxy_pass http://localhost:4001;
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML — 不缓存（每次请求新版本）
location / {
  proxy_pass http://localhost:4001;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# API — 不缓存
location /api/ {
  proxy_pass http://localhost:4002;
  add_header Cache-Control "no-store";
}
```

---

## 5. 部署脚本增强

### 当前

```bash
pm2 restart api-server
# frontend:
rm -rf .nuxt .output
npx nuxi build
pm2 restart frontend
```

### 增强

```bash
#!/bin/bash
# deploy.sh

set -e

# 1. 版本标记
VERSION="build-$(date +%Y%m%d-%H%M%S)"
export BUILD_VERSION=$VERSION

echo "=== Deploy v$VERSION ==="

# 2. 后端
echo "--- Backend ---"
cd /root/shipin-cinematic-studio/backend
npm run compile
pm2 restart api-server --update-env

# 3. 前端
echo "--- Frontend ---"
cd /root/shipin-cinematic-studio/frontend
rm -rf .nuxt .output

# 写入版本文件
echo "{\"version\":\"$VERSION\",\"builtAt\":\"$(date -Iseconds)\"}" > public/version.json

npx nuxi build
pm2 restart frontend --update-env

# 4. 验证
echo "--- Verification ---"
sleep 2
curl -s http://localhost:4001/api/system/version | grep $VERSION && echo "✅ Frontend OK" || echo "❌ Frontend failed"
curl -s http://localhost:4002/api/system/version | grep $VERSION && echo "✅ Backend OK" || echo "❌ Backend failed"

echo "=== Deploy $VERSION complete ==="
```

---

## 6. 多 Tab 状态同步

### 问题

```text
Tab A: 保存 provider = siliconflow
Tab B: 还没刷新，显示 provider = aliyun
Tab B 保存 → 覆盖 Tab A 的修改
```

### 方案

```typescript
// composables/useCrossTabSync.ts
import { watch } from 'vue'

const CHANNEL_NAME = 'app-state-sync'

export function useCrossTabSync(storeName: string, state: any) {
  if (typeof window === 'undefined') return  // SSR guard
  
  const channel = new BroadcastChannel(CHANNEL_NAME)
  
  // 收到其他 tab 的更新 → 更新本地 store
  channel.onmessage = (event) => {
    const { store, data, version } = event.data
    if (store === storeName && data.version > state._version) {
      console.log(`[CrossTab] ${storeName} updated from another tab`)
      Object.assign(state, data)
    }
  }
  
  // 本地更新 → 通知其他 tab
  watch(() => state._version, (newVersion) => {
    if (newVersion > 0) {
      channel.postMessage({
        store: storeName,
        data: JSON.parse(JSON.stringify(state)),
        version: newVersion,
      })
    }
  })
  
  onUnmounted(() => channel.close())
}
```

---

## 7. 性能与内存

### 需要检查

| 项目 | 当前 | 目标 |
|------|------|------|
| Pinia store 未清理 watchers | ❌ | onUnmounted 清理 |
| 大 JSON 频繁 deep watch | ❌ | shallow watch |
| SSE 未关闭 | ❌ | AbortController |
| 定时器未清理 | ❌ | clearInterval on unmount |
| console.log 在生产环境 | ⚠️ | 用 logger 控制级别 |

### 日志治理

```typescript
// utils/logger.ts
export const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.debug('[DEBUG]', ...args)
  },
  info: (...args: any[]) => console.info('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
}
```

替换所有 `console.log` → `logger.info` / `logger.debug`。

---

## 8. 修复优先级总表

| # | Task | Phase | Effort | Impact |
|---|------|-------|--------|--------|
| 1 | Versioned store (guardedFetch) | P1 | 半天 | 🔴 消除 stale response |
| 2 | SSE cleanup (useTaskStream) | P1 | 半天 | 🔴 内存泄漏 |
| 3 | Request dedupe | P1 | 2小时 | 🟡 减少重复请求 |
| 4 | Build version check | P1 | 半天 | 🟡 版本不一致检测 |
| 5 | Nginx cache config | P2 | 30分钟 | ✅ 缓存策略 |
| 6 | Cross-tab sync | P2 | 半天 | 🟡 多 tab 安全 |
| 7 | Logger replacement | P2 | 1小时 | ✅ 生产日志 |
| 8 | deploy.sh 自动化 | P2 | 1小时 | ✅ 部署一致性 |
