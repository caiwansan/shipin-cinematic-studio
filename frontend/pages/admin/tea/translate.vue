<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[900px] mx-auto px-4 py-4 space-y-4">
      <div>
        <h1 class="text-lg font-bold text-amber-300 tracking-wider">🌐 昆仑茶馆 · 翻译大模型设置</h1>
        <p class="text-xs text-slate-400 mt-1">平台提供翻译大模型（聊天消息翻译 / 语音翻译通用）。支持 DeepSeek、豆包(Doubao)、龙猫(Longcat) 等国产模型，也可自定义 OpenAI 兼容接口。</p>
      </div>

      <div v-if="err" class="rounded-xl bg-red-900/20 border border-red-800/40 p-3 text-xs text-red-300">{{ err }}</div>
      <div v-if="saved" class="rounded-xl bg-emerald-900/20 border border-emerald-700/40 p-3 text-xs text-emerald-300">✅ 已保存</div>

      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4 space-y-3">
        <h2 class="text-sm font-bold text-amber-300">🤖 模型服务商</h2>

        <!-- 服务商 -->
        <div>
          <label class="text-xs text-slate-400 block mb-1">服务商（点击选择，自动填 Base URL）</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="p in providers" :key="p.key" @click="pick(p)" class="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
              :class="cfg.provider === p.key ? 'bg-amber-600 text-black border-amber-400 font-bold' : 'bg-black/40 text-slate-300 border-slate-600'">
              {{ p.name }}
            </button>
          </div>
        </div>

        <!-- 模型列表（点选自动写入） -->
        <div v-if="currentModels.length" class="rounded-xl bg-black/30 border border-slate-700/60 p-3">
          <label class="text-xs text-slate-400 block mb-2">📋 选择模型（点击型号自动填入下方）</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="mdl in currentModels" :key="mdl.id" @click="cfg.model = mdl.id; cfg.modelNote = mdl.note || ''"
              class="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
              :class="cfg.model === mdl.id ? 'bg-emerald-600 text-black border-emerald-400 font-bold' : 'bg-black/40 text-slate-300 border-slate-600'">
              {{ mdl.label }}
              <span v-if="mdl.note" class="opacity-70 ml-1">{{ mdl.note }}</span>
            </button>
          </div>
        </div>

        <div>
          <label class="text-xs text-slate-400 block mb-1">API Base URL<span style="color:#f59e0b">*</span></label>
          <input v-model="cfg.baseUrl" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="https://api.deepseek.com/v1">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">模型名称<span style="color:#f59e0b">*</span> <span class="text-slate-500">{{ cfg.modelNote }}</span></label>
          <input v-model="cfg.model" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" placeholder="点上方型号自动填入，或手动填写（如豆包推理接入点 ep-xxx）">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">API Key<span v-if="cfg.hasKey" class="text-emerald-400 ml-1">✓ 已配置（重新填写则覆盖）</span></label>
          <input v-model="cfg.apiKey" type="password" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" :placeholder="cfg.hasKey ? '•••••••• (留空保持不变)' : 'sk-... / 火山方舟 / 龙猫 Key'">
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button @click="save" class="px-4 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">💾 保存配置</button>
          <button @click="test" :disabled="testing" class="px-4 py-2 rounded-lg text-xs border cursor-pointer disabled:opacity-50"
            :class="testOk===null ? 'border-slate-600 text-slate-300' : (testOk ? 'border-emerald-600 text-emerald-300' : 'border-red-600 text-red-300')">
            {{ testing ? '⏳ 测试中…' : '🧪 测试翻译' }}
          </button>
          <button @click="load" class="px-4 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">↻ 重新加载</button>
        </div>
        <div v-if="testResult" class="text-[11px] leading-relaxed" :class="testOk ? 'text-emerald-300' : 'text-red-300'">{{ testResult }}</div>
        <div class="text-[11px] text-slate-500 leading-relaxed mt-1">
          说明：①点击【模型服务商】自动填 Base URL，点击【📋 选择模型】自动写入型号 ②豆包如使用推理接入点需手动填 ep-xxx ③保存的 Key 加密存储、不回显明文 ④「测试翻译」真实调用一次(英→中)验证 ⑤保存后 5 分钟内全局生效（含手机端聊天翻译）。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'

