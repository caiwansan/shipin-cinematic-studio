/**
 * RC-W1-D: 统一 Toast 系统
 *
 * 用法：
 *   import { toast } from '~/composables/useToast'
 *   toast.success('Discovery 完成', '发现了 12 个优化机会', '/workspace/geo/discovery')
 *   toast.warning('DeepSeek 超时', '已切换为 ChatGPT')
 *   toast.error('推送失败', '请检查 Provider 凭证')
 */

import { ref, type Ref } from 'vue'

export interface ToastMessage {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  detail?: string
  route?: string
  duration?: number
}

const toasts: Ref<ToastMessage[]> = ref([])
let nextId = 0

function add(t: Omit<ToastMessage, 'id'>) {
  const id = `toast-${++nextId}`
  const msg: ToastMessage = { ...t, id }
  toasts.value.push(msg)
  const duration = t.duration || 4000
  setTimeout(() => {
    toasts.value = toasts.value.filter((m) => m.id !== id)
  }, duration)
}

/** 供 ToastContainer 使用 */
export function useToastState() {
  return { toasts }
}

export function toastSuccess(title: string, detail?: string, route?: string) {
  add({ type: 'success', title, detail, route })
}

export function toastWarning(title: string, detail?: string, route?: string) {
  add({ type: 'warning', title, detail, route })
}

export function toastError(title: string, detail?: string, route?: string) {
  add({ type: 'error', title, detail, route })
}

export function toastInfo(title: string, detail?: string, route?: string) {
  add({ type: 'info', title, detail, route })
}

/** Engine 事件通知缩写 */
export function toastEngineCompleted(name: string, detail: string, route?: string) {
  toastSuccess(`${name} 已完成`, detail, route)
}

export function toastEngineQueued(name: string, detail: string, route?: string) {
  toastInfo(`${name} 已排队`, detail, route)
}

export function toastEngineFailed(name: string, reason: string, route?: string) {
  toastError(`${name} 失败`, reason, route)
}
