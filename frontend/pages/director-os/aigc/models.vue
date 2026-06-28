<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">🏗️ 大模型管理</h2>
      <div class="flex items-center gap-3">
        <span class="text-[10px] text-gray-500">管理各供应商的模型列表，同步后前端自动更新</span>
        <button @click="syncAll" :disabled="syncing" class="px-3 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all">
          {{ syncing ? '⏳ 同步中...' : '🔄 同步官方模型列表' }}
        </button>
      </div>
    </div>

    <!-- API Key 配置区域 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm text-white/70 font-medium">🔑 API Key 配置</h3>
          <p class="text-[10px] text-gray-500 mt-1">以下 Key 仅管理员用于同步官方模型列表，不会被用户调用</p>
        </div>
      </div>
      <div class="space-y-3">
        <div v-for="provKey in providerKeys" :key="provKey.provider" class="flex items-center gap-4">
          <div class="w-24 shrink-0 text-[11px] text-white/60 font-medium">{{ getProviderIcon(provKey.provider) }} {{ provKey.label }}</div>
          <div class="flex-1 flex gap-2">
            <input v-model="provKey.display" :type="provKey.show ? 'text' : 'password'" class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40 transition" :placeholder="provKey.keyHint" />
            <button @click="provKey.show = !provKey.show" class="px-2.5 py-1 rounded-lg text-[10px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 cursor-pointer transition-all">{{ provKey.show ? '🙈' : '👁️' }}</button>
            <button @click="toggleEdit(provKey)" class="px-2.5 py-1 rounded-lg text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer">
              {{ provKey.editing ? '取消' : '编辑' }}
            </button>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button @click="saveKeys" :disabled="savingKeys" class="px-4 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">
            {{ savingKeys ? '⏳ 保存中...' : '💾 保存 API Key' }}
          </button>
          <span v-if="keyMsg" class="ml-3 text-[10px] flex items-center" :class="keyMsgErr ? 'text-red-400' : 'text-emerald-400'">{{ keyMsg }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline">重试</button>
    </div>

    <template v-else>
      <div v-for="prov in providers" :key="prov.provider" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <!-- 供应商头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-[#1A2240]">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0" :class="prov.enabled ? 'bg-green-500/10' : 'bg-white/[0.04]'">
              {{ getProviderIcon(prov.provider) }}
            </div>
            <div>
              <div class="text-sm text-white/80 font-medium">{{ prov.providerName }}</div>
              <div class="text-[10px] text-gray-500 mt-0.5">{{ getModelCount(prov) }} 个模型</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px]" :class="prov.enabled ? 'text-green-400' : 'text-gray-500'">
              {{ prov.enabled ? '已启用' : '已禁用' }}
            </span>
            <label class="relative inline-block w-10 h-5 cursor-pointer">
              <input type="checkbox" :checked="prov.enabled" class="opacity-0 w-0 h-0 peer" @change="toggleProvider(prov)" />
              <span class="absolute inset-0 rounded-full transition-colors peer-checked:bg-blue-500/40 bg-white/[0.08] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform after:peer-checked:translate-x-5 after:peer-checked:bg-blue-400"></span>
            </label>
          </div>
        </div>

        <!-- 模型类别列表 -->
        <div class="px-5 py-3 space-y-3">
          <div v-for="type in modelTypes" :key="type.key" class="flex items-start gap-4 py-2 border-b border-[#1A2240]/50 last:border-b-0">
            <div class="w-20 shrink-0 text-[10px] text-gray-400 font-medium pt-1">{{ type.label }}</div>
            <div class="flex-1">
              <!-- 已选模型标签 -->
              <div class="flex flex-wrap gap-1.5 mb-2">
                <span v-for="model in getModelsForType(prov, type.key)" :key="model.name"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] border border-white/[0.08] text-white/60">
                  {{ model.label || model.name }}
                </span>
                <span v-if="getModelsForType(prov, type.key).length === 0" class="text-[10px] text-gray-600">暂无模型</span>
              </div>
              <!-- 操作按钮 -->
              <div class="flex gap-2">
                <button @click="showModelManager(prov, type.key)" class="px-2.5 py-1 rounded-lg text-[10px] bg-indigo-600/15 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600/25 transition-all">
                  ✏️ 编辑模型列表
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="providers.length === 0" class="text-center py-16 text-gray-600 text-sm">暂无供应商数据</div>
    </template>

    <!-- 模型编辑弹窗 -->
    <div v-if="editDialog.visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="editDialog.visible = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-[#1A2240]">
          <div>
            <h3 class="text-sm font-semibold text-white/80">✏️ 编辑模型列表</h3>
            <p class="text-[10px] text-gray-500 mt-0.5">{{ getProviderIcon(editDialog.provider) }} {{ getProviderName(editDialog.provider) }} · {{ getModelTypeLabel(editDialog.modelType) }}</p>
          </div>
          <button @click="editDialog.visible = false" class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 border-none cursor-pointer text-xs">✕</button>
        </div>
        <div class="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          <div v-if="editDialog.models.length === 0" class="text-center py-8 text-gray-600 text-xs">暂无模型，可点击「同步官方模型列表」获取</div>
          <div v-for="(model, idx) in editDialog.models" :key="idx"
            class="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <input type="checkbox" v-model="model.checked" class="accent-indigo-500" />
            <div class="flex-1 min-w-0">
              <div class="text-[11px] text-white/70 truncate">{{ model.label || model.name }}</div>
              <div class="text-[9px] text-gray-500 truncate">{{ model.name }}</div>
            </div>
            <button @click="removeModel(idx)" class="text-[10px] text-red-400/50 hover:text-red-400 bg-transparent border-none cursor-pointer">✕</button>
          </div>
        </div>
        <div class="flex items-center justify-between px-6 py-4 border-t border-[#1A2240]">
          <div class="flex gap-2">
            <button @click="addModelInput" class="px-3 py-1.5 rounded-lg text-[10px] bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white/70 cursor-pointer transition-all">
              + 添加模型
            </button>
          </div>
          <div class="flex gap-2">
            <button @click="editDialog.visible = false" class="px-4 py-1.5 rounded-lg text-[10px] bg-white/[0.06] text-white/50 border-none cursor-pointer hover:bg-white/[0.1]">取消</button>
            <button @click="saveEditModels" class="px-4 py-1.5 rounded-lg text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 cursor-pointer hover:bg-indigo-600/30 transition-all">
              💾 保存模型列表
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, onMounted } from 'vue'

