/**
 * useEnterpriseContext — 企业招聘工作台统一企业上下文
 * 
 * 唯一合法获取企业 ID / 工作空间 ID 的入口。
 * 禁止在页面中直接使用 localStorage.getItem('enterprise_id') 或硬编码 fallback。
 */
import { ref, computed } from 'vue'

const ENTERPRISE_STORAGE_KEY = 'enterprise_id'
const WORKSPACE_STORAGE_KEY = 'workspace_id'

// ─── 单例状态（全局共享）───
const enterpriseId = ref<string>('')
const workspaceId = ref<string>('')
const initialized = ref(false)

function initFromStorage() {
  if (initialized.value || !import.meta.client) return
  enterpriseId.value = localStorage.getItem(ENTERPRISE_STORAGE_KEY) || ''
  workspaceId.value = localStorage.getItem(WORKSPACE_STORAGE_KEY) || ''
  initialized.value = true
}

export function useEnterpriseContext() {
  initFromStorage()

  const hasEnterprise = computed(() => !!enterpriseId.value)
  const hasWorkspace = computed(() => !!workspaceId.value)

  function setEnterprise(id: string) {
    enterpriseId.value = id
    localStorage.setItem(ENTERPRISE_STORAGE_KEY, id)
  }

  function setWorkspace(id: string) {
    workspaceId.value = id
    localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
  }

  function clear() {
    enterpriseId.value = ''
    workspaceId.value = ''
    localStorage.removeItem(ENTERPRISE_STORAGE_KEY)
    localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  }

  /**
   * 获取企业 ID。
   * 如果未设置，返回空字符串（而非硬编码 fallback）。
   * 调用方必须检查返回值。
   */
  function getEnterpriseId(): string {
    initFromStorage()
    return enterpriseId.value
  }

  function getWorkspaceId(): string {
    initFromStorage()
    return workspaceId.value
  }

  return {
    enterpriseId,
    workspaceId,
    hasEnterprise,
    hasWorkspace,
    getEnterpriseId,
    getWorkspaceId,
    setEnterprise,
    setWorkspace,
    clear,
  }
}
