// ============================================================================
// 盘古斧 AI OS — Phase 7A-BOOT SSE Composable
// 前端 SSE 连接器：连接到 Runtime Event Bus 实时事件流
// ============================================================================

import { ref, onMounted, onUnmounted } from 'vue'
import { useWorkbenchStore } from '~/stores/workbench'

interface SSEEvent {
  type: string
  tick: number
  timestamp: string
  data: Record<string, unknown>
  traceId?: string
}

export function useSSEStream() {
  const store = useWorkbenchStore()
  const connected = ref(false)
  const lastEvent = ref<SSEEvent | null>(null)
  const eventCount = ref(0)
  let eventSource: EventSource | null = null

  function connect(url = '/api/events') {
    if (eventSource) disconnect()

    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      connected.value = true
      store.pushEvent('info', 'SSE stream connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data)
        lastEvent.value = parsed
        eventCount.value++

        // 根据事件类型同步到 Pinia store
        switch (parsed.type) {
          case 'health.update':
            store.healthScore = (parsed.data as any).healthScore ?? store.healthScore
            store.driftRate = (parsed.data as any).driftRate ?? store.driftRate
            store.recoveryRate = (parsed.data as any).recoveryRate ?? store.recoveryRate
            store.loadTier = (parsed.data as any).loadTier ?? store.loadTier
            break

          case 'runtime.status':
            store.pushEvent('info', `Runtime: ${(parsed.data as any).message}`)
            break

          case 'dag.complete':
            store.pushEvent('info', `DAG complete: ${(parsed.data as any).dagId}`)
            break

          case 'dag.error':
            store.pushEvent('warn', `DAG error: ${(parsed.data as any).dagId}`)
            break

          case 'repair.trigger':
            store.pushEvent('warn', `Repair triggered: ${(parsed.data as any).issue}`)
            break

          case 'repair.complete':
            store.pushEvent('info', `Repair complete: ${(parsed.data as any).repairId}`)
            break

          default:
            // 静默处理——不是所有事件都需要 UI 通知
            break
        }
      } catch {
        // 心跳或非 JSON 消息
      }
    }

    eventSource.onerror = () => {
      connected.value = false
      store.pushEvent('error', 'SSE stream disconnected — retrying in 5s')
      // 自动重连
      setTimeout(() => {
        if (eventSource?.readyState === EventSource.CLOSED) {
          connect(url)
        }
      }, 5000)
    }
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
      connected.value = false
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    lastEvent,
    eventCount,
    connect,
    disconnect
  }
}