definePageMeta({ layout: 'admin-aigc' })

interface ModelOpt { id: string; label: string; note?: string }
interface Provider { key: string; name: string; baseUrl: string; models: ModelOpt[] }

const providers: Provider[] = [
  {
    key: 'deepseek', name: '🧊 DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', label: 'deepseek-chat', note: 'V3 通用' },
      { id: 'deepseek-reasoner', label: 'deepseek-reasoner', note: 'R1 推理' },
      { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash', note: 'V4 快' },
    ],
  },
  {
    key: 'doubao', name: '🌋 豆包 Doubao(火山方舟)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-seed-1.6-250615', label: 'doubao-seed-1.6', note: '旗舰' },
      { id: 'doubao-seed-1.6-flash-250615', label: 'doubao-seed-flash', note: '快' },
      { id: 'doubao-1.5-pro-32k-250115', label: 'doubao-1.5-pro-32k', note: 'Pro' },
      { id: 'doubao-1.5-lite-32k-250115', label: 'doubao-1.5-lite-32k', note: 'Lite' },
    ],
  },
  {
    key: 'longcat', name: '🐱 龙猫 LongCat', baseUrl: 'https://api.longcat.chat/openai/v1',
    models: [
      { id: 'LongCat-2.0', label: 'LongCat-2.0', note: '官方 2.0' },
    ],
  },
  {
    key: 'custom', name: '⚙️ 自定义(OpenAI兼容)', baseUrl: '',
    models: [],
  },
]

const cfg = reactive({ provider: 'deepseek', baseUrl: '', model: '', modelNote: '', apiKey: '', hasKey: false })
const err = ref('')
const saved = ref(false)
const testing = ref(false)
const testOk = ref<boolean | null>(null)
const testResult = ref('')

const currentModels = computed(() => providers.find((p) => p.key === cfg.provider)?.models || [])

function tok() { return window.localStorage?.getItem('auth_token') || '' }
function pick(p: Provider) {
  cfg.provider = p.key
  if (p.baseUrl) cfg.baseUrl = p.baseUrl
  cfg.modelNote = ''
  // 默认选中该服务商第一个型号
  if (p.models.length) { cfg.model = p.models[0].id; cfg.modelNote = p.models[0].note || '' }
  else cfg.model = ''
}
async function load() {
  err.value = ''; saved.value = false; testOk.value = null; testResult.value = ''
  try {
    const res = await fetch('/api/admin/tea-translate', { headers: { Authorization: `Bearer ${tok()}` } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    cfg.provider = j.data?.provider || 'deepseek'
    cfg.model = j.data?.model || ''
    cfg.baseUrl = j.data?.baseUrl || ''
    cfg.apiKey = ''
    cfg.hasKey = !!j.data?.hasKey
    if (!cfg.baseUrl) pick(providers.find((p) => p.key === cfg.provider) || providers[0])
    else cfg.modelNote = ''
  } catch (e: any) { err.value = '❌ ' + (e.message || '加载失败') }
}
async function save() {
  err.value = ''; saved.value = false
  const payload: any = { provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl }
  if (cfg.apiKey) payload.apiKey = cfg.apiKey
  try {
    const res = await fetch('/api/admin/tea-translate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
    saved.value = true; cfg.hasKey = true; cfg.apiKey = ''
    setTimeout(() => { saved.value = false }, 2500)
    await load()
  } catch (e: any) { err.value = '❌ ' + (e.message || '保存失败') }
}
async function test() {
  testing.value = true; testOk.value = null; testResult.value = ''
  try {
    const res = await fetch('/api/admin/tea-translate/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, apiKey: cfg.apiKey }),
    })
    const j = await res.json().catch(() => ({}))
    testOk.value = !!j.success
    testResult.value = j.success ? (`✅ 翻译成功：${j.data?.translated}`) : ('❌ ' + (j.message || '测试失败'))
  } catch (e: any) {
    testOk.value = false; testResult.value = '❌ ' + (e.message || '测试失败')
  } finally { testing.value = false }
}
onMounted(load)
</script>