const loading = ref(true)
const error = ref('')
const syncing = ref(false)
const savingKeys = ref(false)
const keyMsg = ref('')
const keyMsgErr = ref(false)
const providers = ref<any[]>([])

function maskValue(val: string): string {
  if (!val) return ''
  if (val.length <= 4) return '****' + val
  return '****' + val.slice(-4)
}

const providerKeys = reactive([
  { provider: 'aliyun', label: '阿里百炼', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'volcengine', label: '火山引擎', key: '', display: '', show: false, editing: false, keyHint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'siliconflow', label: '硅基流动', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'deepseek', label: 'DeepSeek', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'google', label: 'Google Gemini', key: '', display: '', show: false, editing: false, keyHint: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'anthropic', label: 'Anthropic Claude', key: '', display: '', show: false, editing: false, keyHint: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'xai', label: 'xAI Grok', key: '', display: '', show: false, editing: false, keyHint: 'xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'moonshot', label: '月之暗面 Moonshot', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'zhipu', label: '智谱 GLM', key: '', display: '', show: false, editing: false, keyHint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'openai', label: 'OpenAI ChatGPT', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'longcat', label: 'LongCat 美团', key: '', display: '', show: false, editing: false, keyHint: 'lc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
])

function toggleEdit(provKey: any) {
  provKey.editing = !provKey.editing
  if (provKey.editing) {
    provKey.display = provKey.key
  } else {
    // 取消：恢复掩码
    provKey.display = provKey.key ? maskValue(provKey.key) : ''
    provKey.show = false
  }
}

const modelTypes = [
  { key: 'llm', label: '语言模型' },
  { key: 'image', label: '图片模型' },
  { key: 'video', label: '视频模型' },
  { key: 'tts', label: '语音模型' },
]

const editDialog = reactive({
  visible: false,
  provider: '',
  modelType: '',
  models: [] as any[],
})

const PROVIDER_ICONS: Record<string, string> = {
  volcengine: '🔮',
  aliyun: '☁️',
  siliconflow: '💧',
  deepseek: '🧠',
  google: '🌀',
  anthropic: '🎭',
  xai: '🤖',
  moonshot: '🌙',
  zhipu: '📊',
  openai: '🤗',
  longcat: '🐱',
}

function getProviderIcon(id: string): string { return PROVIDER_ICONS[id] || '🔌' }

function getProviderName(id: string): string {
  const p = providers.value.find(p => p.provider === id)
  return p?.providerName || id
}

function getModelTypeLabel(key: string): string {
  return modelTypes.find(t => t.key === key)?.label || key
}

function getModelCount(prov: any): number {
  if (prov.models && prov.models.length > 0) return prov.models.length
  let n = 0
  for (const k of ['llm', 'image', 'video', 'tts']) {
    if (prov.defaultParams?.models?.[k]) n += prov.defaultParams.models[k].length
  }
  return n
}

function getModelsForType(prov: any, type: string): any[] {
  if (prov.models) {
    return prov.models
      .filter((m: any) => m.type === type)
      .map((m: any) => ({ name: m.id, label: m.label || m.name || m.id, isActive: true }))
  }
  return prov.defaultParams?.models?.[type] || []
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/global-models', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const d = await res.json()
    if (d.success) {
      providers.value = d.providers || []
    } else {
      error.value = d.error || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  }
  loading.value = false
}

async function toggleProvider(p: any) {
  const prev = p.enabled
  p.enabled = !p.enabled
  try {
    const token = getToken()
    await fetch('/api/admin/global-models/toggle', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ provider: p.provider, enabled: p.enabled })
    })
  } catch {
    p.enabled = prev
  }
}

