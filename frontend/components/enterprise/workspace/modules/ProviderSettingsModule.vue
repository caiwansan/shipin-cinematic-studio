<!-- ProviderSettingsModule.vue — Enterprise Workspace Module -->
<!-- Phase 3.1.3-B — Provider Credential Management -->
<!-- 嵌入企业工作台的 Provider 配置模块 -->

<template>
  <div class="provider-settings-module space-y-6">
    <!-- Module Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-bold text-white flex items-center gap-2">
          <span>🔐</span>
          <span>AI 模型与供应商</span>
        </h1>
        <p class="text-xs text-gray-400 mt-1">配置企业 AI Provider，加密存储，多模型切换</p>
      </div>
      <button
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        @click="showAddModal = true"
      >
        <span>+</span>
        <span>添加 Provider</span>
      </button>
    </div>

    <!-- Health Status Banner -->
    <div v-if="healthStatus" class="rounded-lg p-4" :class="healthBannerClass">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ healthIcon }}</span>
        <div>
          <div class="font-medium text-sm">{{ healthTitle }}</div>
          <div class="text-xs opacity-80">{{ healthMessage }}</div>
        </div>
      </div>
    </div>

    <!-- Provider List -->
    <div class="space-y-3">
      <div
        v-for="cred in credentials"
        :key="cred.id"
        class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 space-y-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ providerEmoji[cred.provider] || '🔮' }}</span>
            <div>
              <div class="text-base font-semibold text-white">{{ providerName[cred.provider] || cred.provider }}</div>
              <div class="text-xs text-gray-500">{{ cred.modelName }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-medium"
              :class="cred.isDefault ? 'bg-blue-500/10 text-blue-300' : 'bg-gray-500/10 text-gray-400'"
            >
              {{ cred.isDefault ? '默认' : '备选' }}
            </span>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-medium"
              :class="statusClass(cred.healthStatus)"
            >
              {{ statusText(cred.healthStatus) }}
            </span>
          </div>
        </div>

        <!-- Key Preview -->
        <div class="flex items-center gap-4">
          <div class="flex-1 bg-[#060A18] rounded-lg px-4 py-2">
            <div class="text-[10px] text-gray-500 mb-1">API Key</div>
            <div class="text-sm text-gray-300 font-mono">sk-****{{ cred.keyPreview || '••••' }}</div>
          </div>
          <div class="bg-[#060A18] rounded-lg px-4 py-2">
            <div class="text-[10px] text-gray-500 mb-1">Base URL</div>
            <div class="text-sm text-gray-300 font-mono">{{ cred.baseUrl || '默认' }}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <button
            class="text-xs text-blue-400 hover:text-blue-300 py-1 px-3 border border-blue-500/20 rounded-lg hover:bg-blue-500/5 transition"
            @click="checkHealth(cred.provider)"
            :disabled="checkingHealth"
          >
            {{ checkingHealth ? '检查中...' : '健康检查' }}
          </button>
          <button
            class="text-xs text-gray-400 hover:text-gray-300 py-1 px-3 border border-gray-500/20 rounded-lg hover:bg-gray-500/5 transition"
            @click="setDefault(cred.id)"
            :disabled="cred.isDefault"
          >
            设为默认
          </button>
          <button
            class="text-xs text-red-400 hover:text-red-300 py-1 px-3 border border-red-500/20 rounded-lg hover:bg-red-500/5 transition"
            @click="revokeCredential(cred.id)"
          >
            吊销
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="credentials.length === 0" class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-12 text-center space-y-4">
        <div class="text-4xl">🔐</div>
        <div class="text-base font-medium text-white">尚未配置任何 Provider</div>
        <div class="text-sm text-gray-400">添加 DeepSeek、OpenAI 等 AI 供应商的 API Key，AI新媒体运营部门即可开始工作</div>
        <button
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
          @click="showAddModal = true"
        >
          + 添加第一个 Provider
        </button>
      </div>
    </div>

    <!-- Agent Bindings -->
    <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 space-y-4">
      <h2 class="text-base font-semibold text-white">Agent 模型绑定</h2>
      <p class="text-xs text-gray-400">每个 AI 员工可以绑定不同的模型，实现最优成本与效果</p>
      
      <div class="space-y-2">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="flex items-center justify-between bg-[#060A18] rounded-lg px-4 py-3"
        >
          <div class="flex items-center gap-3">
            <span class="text-lg">{{ agentEmoji[agent.role] || '🤖' }}</span>
            <div>
              <div class="text-sm font-medium text-white">{{ agent.name }}</div>
              <div class="text-[10px] text-gray-500">{{ agent.role }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">
              {{ agent.binding ? `${agent.binding.provider}/${agent.binding.modelName}` : '未绑定' }}
            </span>
            <button
              class="text-[10px] text-blue-400 hover:text-blue-300 px-2 py-1 border border-blue-500/20 rounded"
              @click="bindAgent(agent)"
            >
              {{ agent.binding ? '切换' : '绑定' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Provider Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/60" @click="showAddModal = false"></div>
        <div class="relative bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-white">添加 Provider</h3>
            <button class="text-gray-400 hover:text-white" @click="showAddModal = false">✕</button>
          </div>

          <!-- Provider Selection -->
          <div class="space-y-2">
            <label class="text-sm text-gray-300">供应商</label>
            <select
              v-model="newProvider.provider"
              class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option v-for="p in supportedProviders" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>

          <!-- Model Name -->
          <div class="space-y-2">
            <label class="text-sm text-gray-300">模型名称</label>
            <input
              v-model="newProvider.modelName"
              type="text"
              placeholder="例如: deepseek-v4-flash"
              class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <!-- API Key -->
          <div class="space-y-2">
            <label class="text-sm text-gray-300">API Key</label>
            <div class="relative">
              <input
                v-model="newProvider.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="sk-..."
                class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-4 py-2.5 pr-12 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                @click="showApiKey = !showApiKey"
              >
                {{ showApiKey ? '🙈' : '👁️' }}
              </button>
            </div>
            <p class="text-[10px] text-gray-500">🔒 AES-256-GCM 加密存储，仅 Gateway 执行时解密</p>
          </div>

          <!-- Base URL -->
          <div class="space-y-2">
            <label class="text-sm text-gray-300">Base URL <span class="text-gray-500">(可选)</span></label>
            <input
              v-model="newProvider.baseUrl"
              type="text"
              placeholder="留空使用默认端点"
              class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          <!-- Set as Default -->
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="newProvider.isDefault" class="accent-blue-500" />
            <span class="text-sm text-gray-300">设为默认 Provider</span>
          </label>

          <!-- Error -->
          <div v-if="addError" class="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-xs text-red-300">
            {{ addError }}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <button
              class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              @click="createCredential"
              :disabled="!newProvider.apiKey || !newProvider.modelName || creating"
            >
              {{ creating ? '创建中...' : '创建并加密存储' }}
            </button>
            <button
              class="px-4 py-2.5 border border-gray-500/20 text-gray-300 text-sm rounded-lg hover:bg-gray-500/5 transition"
              @click="showAddModal = false"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, reactive, onMounted, computed } from 'vue'

// ─── Types ───
interface Credential {
  id: string
  provider: string
  modelName: string
  baseUrl: string | null
  isDefault: boolean
  status: string
  healthStatus: string
  keyPreview?: string
  createdAt: string
}

interface Agent {
  id: string
  name: string
  role: string
  binding?: { provider: string; modelName: string }
}

// ─── State ───
const credentials = ref<Credential[]>([])
const agents = ref<Agent[]>([])
const loading = ref(false)
const checkingHealth = ref(false)
const showAddModal = ref(false)
const showApiKey = ref(false)
const creating = ref(false)
const addError = ref('')
const healthStatus = ref<any>(null)

const newProvider = reactive({
  provider: 'deepseek',
  modelName: 'deepseek-v4-flash',
  apiKey: '',
  baseUrl: '',
  isDefault: true,
})

// ─── Constants ───
const providerEmoji: Record<string, string> = {
  deepseek: '🔮', openai: '🧠', qwen: '🌙', doubao: '🪨',
  anthropic: '🛡️', zhipu: '⚡', kimi: '🌑', siliconflow: '💎',
  volcengine: '🌋', bailian: '☁️',
}

const providerName: Record<string, string> = {
  deepseek: 'DeepSeek', openai: 'OpenAI', qwen: '通义千问', doubao: '豆包',
  anthropic: 'Anthropic Claude', zhipu: '智谱 GLM', kimi: '月之暗面 Kimi',
  siliconflow: 'SiliconFlow', volcengine: '火山引擎', bailian: '阿里云百炼',
}

const agentEmoji: Record<string, string> = {
  analyst: '📊', sales: '💼', support: '🎧', marketing: '📢',
  content: '✍️', customer: '🤝', growth: '📈',
}

const supportedProviders = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'qwen', name: '通义千问' },
  { id: 'doubao', name: '豆包' },
  { id: 'anthropic', name: 'Claude' },
  { id: 'zhipu', name: '智谱 GLM' },
  { id: 'kimi', name: 'Kimi' },
]

// ─── Computed ───
const healthIcon = computed(() => {
  if (!healthStatus.value) return '🔍'
  const s = healthStatus.value.status
  if (s === 'healthy') return '✅'
  if (s === 'invalid_key') return '🔑'
  if (s === 'missing_key') return '❌'
  return '⚠️'
})

const healthTitle = computed(() => {
  if (!healthStatus.value) return ''
  const s = healthStatus.value.status
  if (s === 'healthy') return 'Provider 连接正常'
  if (s === 'invalid_key') return 'API Key 无效'
  if (s === 'missing_key') return '未配置 Provider'
  return 'Provider 状态异常'
})

const healthMessage = computed(() => healthStatus.value?.message || '')

const healthBannerClass = computed(() => {
  if (!healthStatus.value) return 'bg-gray-500/10 text-gray-300'
  const s = healthStatus.value.status
  if (s === 'healthy') return 'bg-green-500/10 text-green-300'
  if (s === 'invalid_key') return 'bg-yellow-500/10 text-yellow-300'
  if (s === 'missing_key') return 'bg-red-500/10 text-red-300'
  return 'bg-orange-500/10 text-orange-300'
})

// ─── Helpers ───
function statusClass(status: string): string {
  if (status === 'healthy') return 'bg-green-500/10 text-green-300'
  if (status === 'invalid_key') return 'bg-yellow-500/10 text-yellow-300'
  if (status === 'missing_key') return 'bg-red-500/10 text-red-300'
  return 'bg-gray-500/10 text-gray-400'
}

function statusText(status: string): string {
  if (status === 'healthy') return '正常'
  if (status === 'invalid_key') return 'Key 无效'
  if (status === 'missing_key') return '未配置'
  return '未知'
}

async function apiFetch(path: string, options: any = {}) {
  const token = getAuthToken() || ''
  const orgId = localStorage.getItem('organization_id') || ''
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Organization-Id': orgId,
      ...options.headers,
    },
  })
  return res
}

