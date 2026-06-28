<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">⚙️ 生活助手 - 路由配置</h2>
    </div>

    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5 space-y-5">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="text-sm text-white/70 font-medium">🔄 路由策略</h3>
          <p class="text-[10px] text-gray-500 mt-1">控制 LLM Provider 的选择方式（当前仅控制面，不执行调用）</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-[10px] text-gray-500 block mb-1.5">路由模式</label>
          <select v-model="config.routingMode" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40">
            <option value="priority">优先级路由</option>
            <option value="fixed">固定 Provider</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] text-gray-500 block mb-1.5">默认 Provider</label>
          <select v-model="config.defaultProvider" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40">
            <option :value="null">自动选择</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>

      <div class="border-t border-[#1A2240] pt-4">
        <div class="text-[10px] text-gray-500 mb-2">模型分层（按性能分层指定 Provider）</div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-[10px] text-gray-500 block mb-1.5">快速模型</label>
            <div class="text-[10px] bg-white/[0.04] rounded-lg px-3 py-2 text-white/40 min-h-[32px]">{{ config.modelTierMapping?.fast?.join(', ') || '未配置' }}</div>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1.5">均衡模型</label>
            <div class="text-[10px] bg-white/[0.04] rounded-lg px-3 py-2 text-white/40 min-h-[32px]">{{ config.modelTierMapping?.balanced?.join(', ') || '未配置' }}</div>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1.5">高质量模型</label>
            <div class="text-[10px] bg-white/[0.04] rounded-lg px-3 py-2 text-white/40 min-h-[32px]">{{ config.modelTierMapping?.quality?.join(', ') || '未配置' }}</div>
          </div>
        </div>
      </div>

      <div class="flex justify-end pt-2 border-t border-[#1A2240]">
        <button @click="saveConfig" :disabled="saving" class="px-4 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">
          {{ saving ? '⏳ 保存中...' : '💾 保存配置' }}
        </button>
        <span v-if="msg" class="ml-3 text-[10px] flex items-center" :class="msgErr ? 'text-red-400' : 'text-emerald-400'">{{ msg }}</span>
      </div>
    </div>

    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
      <div class="text-[10px] text-gray-500">Provider 选择测试（仅返回配置，不执行 LLM 调用）</div>
      <div class="flex items-center gap-3 mt-3">
        <input v-model="testIntent" class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40" placeholder="输入 intent 名称测试路由选择" @keyup.enter="testSelect" />
        <button @click="testSelect" class="px-3 py-1.5 rounded-lg text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/70 transition-all cursor-pointer">测试路由</button>
      </div>
      <div v-if="testResult" class="mt-3 bg-white/[0.03] rounded-lg p-3 text-[10px] font-mono text-white/50">
        <pre>{{ JSON.stringify(testResult, null, 2) }}</pre>
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

const config = ref({
  defaultProvider: null as string | null,
  routingMode: 'priority',
  modelTierMapping: { fast: [], balanced: [], quality: [] },
})
const providers = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const msgErr = ref(false)
const testIntent = ref('')
const testResult = ref<any>(null)

async function fetchConfig() {
  try {
    const [cfgRes, provRes] = await Promise.all([
      fetch('/api/admin/platform/llm/config', { headers: authHeaders() }),
      fetch('/api/admin/platform/llm/providers', { headers: authHeaders() })
    ])
    const cfgData = await cfgRes.json()
    const provData = await provRes.json()
    if (cfgData.success) config.value = cfgData.data
    if (provData.success) providers.value = provData.data
  } catch { /* ignore */ }
}

async function saveConfig() {
  saving.value = true
  msg.value = ''
  msgErr.value = false
  try {
    const res = await fetch('/api/admin/platform/llm/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(config.value),
    })
    const json = await res.json()
    if (json.success) {
      msg.value = '✅ 保存成功'
    } else {
      msg.value = '❌ ' + (json.error || '保存失败')
      msgErr.value = true
    }
  } catch (e: any) {
    msg.value = '❌ ' + e.message
    msgErr.value = true
  } finally {
    saving.value = false
    setTimeout(() => { msg.value = '' }, 3000)
  }
}

async function testSelect() {
  try {
    const res = await fetch(`/api/admin/platform/llm/select?intent=${encodeURIComponent(testIntent.value)}`)
    const json = await res.json()
    testResult.value = json.data
  } catch { testResult.value = { error: '请求失败' } }
}

onMounted(fetchConfig)
</script>