function showModelManager(prov: any, type: string) {
  editDialog.provider = prov.provider
  editDialog.modelType = type
  const srcModels = prov.models
    ? prov.models.filter((m: any) => m.type === type)
    : (prov.defaultParams?.models?.[type] || [])
  editDialog.models = srcModels.map((m: any) => ({
    name: m.name || m.id,
    label: m.label || m.name || m.id,
    checked: m.isActive !== false,
  }))
  editDialog.visible = true
}

function addModelInput() {
  const name = prompt('输入模型名称（如 qwen-max）')
  if (!name?.trim()) return
  const label = prompt('输入展示名称（可选，留空使用模型名）', name) || name
  editDialog.models.push({ name: name.trim(), label, checked: true })
}

function removeModel(idx: number) {
  editDialog.models.splice(idx, 1)
}

async function saveEditModels() {
  const prov = providers.value.find(p => p.provider === editDialog.provider)
  if (!prov) return

  if (!prov.defaultParams) prov.defaultParams = {}
  if (!prov.defaultParams.models) prov.defaultParams.models = {}

  prov.defaultParams.models[editDialog.modelType] = editDialog.models.map(m => ({
    name: m.name,
    label: m.label,
    isActive: m.checked,
  }))

  try {
    const token = getToken()
    const res = await fetch('/api/admin/global-models/save-models', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        provider: editDialog.provider,
        models: prov.defaultParams.models,
      })
    })
    const d = await res.json()
    if (d.success) {
      editDialog.visible = false
    } else {
      alert('保存失败: ' + (d.error || '未知错误'))
    }
  } catch (e: any) {
    alert('保存失败: ' + e.message)
  }
}

async function syncAll() {
  syncing.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/admin/global-models/sync-aliyun', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: '{}'
    })
    const d = await res.json()
    if (d.success) {
      await fetchData()
    } else {
      alert('同步失败: ' + (d.error || '未知错误'))
    }
  } catch (e: any) {
    alert('同步失败: ' + e.message)
  }
  syncing.value = false
}

async function loadKeys() {
  try {
    const token = getToken()
    if (!token) return
    const res = await fetch('/api/admin/api-keys', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const d = await res.json()
    if (d.success && d.keys) {
      for (const pk of providerKeys) {
        const found = d.keys.find((x: any) => x.provider === pk.provider)
        if (found) {
          const rawKey = found.keyValue?.replace(/[*]/g, '') || ''
          pk.key = rawKey
          // 显示掩码版本
          pk.display = rawKey ? maskValue(rawKey) : ''
        }
      }
    }
  } catch (e) {
    // silently ignore
  }
}

async function saveKeys() {
  savingKeys.value = true
  keyMsg.value = ""
  keyMsgErr.value = false
  try {
    const token = getToken()
    if (!token) return
    for (const pk of providerKeys) {
      // 在编辑状态时，sync display back to key
      if (pk.editing) {
        pk.key = pk.display
      }
      if (!pk.key) continue
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: pk.provider, keyName: pk.provider + "_api_key", keyValue: pk.key })
      })
      const d = await res.json()
      if (!d.success) {
        keyMsg.value = "❌ " + pk.label + ": " + (d.error || "保存失败")
        keyMsgErr.value = true
        savingKeys.value = false
        return
      }
    }
    keyMsg.value = "✅ API Key 已保存（仅用于同步模型列表，不会泄露给用户）"
    keyMsgErr.value = false
    // 保存成功后重置编辑状态，显示掩码
    providerKeys.forEach(pk => {
      pk.show = false
      pk.editing = false
      pk.display = pk.key ? maskValue(pk.key) : ''
    })
  } catch (e: any) {
    keyMsg.value = "❌ " + e.message
    keyMsgErr.value = true
  }
  savingKeys.value = false
  setTimeout(() => { keyMsg.value = "" }, 3000)
}
onMounted(() => {
  fetchData()
  loadKeys()
})
</script>
