<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">Agent 管理</h2>
      <button @click="openCreate"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 创建 Agent
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline">重试</button>
    </div>

    <template v-else>
      <div v-if="agents.length === 0" class="py-12 text-center text-gray-600 text-sm">暂无 Agent</div>

      <!-- 表格 -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="border-b border-[#1A2240]">
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">ID</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">名称</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">角色</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">类型</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">模型</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">状态</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">版本</th>
              <th class="text-left py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">创建时间</th>
              <th class="text-right py-2.5 px-3 text-gray-500 font-medium whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="agent in agents" :key="agent.id"
              class="border-b border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-2.5 px-3 text-gray-400 font-mono">{{ agent.id }}</td>
              <td class="py-2.5 px-3 text-white/80 font-medium">{{ agent.name }}</td>
              <td class="py-2.5 px-3 text-gray-400">{{ agent.role || '—' }}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="agent.type === 'llm' ? 'bg-purple-500/10 text-purple-400' : 'bg-yellow-500/10 text-yellow-400'">
                  {{ agent.type || '—' }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-gray-400">{{ agent.model || '—' }}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="agent.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ agent.status || 'inactive' }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-gray-400">{{ agent.version || 'v1' }}</td>
              <td class="py-2.5 px-3 text-gray-500 whitespace-nowrap">{{ formatTime(agent.createdAt) }}</td>
              <td class="py-2.5 px-3 text-right whitespace-nowrap">
                <button @click="openEdit(agent)"
                  class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-600/30 transition cursor-pointer border-none mr-1">
                  编辑
                </button>
                <button @click="deleteAgent(agent)"
                  class="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px] hover:bg-red-600/30 transition cursor-pointer border-none">
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Create/Edit Dialog -->
    <div v-if="dialogVisible" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-lg mx-4">
        <div class="text-sm text-white/80 font-medium mb-4">{{ isEditing ? '编辑 Agent' : '创建 Agent' }}</div>
        <div class="space-y-3">
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">名称 *</label>
            <input v-model="form.name" type="text" placeholder="Agent 名称"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">角色</label>
              <input v-model="form.role" type="text" placeholder="如: director, writer"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">类型</label>
              <select v-model="form.type"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                <option value="llm">llm</option>
                <option value="rule">rule</option>
                <option value="hybrid">hybrid</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">模型</label>
            <input v-model="form.model" type="text" placeholder="如: deepseek-v3, gpt-4"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">System Prompt</label>
            <textarea v-model="form.systemPrompt" rows="3" placeholder="Agent 系统提示词..."
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">状态</label>
            <select v-model="form.status"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
              <option value="active">active</option>
              <option value="deprecated">deprecated</option>
            </select>
          </div>
        </div>
        <div v-if="formError" class="text-red-400 text-[10px] mt-2">{{ formError }}</div>
        <div class="flex gap-2 mt-4">
          <button @click="saveAgent" :disabled="saving"
            class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
            {{ saving ? '保存中...' : '保存' }}
          </button>
          <button @click="closeDialog"
            class="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer border-none">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const loading = ref(true)
const error = ref('')
const agents = ref<any[]>([])
const dialogVisible = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<string | null>(null)
const form = ref({ name: '', role: '', type: 'llm', model: '', systemPrompt: '', status: 'active' })

function formatTime(iso: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/agents', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      agents.value = Array.isArray(d) ? d : (d.data || d.agents || [])
    } else {
      error.value = '请求失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络异常'
  }
  loading.value = false
}

function openCreate() {
  isEditing.value = false
  editingId.value = null
  form.value = { name: '', role: '', type: 'llm', model: '', systemPrompt: '', status: 'active' }
  formError.value = ''
  dialogVisible.value = true
}

function openEdit(agent: any) {
  isEditing.value = true
  editingId.value = agent.id
  form.value = {
    name: agent.name || '',
    role: agent.role || '',
    type: agent.type || 'llm',
    model: agent.model || '',
    systemPrompt: agent.systemPrompt || '',
    status: agent.status || 'active',
  }
  formError.value = ''
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
  isEditing.value = false
  editingId.value = null
}

async function saveAgent() {
  if (!form.value.name) { formError.value = '请输入 Agent 名称'; return }
  saving.value = true
  formError.value = ''
  const payload = { ...form.value }
  try {
    const token = getToken()
    const url = isEditing.value && editingId.value
      ? `/api/admin/agents/${editingId.value}`
      : '/api/admin/agents'
    const res = await fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      await fetchData()
    } else {
      const err = await res.json().catch(() => ({}))
      formError.value = err.message || `请求失败 (${res.status})`
    }
  } catch (e: any) {
    formError.value = e.message || '网络异常'
  }
  saving.value = false
  closeDialog()
}

async function deleteAgent(agent: any) {
  if (!confirm(`确定删除 Agent「${agent.name}」？此操作不可恢复。`)) return
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/agents/${agent.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      agents.value = agents.value.filter((a: any) => a.id !== agent.id)
    } else {
      agents.value = agents.value.filter((a: any) => a.id !== agent.id)
    }
  } catch {
    agents.value = agents.value.filter((a: any) => a.id !== agent.id)
  }
}

onMounted(fetchData)
</script>
