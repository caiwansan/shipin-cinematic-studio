<template>
  <div class="p-6 max-w-[1400px] mx-auto">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-lg font-bold text-white">🧭 AI 模型数据库</h1>
        <p class="text-xs text-gray-500 mt-1">模型粒度运营管理（AI-CENTER-06）· 价格必须可追溯：验证时间 / 验证人 / 数据来源 · 未验证不展示价格</p>
      </div>
      <div class="flex gap-2">
        <span class="text-[11px] px-3 py-1.5 rounded-lg bg-[#0B1020] border border-[#1A2240] text-gray-400">已验证 {{ stats.verified }} / {{ stats.total }}</span>
        <button @click="openNew" class="text-xs bg-cyan-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-cyan-400">＋ 新增模型</button>
      </div>
    </div>

    <!-- 统计卡 -->
    <div class="grid grid-cols-4 gap-3 mb-5">
      <div class="rounded-xl border border-[#1A2240] bg-[#0B1020] p-4">
        <div class="text-[11px] text-gray-500">模型总数</div>
        <div class="text-2xl font-bold text-white mt-1">{{ stats.total }}</div>
      </div>
      <div class="rounded-xl border border-[#1A2240] bg-[#0B1020] p-4">
        <div class="text-[11px] text-gray-500">价格已验证</div>
        <div class="text-2xl font-bold text-emerald-400 mt-1">{{ stats.verified }}</div>
      </div>
      <div class="rounded-xl border border-[#1A2240] bg-[#0B1020] p-4">
        <div class="text-[11px] text-gray-500">待验证</div>
        <div class="text-2xl font-bold text-amber-400 mt-1">{{ stats.pending }}</div>
      </div>
      <div class="rounded-xl border border-[#1A2240] bg-[#0B1020] p-4">
        <div class="text-[11px] text-gray-500">覆盖厂商</div>
        <div class="text-2xl font-bold text-cyan-400 mt-1">{{ stats.providers }}</div>
      </div>
    </div>

    <!-- 过滤 -->
    <div class="flex items-center gap-3 mb-4">
      <input v-model="q" placeholder="搜索模型 / 厂商…" class="w-64 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:ring-2 focus:ring-cyan-500" />
      <select v-model="statusFilter" class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none">
        <option value="all">全部状态</option>
        <option value="verified">已验证</option>
        <option value="pending">待验证</option>
      </select>
      <select v-model="typeFilter" class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none">
        <option value="all">全部类型</option>
        <option value="language">语言</option><option value="image">图片</option><option value="video">视频</option>
        <option value="audio">语音</option><option value="multimodal">多模态</option><option value="agent">Agent</option>
      </select>
    </div>

    <!-- 表格 -->
    <div class="rounded-xl border border-[#1A2240] bg-[#0B1020] overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-[#1A2240] text-gray-500">
            <th class="px-4 py-3">模型</th>
            <th class="px-4 py-3">厂商</th>
            <th class="px-4 py-3">类型</th>
            <th class="px-4 py-3">价格（输入/输出）</th>
            <th class="px-4 py-3">单位</th>
            <th class="px-4 py-3">上下文</th>
            <th class="px-4 py-3">性价比</th>
            <th class="px-4 py-3">数据状态</th>
            <th class="px-4 py-3">最后验证</th>
            <th class="px-4 py-3">验证人</th>
            <th class="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in filtered" :key="m.id" class="border-b border-[#0D1428] hover:bg-[#0D1428]/60">
            <td class="px-4 py-3">
              <div class="font-semibold text-white">{{ m.name }}</div>
              <div class="text-[10px] text-gray-600">{{ m.code }}</div>
            </td>
            <td class="px-4 py-3 text-gray-400">{{ m.providerName }}</td>
            <td class="px-4 py-3">
              <span v-for="t in m.modelTypes" :key="t" class="text-[10px] bg-[#0D1428] border border-[#1A2240] rounded px-1.5 py-0.5 mr-1 text-cyan-400">{{ typeLabel(t) }}</span>
            </td>
            <td class="px-4 py-3">
              <template v-if="m.inputPrice != null">
                <span class="text-emerald-400 font-semibold">{{ fmtPrice(m.inputPrice, m.currency) }} / {{ fmtPrice(m.outputPrice, m.currency) }}</span>
                <div class="text-[10px] text-gray-600">{{ m.currency }} · {{ m.pricingUnit || '/1M tokens' }}</div>
              </template>
              <span v-else class="text-amber-400">待验证</span>
            </td>
            <td class="px-4 py-3 text-gray-400">{{ m.contextWindow ? fmtCtx(m.contextWindow) : '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ m.pricingUnit || '/1M tokens' }}</td>
            <td class="px-4 py-3 text-cyan-400 font-semibold">{{ m.valueScore ?? '—' }}</td>
            <td class="px-4 py-3">
              <span v-if="m.dataStatus === 'verified'" class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5">✅ 已验证</span>
              <span v-else class="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">⏳ 待验证</span>
            </td>
            <td class="px-4 py-3 text-gray-400">{{ fmtDate(m.lastVerifiedAt) }}</td>
            <td class="px-4 py-3 text-gray-400">{{ m.verifiedBy || '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-1.5">
                <button v-if="m.dataStatus !== 'verified'" @click="verify(m)" class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-2 py-1 hover:bg-emerald-500/20">标记已验证</button>
                <button @click="openEdit(m)" class="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-2 py-1 hover:bg-cyan-500/20">编辑</button>
                <button @click="del(m)" class="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-1 hover:bg-red-500/20">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑/新增弹窗 -->
    <div v-if="dialog" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" @click.self="dialog = false">
      <div class="bg-[#0B1020] border border-[#1A2240] rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6">
        <div class="text-sm font-bold text-white mb-4">{{ editing ? '编辑模型' : '新增模型' }}</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1">模型 code（唯一）</label>
            <input v-model="form.code" :disabled="!!editing" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="deepseek-v4-flash" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1">模型名称</label>
            <input v-model="form.name" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="DeepSeek V4 Flash" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1">厂商（providerCode）</label>
            <select v-model="form.providerCode" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none">
              <option v-for="p in providers" :key="p.code" :value="p.code">{{ p.name }}（{{ p.code }}）</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1">版本</label>
            <input v-model="form.modelVersion" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="V4-Flash-0731" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1">类型（多选）</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="t in TYPE_OPTS" :key="t.key" class="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" :value="t.key" v-model="form.modelTypes" class="accent-cyan-500" />
                <span class="text-[11px] text-gray-300">{{ t.label }}</span>
              </label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] text-gray-500 block mb-1">上下文 tokens</label>
              <input v-model.number="form.contextWindow" type="number" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <label class="text-[11px] text-gray-500 block mb-1">最大输出</label>
              <input v-model.number="form.maxOutput" type="number" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div>
              <label class="text-[11px] text-gray-500 block mb-1">输入价</label>
              <input v-model.number="form.inputPrice" type="number" step="0.001" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <label class="text-[11px] text-gray-500 block mb-1">缓存命中</label>
              <input v-model.number="form.inputCacheHit" type="number" step="0.001" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <label class="text-[11px] text-gray-500 block mb-1">输出价</label>
              <input v-model.number="form.outputPrice" type="number" step="0.001" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <label class="text-[11px] text-gray-500 block mb-1">币种</label>
              <select v-model="form.currency" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none">
                <option value="USD">USD</option><option value="CNY">CNY</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-6 gap-2 col-span-2">
            <div v-for="d in CAP_DIMS" :key="d.k">
              <label class="text-[11px] text-gray-500 block mb-1">{{ d.label }}</label>
              <input v-model.number="form.capabilityScore[d.k]" type="number" min="0" max="100" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-2 py-2 text-xs text-white outline-none" />
            </div>
          </div>
          <div class="col-span-2 grid grid-cols-3 gap-2">
            <div class="col-span-1">
              <label class="text-[11px] text-gray-500 block mb-1">官方定价页 URL</label>
              <input v-model="form.officialPricingUrl" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="https://…/pricing" />
            </div>
            <div class="col-span-1">
              <label class="text-[11px] text-gray-500 block mb-1">官方 API URL</label>
              <input v-model="form.officialApiUrl" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="https://api.…" />
            </div>
            <div class="col-span-1">
              <label class="text-[11px] text-gray-500 block mb-1">官方文档 URL</label>
              <input v-model="form.officialDocsUrl" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="https://docs.…" />
            </div>
          </div>
          <div class="col-span-2 grid grid-cols-3 gap-2">
            <div class="col-span-1">
              <label class="text-[11px] text-gray-500 block mb-1">定价单位</label>
              <input v-model="form.pricingUnit" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="/1M tokens" />
            </div>
            <div class="col-span-1">
              <label class="text-[11px] text-gray-500 block mb-1">成本评分（0-100）</label>
              <input v-model.number="form.costScore" type="number" min="0" max="100" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div class="col-span-1">
              <label class="text-[11px] text-gray-500 block mb-1">验证来源类型</label>
              <input v-model="form.verificationSource" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="官方公开价格" />
            </div>
          </div>
          <div class="col-span-2">
            <label class="text-[11px] text-gray-500 block mb-1">数据来源 URL（历史兼容，可追溯）</label>
            <input v-model="form.dataSource" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none" placeholder="官方定价页 URL / OpenRouter 聚合" />
          </div>
          <div class="col-span-2">
            <label class="text-[11px] text-gray-500 block mb-1">简介</label>
            <textarea v-model="form.description" rows="2" class="w-full bg-[#0D1428] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white outline-none"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button @click="dialog = false" class="text-xs text-gray-400 px-4 py-2">取消</button>
          <button @click="save" class="text-xs bg-cyan-500 text-black font-semibold px-5 py-2 rounded-lg hover:bg-cyan-400">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
useHead({ title: 'AI模型数据库 · 后台' })

const authHeaders = (json = false) => {
  const h: Record<string, string> = {}
  const t = localStorage.getItem('admin_token')
  if (t) h.Authorization = 'Bearer ' + t
  if (json) h['Content-Type'] = 'application/json'
  return h
}

const list = ref<any[]>([])
const providers = ref<any[]>([])
const q = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')
const dialog = ref(false)
const editing = ref<any>(null)
const form = reactive<any>({
  code: '', name: '', providerCode: 'deepseek', modelVersion: '', modelTypes: ['language'],
  contextWindow: null, maxOutput: null, inputPrice: null, inputCacheHit: null, outputPrice: null,
  currency: 'USD', capabilityScore: { quality: 80, speed: 85, cost: 80, chinese: 85, coding: 80, reasoning: 80 },
  costScore: null, pricingUnit: '/1M tokens', verificationSource: '',
  officialPricingUrl: '', officialDocsUrl: '', officialApiUrl: '',
  dataSource: '', description: '',
})

const TYPE_OPTS = [
  { key: 'language', label: '语言' }, { key: 'image', label: '图片' }, { key: 'video', label: '视频' },
  { key: 'audio', label: '语音' }, { key: 'multimodal', label: '多模态' }, { key: 'agent', label: 'Agent' },
]
const CAP_DIMS = [
  { k: 'quality', label: '质量' }, { k: 'speed', label: '速度' }, { k: 'cost', label: '价格' },
  { k: 'chinese', label: '中文' }, { k: 'coding', label: '代码' }, { k: 'reasoning', label: '推理' },
]

const stats = computed(() => ({
  total: list.value.length,
  verified: list.value.filter((m) => m.dataStatus === 'verified').length,
  pending: list.value.filter((m) => m.dataStatus !== 'verified').length,
  providers: new Set(list.value.map((m) => m.providerName)).size,
}))
const filtered = computed(() => {
  let l = list.value
  if (statusFilter.value !== 'all') l = l.filter((m) => (statusFilter.value === 'verified' ? m.dataStatus === 'verified' : m.dataStatus !== 'verified'))
  if (typeFilter.value !== 'all') l = l.filter((m) => (m.modelTypes || []).includes(typeFilter.value))
  if (q.value.trim()) {
    const kw = q.value.trim().toLowerCase()
    l = l.filter((m) => m.name.toLowerCase().includes(kw) || m.code.toLowerCase().includes(kw) || (m.providerName || '').toLowerCase().includes(kw))
  }
  return l
})

async function load() {
  const [m, p] = await Promise.all([
    fetch('/api/admin/ai-model-directory', { headers: authHeaders() }).then((r) => r.json()),
    fetch('/api/admin/ai-provider-directory', { headers: authHeaders() }).then((r) => r.json()),
  ])
  if (m.code === 0) list.value = m.data
  if (p.code === 0) providers.value = p.data
}
onMounted(load)

function openNew() {
  editing.value = null
  Object.assign(form, { code: '', name: '', providerCode: providers.value[0]?.code || 'deepseek', modelVersion: '', modelTypes: ['language'], contextWindow: null, maxOutput: null, inputPrice: null, inputCacheHit: null, outputPrice: null, currency: 'USD', capabilityScore: { quality: 80, speed: 85, cost: 80, chinese: 85, coding: 80, reasoning: 80 }, costScore: null, pricingUnit: '/1M tokens', verificationSource: '', officialPricingUrl: '', officialDocsUrl: '', officialApiUrl: '', dataSource: '', description: '' })
  dialog.value = true
}
function openEdit(m: any) {
  editing.value = m
  Object.assign(form, {
    code: m.code, name: m.name, providerCode: m.providerCode, modelVersion: m.modelVersion || '',
    modelTypes: m.modelTypes || [], contextWindow: m.contextWindow, maxOutput: m.maxOutput,
    inputPrice: m.inputPrice, inputCacheHit: m.inputCacheHit, outputPrice: m.outputPrice, currency: m.currency || 'USD',
    capabilityScore: { ...(m.capabilityScore || {}) }, costScore: m.costScore ?? null,
    pricingUnit: m.pricingUnit || '/1M tokens', verificationSource: m.verificationSource || '',
    officialPricingUrl: m.officialPricingUrl || '', officialDocsUrl: m.officialDocsUrl || '', officialApiUrl: m.officialApiUrl || '',
    dataSource: m.dataSource || '', description: m.description || '',
  })
  dialog.value = true
}
async function save() {
  const payload = { ...form }
  const url = editing.value ? `/api/admin/ai-model-directory/${editing.value.id}` : '/api/admin/ai-model-directory'
  const res = await fetch(url, { method: editing.value ? 'PUT' : 'POST', headers: authHeaders(true), body: JSON.stringify(payload) }).then((r) => r.json())
  if (res.code === 0) { dialog.value = false; load() }
  else alert(res.error || '保存失败')
}
async function verify(m: any) {
  if (!confirm(`标记「${m.name}」为已验证？将写入价格验证记录`)) return
  const res = await fetch(`/api/admin/ai-model-directory/${m.id}/verify`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ verifiedBy: 'admin', dataSource: m.dataSource || '后台人工验证' }) }).then((r) => r.json())
  if (res.code === 0) load()
  else alert(res.error || '操作失败')
}
async function del(m: any) {
  if (!confirm(`删除模型「${m.name}」？`)) return
  const res = await fetch(`/api/admin/ai-model-directory/${m.id}`, { method: 'DELETE', headers: authHeaders() }).then((r) => r.json())
  if (res.code === 0) load()
}
function typeLabel(t: string) {
  const map: Record<string, string> = { language: '语言', image: '图片', video: '视频', audio: '语音', multimodal: '多模态', agent: 'Agent' }
  return map[t] || t
}
function fmtPrice(v: number | null | undefined, cur?: string): string {
  if (v == null) return '—'
  const c = cur || 'USD'
  const s = c === 'CNY' ? '¥' : '$'
  const raw = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(2)
  const out = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw
  return s + out
}
function fmtDate(d: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function fmtCtx(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1) + 'M'
  if (v >= 1000) return Math.round(v / 1000) + 'K'
  return String(v)
}
</script>
