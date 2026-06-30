<template>
  <Teleport to="body">
    <div class="geo-toast-container">
      <TransitionGroup name="geo-toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="geo-toast"
          :class="`geo-toast--${toast.type}`"
        >
          <span class="geo-toast-icon">{{ toastIcons[toast.type] }}</span>
          <span class="geo-toast-message">{{ toast.message }}</span>
          <button v-if="toast.retry" class="geo-toast-retry" @click="handleRetry(toast)">重试</button>
          <button class="geo-toast-close" @click="removeToast(toast.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

interface ToastItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  retry?: boolean
  onRetry?: () => void
  duration?: number
}

const toastIcons: Record<string, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: '💡',
}

const toasts = ref<ToastItem[]>([])
let nextId = 1

function addToast(type: ToastItem['type'], message: string, options?: { retry?: boolean; onRetry?: () => void; duration?: number }) {
  const id = `toast-${nextId++}`
  const toast: ToastItem = {
    id,
    type,
    message,
    retry: options?.retry || false,
    onRetry: options?.onRetry,
    duration: options?.duration || 3000, // Default 3s
  }
  toasts.value.push(toast)

  if (toast.duration > 0) {
    setTimeout(() => removeToast(id), toast.duration)
  }
  return id
}

function removeToast(id: string) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function handleRetry(toast: ToastItem) {
  toast.onRetry?.()
  removeToast(toast.id)
}

function clearAll() {
  toasts.value = []
}

// Expose for global use
defineExpose({ addToast, removeToast, clearAll })

onUnmounted(() => { toasts.value = [] })
</script>

<style scoped>
.geo-toast-container {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.geo-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 13px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  min-width: 280px;
  max-width: 420px;
  pointer-events: auto;
  backdrop-filter: blur(8px);
}
.geo-toast--success { border-left: 3px solid #34d399; }
.geo-toast--error { border-left: 3px solid #ef4444; }
.geo-toast--warning { border-left: 3px solid #fbbf24; }
.geo-toast--info { border-left: 3px solid #818cf8; }

.geo-toast-icon { font-size: 16px; line-height: 1; }
.geo-toast-message { flex: 1; line-height: 1.4; }
.geo-toast-retry {
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(129, 140, 248, 0.3);
  background: transparent;
  color: #818cf8;
  font-size: 11px;
  cursor: pointer;
  font-weight: 600;
}
.geo-toast-retry:hover { background: rgba(129, 140, 248, 0.1); }
.geo-toast-close {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  padding: 2px;
}
.geo-toast-close:hover { color: #ccc; }

/* Transitions */
.geo-toast-enter-active { transition: all 0.3s ease; }
.geo-toast-leave-active { transition: all 0.2s ease; }
.geo-toast-enter-from { opacity: 0; transform: translateY(20px); }
.geo-toast-leave-to { opacity: 0; transform: translateY(20px); }
</style>