// ─── CRUD ───
async function loadCredentials() {
  loading.value = true
  try {
    const res = await apiFetch('/api/provider-management/credentials')
    if (res.ok) {
      const json = await res.json()
      credentials.value = json.data || []
    }
  } catch (e) {
    console.error('Failed to load credentials:', e)
  } finally {
    loading.value = false
  }
}

async function loadAgents() {
  try {
    const res = await apiFetch('/api/agent-runtime/agents')
    if (res.ok) {
      const json = await res.json()
      const agentList = (json.data || json || []).slice(0, 10)
      
      agents.value = await Promise.all(
        agentList.map(async (a: any) => {
          try {
            const bRes = await apiFetch(`/api/provider-management/bindings/${a.id}`)
            const bJson = bRes.ok ? await bRes.json() : null
            return {
              id: a.id,
              name: a.name,
              role: a.role,
              binding: bJson?.data ? {
                provider: bJson.data.provider,
                modelName: bJson.data.modelName,
              } : undefined,
            }
          } catch {
            return { id: a.id, name: a.name, role: a.role }
          }
        })
      )
    }
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

async function createCredential() {
  creating.value = true
  addError.value = ''
  try {
    const res = await apiFetch('/api/provider-management/credentials', {
      method: 'POST',
      body: JSON.stringify(newProvider),
    })
    const json = await res.json()
    if (json.success) {
      showAddModal.value = false
      newProvider.apiKey = ''
      newProvider.modelName = 'deepseek-v4-flash'
      newProvider.baseUrl = ''
      newProvider.isDefault = true
      showApiKey.value = false
      await loadCredentials()
      await checkHealth(newProvider.provider)
    } else {
      addError.value = json.error || '创建失败'
    }
  } catch (e: any) {
    addError.value = e.message || '网络错误'
  } finally {
    creating.value = false
  }
}

async function checkHealth(provider: string) {
  checkingHealth.value = true
  try {
    const res = await apiFetch(`/api/provider-management/health/${provider}`)
    if (res.ok) {
      const json = await res.json()
      healthStatus.value = json.data
      const cred = credentials.value.find(c => c.provider === provider)
      if (cred) {
        cred.healthStatus = json.data.status
      }
    }
  } catch (e) {
    console.error('Health check failed:', e)
  } finally {
    checkingHealth.value = false
  }
}

async function setDefault(id: string) {
  console.log('Set default:', id)
  await loadCredentials()
}

async function revokeCredential(id: string) {
  if (!confirm('确定要吊销此 Provider 凭证吗？绑定此凭证的 Agent 将无法执行任务。')) return
  try {
    const res = await apiFetch(`/api/provider-management/credentials/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await loadCredentials()
    }
  } catch (e) {
    console.error('Failed to revoke:', e)
  }
}

function bindAgent(_agent: Agent) {
  showAddModal.value = true
}

// ─── Lifecycle ───
onMounted(() => {
  loadCredentials()
  loadAgents()
})
</script>

<style scoped>
.provider-settings-module {
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
}
</style>
