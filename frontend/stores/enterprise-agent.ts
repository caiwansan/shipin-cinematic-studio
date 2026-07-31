import { getAuthToken } from '~/utils/auth/token'
/**
 * Enterprise Agent Store — AI 员工管理
 * Phase 3.3 P0-2: AI Employee CRUD
 *
 * Architecture: Vue Component → Pinia Store → Composable/API → Backend
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface EnterpriseAgent {
  id: string
  name: string
  role: string
  agentType: string
  status: 'active' | 'paused' | 'archived' | 'draft'
  runtimeStatus: 'draft' | 'active' | 'paused' | 'archived'
  runtimeAgentId: string | null
  description: string
  goal: string
  modelName: string | null
  provider: string | null
  todayTasks: number
  totalTasks: number
  healthScore: number
  lastActiveAt: string | null
  createdAt: string
}

export interface AgentModelBinding {
  id: string
  agentId: string
  credentialId: string
  provider: string
  modelName: string
  enabled: boolean
}

export interface CreateAgentPayload {
  name: string
  role: string
  description?: string
  goal?: string
  agentType?: string
  knowledgeScope?: string
  capabilities?: string
}

export interface BindModelPayload {
  agentId: string
  credentialId: string
  provider: string
  modelName: string
  reasoningMode?: string
}

export const useEnterpriseAgentStore = defineStore('enterpriseAgent', () => {
  // ═══════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════
  const agents = ref<EnterpriseAgent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedAgentId = ref<string | null>(null)

  // ═══════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════
  const activeAgents = computed(() => agents.value.filter(a => a.status === 'active'))
  const deployedAgents = computed(() => agents.value.filter(a => a.runtimeStatus === 'active'))
  const needsSetup = computed(() => agents.value.filter(a => !a.runtimeAgentId || a.runtimeStatus === 'draft'))

  // ═══════════════════════════════════════════════════════════
  // Helper: Auth Headers
  // ═══════════════════════════════════════════════════════════
  function getAuthHeaders(): Record<string, string> {
    const token = getAuthToken() || ''
    const organizationId = localStorage.getItem('organization_id') || ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (organizationId) headers['X-Organization-Id'] = organizationId
    return headers
  }

  // ═══════════════════════════════════════════════════════════
  // Fetch All Agents
  // ═══════════════════════════════════════════════════════════
  async function fetchAgents(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/enterprise/agent-profiles', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`API ${res.status}: 获取员工列表失败`)
      const json = await res.json()
      agents.value = json.data || []
    } catch (e: any) {
      error.value = e.message
      agents.value = []
    } finally {
      loading.value = false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Fetch Single Agent Detail
  // ═══════════════════════════════════════════════════════════
  async function fetchAgentDetail(agentId: string): Promise<EnterpriseAgent | null> {
    try {
      const res = await fetch(`/api/enterprise/agent-profiles/${agentId}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`API ${res.status}: 获取员工详情失败`)
      const json = await res.json()
      return json.data || null
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Create Agent (Identity Only)
  // ═══════════════════════════════════════════════════════════
  async function createAgent(payload: CreateAgentPayload): Promise<EnterpriseAgent | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/enterprise/agent-profiles', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `API ${res.status}: 创建员工失败`)
      }
      const json = await res.json()
      const newAgent = json.data
      if (newAgent) {
        agents.value.push(newAgent)
      }
      return newAgent
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Update Agent
  // ═══════════════════════════════════════════════════════════
  async function updateAgent(agentId: string, updates: Partial<EnterpriseAgent>): Promise<boolean> {
    try {
      const res = await fetch(`/api/enterprise/agent-profiles/${agentId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error(`API ${res.status}: 更新失败`)
      const json = await res.json()
      // Update local state
      const idx = agents.value.findIndex(a => a.id === agentId)
      if (idx !== -1 && json.data) {
        agents.value[idx] = { ...agents.value[idx], ...json.data }
      }
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Toggle Agent (Active/Paused)
  // ═══════════════════════════════════════════════════════════
  async function toggleAgent(agentId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/enterprise/agent-profiles/${agentId}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`API ${res.status}: 切换状态失败`)
      // Refresh local state
      const idx = agents.value.findIndex(a => a.id === agentId)
      if (idx !== -1) {
        agents.value[idx].status = agents.value[idx].status === 'active' ? 'paused' : 'active'
      }
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Deploy Agent (Runtime)
  // ═══════════════════════════════════════════════════════════
  async function deployAgent(agentId: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/agent-runtime/agents/${agentId}/deploy`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `API ${res.status}: 部署失败`)
      }
      // Update local state
      const idx = agents.value.findIndex(a => a.id === agentId)
      if (idx !== -1) {
        agents.value[idx].runtimeStatus = 'active'
        agents.value[idx].status = 'active'
      }
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    } finally {
      loading.value = false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Pause Agent (Runtime)
  // ═══════════════════════════════════════════════════════════
  async function pauseAgent(agentId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/agent-runtime/agents/${agentId}/pause`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`API ${res.status}: 暂停失败`)
      const idx = agents.value.findIndex(a => a.id === agentId)
      if (idx !== -1) {
        agents.value[idx].runtimeStatus = 'paused'
      }
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Execute Task on Agent
  // ═══════════════════════════════════════════════════════════
  async function executeTask(agentId: string, task: string): Promise<any> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/agent-runtime/agents/${agentId}/execute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ task }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `API ${res.status}: 执行失败`)
      }
      const json = await res.json()
      return json.data
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Bind Model to Agent
  // ⚠️ KMKI AUDIT-02: 旧 provider-management 死表 API（enterpriseProviderCredential 表不存在）
  // 已改为走 /api/enterprise/model-config（OrgModelConfig + ProviderCredential 唯一权威）
  // ═══════════════════════════════════════════════════════════
  async function bindModel(payload: BindModelPayload): Promise<boolean> {
    try {
      const res = await fetch('/api/enterprise/model-config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          provider: payload.provider,
          model: payload.modelName,
          apiKey: '', // 不覆盖已存 Key（仅更新模型选择）—— 若需换 Key 请走 AI模型设置页
          isDefault: false,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `API ${res.status}: 绑定模型失败`)
      }
      // Update local state
      const idx = agents.value.findIndex(a => a.id === payload.agentId)
      if (idx !== -1) {
        agents.value[idx].modelName = payload.modelName
        agents.value[idx].provider = payload.provider
      }
      return true
    } catch (e: any) {
      error.value = e.message
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Get Agent Model Binding（KMKI: 从统一模型设置读取，不再读死表）
  // ═══════════════════════════════════════════════════════════
  async function getAgentBinding(agentId: string): Promise<AgentModelBinding | null> {
    try {
      const res = await fetch('/api/enterprise/model-config', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const json = await res.json()
      const settings: any[] = json?.data?.settings || []
      const s = settings.find((x: any) => x.id === agentId) || settings[0] || null
      if (!s) return null
      return {
        id: s.id,
        agentId,
        credentialId: s.credentialId || '',
        provider: s.provider,
        modelName: s.model,
        enabled: !!s.isDefault || !!s.hasCredential,
      }
    } catch {
      return null
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Get Available Credentials (for model binding)
  // ═══════════════════════════════════════════════════════════
  async function getAvailableCredentials(): Promise<any[]> {
    try {
      const res = await fetch('/api/provider-management/credentials', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const json = await res.json()
      return json.data || []
    } catch {
      return []
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════
  function selectAgent(agentId: string | null) {
    selectedAgentId.value = agentId
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    agents, loading, error, selectedAgentId,
    // Computed
    activeAgents, deployedAgents, needsSetup,
    // Actions
    fetchAgents, fetchAgentDetail, createAgent, updateAgent,
    toggleAgent, deployAgent, pauseAgent, executeTask,
    bindModel, getAgentBinding, getAvailableCredentials,
    selectAgent, clearError,
  }
})
