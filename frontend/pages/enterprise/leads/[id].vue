<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center gap-3">
      <NuxtLink to="/enterprise/leads" class="text-gray-400 hover:text-white transition">← 商机洞察</NuxtLink>
      <span class="text-gray-600">/</span>
      <h1 class="text-lg font-semibold">{{ lead.customerName || '线索详情' }}</h1>
    </div>

    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <!-- 客户画像 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold">{{ lead.customerName }}</h2>
            <div class="text-xs text-gray-500 mt-1">{{ lead.platform }} · {{ lead.industry }} · {{ lead.companySize }}</div>
          </div>
          <span :class="tempClass(lead.temperature)" class="text-sm px-3 py-1 rounded">{{ tempLabel(lead.temperature) }}</span>
        </div>
        <div class="grid grid-cols-4 gap-3">
          <div class="text-center bg-[#060A18] rounded-lg p-3">
            <div class="text-xl font-bold text-blue-400">{{ lead.intentScore }}</div>
            <div class="text-[10px] text-gray-500">意向分</div>
          </div>
          <div class="text-center bg-[#060A18] rounded-lg p-3">
            <div class="text-xl font-bold text-green-400">{{ lead.purchaseProb }}%</div>
            <div class="text-[10px] text-gray-500">成交概率</div>
          </div>
          <div class="text-center bg-[#060A18] rounded-lg p-3">
            <div class="text-xl font-bold text-yellow-400">{{ formatMoney(lead.estimatedValue) }}</div>
            <div class="text-[10px] text-gray-500">预估金额</div>
          </div>
          <div class="text-center bg-[#060A18] rounded-lg p-3">
            <div class="text-xl font-bold text-purple-400">{{ statusLabel(lead.status) }}</div>
            <div class="text-[10px] text-gray-500">状态</div>
          </div>
        </div>
      </div>

      <!-- 证据链 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="text-sm font-semibold mb-3">🔍 意向证据链</div>
        <div v-for="(sig, i) in signals" :key="i" class="mb-2 pb-2 border-b border-[#1A2240] last:border-0">
          <div class="flex items-center gap-2 text-xs">
            <span class="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded">+{{ sig.weight }}分</span>
            <span class="text-gray-300">{{ sig.evidence }}</span>
          </div>
        </div>
        <div v-if="signals.length === 0" class="text-xs text-gray-500">暂无证据记录</div>
      </div>

      <!-- 跟进动作 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="text-sm font-semibold mb-3">📝 跟进动作</div>
        <div class="flex gap-2 mb-3">
          <button @click="updateStatus('contacting')" class="bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg text-xs">标记为联系中</button>
          <button @click="updateStatus('qualified')" class="bg-purple-600/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs">认证为合格</button>
          <button @click="updateStatus('opportunity')" class="bg-orange-600/20 text-orange-400 px-3 py-1.5 rounded-lg text-xs">升级为商机</button>
          <button @click="updateStatus('won')" class="bg-green-600/20 text-green-400 px-3 py-1.5 rounded-lg text-xs">🎉 成交</button>
        </div>
        <div class="flex gap-2">
          <input v-model="actionNote" type="text" placeholder="记录跟进备忘..." class="flex-1 bg-[#060A18] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" />
          <button @click="recordAction" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs">记录</button>
        </div>
      </div>

      <!-- AI建议 -->
      <div class="bg-[#0D1328] border border-blue-500/20 rounded-xl p-5">
        <div class="text-sm font-semibold text-blue-300 mb-2">📌 AI 下一步建议</div>
        <div class="text-sm text-gray-300">{{ lead.nextAction }}</div>
      </div>

      <!-- 互动历史 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="text-sm font-semibold mb-3">📋 互动历史</div>
        <div v-for="(ix, i) in interactions" :key="i" class="mb-2 pb-2 border-b border-[#1A2240] last:border-0 text-xs">
          <span class="text-gray-500">{{ formatTime(ix.createdAt) }}</span>
          <span class="ml-2 text-blue-300">{{ ix.type }}</span>
          <span class="ml-2 text-gray-300">{{ ix.content }}</span>
        </div>
        <div v-if="interactions.length === 0" class="text-xs text-gray-500">暂无互动</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const lead = ref({})
const signals = ref([])
const interactions = ref([])
const actionNote = ref('')

async function loadLead() {
  try {
    const res = await fetch(`/api/enterprise/leads/${route.params.id}`)
    const json = await res.json()
    if (json.code === 0) {
      lead.value = json.data
      signals.value = json.data.intentSignals || []
      interactions.value = json.data.interactions || []
    }
  } catch (e) { console.error(e) }
}

async function updateStatus(status) {
  try {
    await fetch(`/api/enterprise/leads/${route.params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    lead.value.status = status
  } catch (e) { console.error(e) }
}

async function recordAction() {
  if (!actionNote) return
  try {
    await fetch(`/api/enterprise/leads/${route.params.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CEO备忘', note: actionNote })
    })
    actionNote.value = ''
    await loadLead()
  } catch (e) { console.error(e) }
}

function tempClass(t) {
  return { customer: 'bg-yellow-500/10 text-yellow-400', hot: 'bg-orange-500/10 text-orange-400', warm: 'bg-blue-500/10 text-blue-400', cold: 'bg-gray-500/10 text-gray-400' }[t] || 'bg-gray-500/10 text-gray-400'
}

function tempLabel(t) {
  return { customer: '⭐ 客户', hot: '🔥 热线索', warm: '🟡 温线索', cold: '❄️ 冷线索' }[t] || '❄️'
}

function statusLabel(s) {
  return { new: '新线索', contacting: '联系中', qualified: '已认证', opportunity: '商机', won: '成交', lost: '失败' }[s] || s
}

function formatMoney(v) {
  if (!v) return '¥0'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v}`
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadLead()
})
</script>
