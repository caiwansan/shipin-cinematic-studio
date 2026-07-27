<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">🤖 生活助手 - LLM Provider</h2>
      <div class="flex items-center gap-3">
        <span class="text-[10px] text-gray-500">平台自供 LLM，不依赖用户 BYOK</span>
        <button @click="addDialog = true" class="px-3 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">➕ 新增 Provider</button>
      </div>
    </div>

    <!-- 添加 / 编辑弹窗 -->
    <Teleport to="body">
      <div v-if="addDialog || editDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="closeDialogs">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-6 w-[560px] max-h-[80vh] overflow-y-auto shadow-2xl">
          <h3 class="text-sm text-white/70 font-medium mb-4">{{ editDialog ? '✏️ 编辑 Provider' : '➕ 新增 Provider' }}</h3>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">名称 *</label>
                <input v-model="form.name" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40" placeholder="例如：DeepSeek V3" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">类型 *</label>
                <select v-model="form.type" @change="onTypeChange" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40">
                  <option value="openai">OpenAI 兼容</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问（阿里云）</option>
                  <option value="meituan">美团大模型</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">API Key</label>
              <input v-model="form.apiKey" type="password" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40" placeholder="暂不填写，仅建立结构" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">Base URL</label>
              <input v-model="form.baseUrl" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40" placeholder="https://api.deepseek.com" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">模型列表（逗号分隔）</label>
              <input v-model="form.models" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40" placeholder="deepseek-v4-flash, deepseek-v4-pro" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">优先级（数值越低越优先）</label>
                <input v-model.number="form.priority" type="number" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40" />
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-[#1A2240]">
            <button @click="closeDialogs" class="px-4 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-gray-300 transition cursor-pointer">取消</button>
            <button @click="saveProvider" class="px-4 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">
              {{ saving ? '⏳ 保存中...' : '💾 保存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <!-- 错误 -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="providers.length === 0" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-12 text-center">
      <div class="text-2xl mb-3">🤖</div>
      <div class="text-sm text-white/50 font-medium">暂未配置 LLM Provider</div>
      <div class="text-[10px] text-gray-600 mt-1">点击「新增 Provider」添加平台 LLM 资源</div>
    </div>

    <!-- Provider 列表 -->
    <div v-else class="space-y-3">
      <div v-for="p in providers" :key="p.id" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 flex items-center justify-between hover:border-[#2A3460]/60 transition-all">
        <div class="flex items-center gap-4">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0" :class="p.status === 'active' ? 'bg-green-500/10' : 'bg-white/[0.04]'">
            {{ p.type === 'openai' ? '🔵' : p.type === 'deepseek' ? '🟢' : p.type === 'qwen' ? '🌐' : p.type === 'meituan' ? '🟡' : '🟣' }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-white/80 font-medium">{{ p.name }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded" :class="p.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'">{{ p.status === 'active' ? '启用' : '禁用' }}</span>
              <span class="text-[10px] text-gray-600">优先级: {{ p.priority }}</span>
            </div>
            <div class="text-[10px] text-gray-500 mt-1">
              {{ p.type }} · BaseURL: {{ p.baseUrl || '默认' }} · 模型: {{ (p.models || []).join(', ') || '未配置' }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="toggleProvider(p)" class="px-2.5 py-1 rounded-lg text-[10px] transition-all cursor-pointer" :class="p.status === 'active' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'">
            {{ p.status === 'active' ? '⛔ 禁用' : '✅ 启用' }}
          </button>
          <button @click="editProvider(p)" class="px-2.5 py-1 rounded-lg text-[10px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 transition-all cursor-pointer">✏️</button>
          <button @click="deleteProvider(p)" class="px-2.5 py-1 rounded-lg text-[10px] bg-red-500/10 border border-red-800/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface Provider {
  id: string
  name: string
  type: string
  apiKeyEncrypted?: string
  baseUrl: string
  models: string[]
  status: 'active' | 'disabled'
  priority: number
  createdAt: string
}

const providers = ref<Provider[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const addDialog = ref(false)
const editDialog = ref(false)

const form = ref({
  id: '',
  name: '',
  type: 'deepseek',
  apiKey: '',
  baseUrl: '',
  models: '',
  priority: 0,
})

function closeDialogs() {
  addDialog.value = false
  editDialog.value = false
  form.value = { id: '', name: '', type: 'deepseek', apiKey: '', baseUrl: '', models: '', priority: 0 }
}

function onTypeChange() {
  // 只在新增时自动填充（编辑时不覆盖用户已填数据）
  if (editDialog.value) return
  const presets: Record<string, { name: string; baseUrl: string; models: string }> = {
    qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: 'qwen-plus, qwen-max, qwen-turbo' },
    meituan: { name: '美团大模型', baseUrl: 'https://api.mt.cn/v1', models: 'mt-nlp-1.0, mt-ocr-1.0' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: 'deepseek-v4-flash, deepseek-v4-pro' },
    openai: { name: 'OpenAI 兼容', baseUrl: '', models: '' },
    custom: { name: '', baseUrl: '', models: '' },
  }
  const preset = presets[form.value.type]
  if (preset) {
    if (!form.value.name) form.value.name = preset.name
    if (!form.value.baseUrl) form.value.baseUrl = preset.baseUrl
    if (!form.value.models) form.value.models = preset.models
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/admin/platform/llm/providers', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) providers.value = json.data
    else error.value = json.error || '加载失败'
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

async function saveProvider() {
  saving.value = true
  try {
    const body: any = { name: form.value.name, type: form.value.type, baseUrl: form.value.baseUrl, models: form.value.models.split(',').map((s: string) => s.trim()).filter(Boolean), priority: form.value.priority }
    if (form.value.apiKey) body.apiKey = form.value.apiKey

    let res
    if (editDialog.value && form.value.id) {
      res = await fetch(`/api/admin/platform/llm/providers/${form.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
    } else {
      res = await fetch('/api/admin/platform/llm/providers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
    }
    const json = await res.json()
    if (json.success) {
      closeDialogs()
      await fetchData()
    } else {
      error.value = json.error || '保存失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    saving.value = false
  }
}

function editProvider(p: Provider) {
  form.value = { id: p.id, name: p.name, type: p.type, apiKey: '', baseUrl: p.baseUrl, models: (p.models || []).join(', '), priority: p.priority }
  editDialog.value = true
}

async function toggleProvider(p: Provider) {
  try {
    const res = await fetch(`/api/admin/platform/llm/providers/${p.id}/toggle`, { method: 'POST', headers: { ...authHeaders() } })
    const json = await res.json()
    if (json.success) p.status = json.data.status
  } catch (e: any) {
    error.value = e.message
  }
}

async function deleteProvider(p: Provider) {
  if (!confirm(`确定删除 ${p.name}？`)) return
  try {
    const res = await fetch(`/api/admin/platform/llm/providers/${p.id}`, { method: 'DELETE', headers: { ...authHeaders() } })
    const json = await res.json()
    if (json.success) await fetchData()
    else error.value = json.error || '删除失败'
  } catch (e: any) {
    error.value = e.message
  }
}

onMounted(fetchData)
</script>
