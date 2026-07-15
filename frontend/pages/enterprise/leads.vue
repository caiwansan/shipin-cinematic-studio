<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center gap-3">
      <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
      <span class="text-gray-600">/</span>
      <h1 class="text-lg font-semibold">🎯 商机洞察</h1>
      <span class="ml-auto text-xs text-gray-500">基于互动证据 · AI评分</span>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 统计面板 -->
      <div class="grid grid-cols-5 gap-3">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">线索总数</div>
          <div class="text-2xl font-bold">{{ stats.total || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">🔥 热线索</div>
          <div class="text-2xl font-bold text-orange-400">{{ stats.byTemperature?.hot || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">⭐ 客户级</div>
          <div class="text-2xl font-bold text-yellow-400">{{ stats.byTemperature?.customer || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">预测商机价值</div>
          <div class="text-2xl font-bold text-green-400">{{ formatMoney(stats.totalOpportunityValue) }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">平均意向分</div>
          <div class="text-2xl font-bold text-blue-400">{{ stats.avgScore || 0 }}</div>
        </div>
      </div>

      <!-- 漏斗 -->
      <div v-if="stats.byStatus" class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-400 mb-3">线索漏斗</div>
        <div class="flex items-center gap-2">
          <div v-for="(count, key) in funnelData" :key="key" class="flex-1 text-center">
            <div class="bg-[#060A18] border border-[#1A2240] rounded-lg p-2">
              <div class="text-lg font-bold" :class="funnelColor(key)">{{ count }}</div>
              <div class="text-[10px] text-gray-500">{{ funnelLabel(key) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 温度筛选 -->
      <div class="flex items-center gap-2">
        <button @click="filterTemp = ''" :class="filterTemp === '' ? 'bg-blue-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'" class="px-3 py-1.5 rounded-lg text-xs font-medium">全部</button>
        <button @click="filterTemp = 'customer'" :class="filterTemp === 'customer' ? 'bg-yellow-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'" class="px-3 py-1.5 rounded-lg text-xs font-medium">⭐ 客户</button>
        <button @click="filterTemp = 'hot'" :class="filterTemp === 'hot' ? 'bg-orange-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'" class="px-3 py-1.5 rounded-lg text-xs font-medium">🔥 热线索</button>
        <button @click="filterTemp = 'warm'" :class="filterTemp === 'warm' ? 'bg-blue-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'" class="px-3 py-1.5 rounded-lg text-xs font-medium">🟡 温线索</button>
        <button @click="filterTemp = 'cold'" :class="filterTemp === 'cold' ? 'bg-gray-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'" class="px-3 py-1.5 rounded-lg text-xs font-medium">❄️ 冷线索</button>
        <div class="ml-auto">
          <button @click="analyzeLeads" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium">⚡ 分析互动</button>
        </div>
      </div>

      <!-- 线索列表 -->
      <div class="space-y-3">
        <div v-for="lead in items" :key="lead.id" class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 hover:border-[#2A3560] transition cursor-pointer" @click="$router.push(`/enterprise/leads/${lead.id}`)">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span :class="tempClass(lead.temperature)" class="text-xs px-2 py-0.5 rounded">{{ tempLabel(lead.temperature) }}</span>
              <h3 class="text-sm font-semibold">{{ lead.customerName || '匿名用户' }}</h3>
              <span class="text-xs text-gray-500">{{ lead.platform }}</span>
            </div>
            <div class="text-xs text-gray-500">{{ formatTime(lead.createdAt) }}</div>
          </div>
          <div class="flex items-center gap-4 text-xs">
            <span class="text-gray-400">意向分 <strong class="text-blue-400">{{ lead.intentScore }}</strong></span>
            <span class="text-gray-400">成交概率 <strong :class="probClass(lead.purchaseProb)">{{ lead.purchaseProb }}%</strong></span>
            <span class="text-gray-400">预估金额 <strong class="text-green-400">{{ formatMoney(lead.estimatedValue) }}</strong></span>
            <span class="text-gray-400">状态 <strong :class="statusClass(lead.status)">{{ statusLabel(lead.status) }}</strong></span>
          </div>
          <div class="mt-2 text-xs text-gray-500">
            建议: {{ lead.nextAction }}
          </div>
          <!-- 行动按钮：高意向线索可创建跟进任务 -->
          <div v-if="lead.temperature === 'hot' || lead.temperature === 'customer'" class="mt-3 flex gap-2">
            <NuxtLink
              :to="`/enterprise/tasks?source=leads&customer=${encodeURIComponent(lead.customerName || '')}&platform=${lead.platform}&action=跟进`"
              class="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs px-3 py-1.5 rounded-lg transition"
            >
              📋 创建跟进任务
            </NuxtLink>
            <NuxtLink
              :to="`/enterprise/leads/${lead.id}`"
              class="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs px-3 py-1.5 rounded-lg transition"
            >
              📊 查看详情
            </NuxtLink>
          </div>
          <!-- 证据链 -->
          <div v-if="lead.intentSignalsParsed?.length > 0" class="mt-2 flex flex-wrap gap-1">
            <span v-for="(sig, i) in lead.intentSignalsParsed.slice(0, 3)" :key="i" class="text-[10px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded">
              {{ sig.type === 'pricing_question' ? '💰 询价' : sig.type === 'case_interest' ? '📋 案例' : sig.type === 'direct_message' ? '💬 留言' : sig.type === 'content_download' ? '📥 下载' : '🔍 ' + sig.type }}
            </span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="items.length === 0" class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-3">🎯</div>
        <div class="text-sm">暂无线索记录</div>
        <div class="text-xs mt-1 text-gray-600">点击"分析互动"将已有互动数据转化为线索智能</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const items = ref([])
const stats = ref({})
const filterTemp = ref('')

const funnelData = computed(() => {
  const s = stats.value.byStatus || {}
  return {
    new: s.new || 0,
    contacting: s.contacting || 0,
    qualified: s.qualified || 0,
    opportunity: s.opportunity || 0,
    won: s.won || 0
  }
})

async function loadStats() {
  try {
    const res = await fetch('/api/enterprise/leads/stats')
    const json = await res.json()
    if (json.code === 0) stats.value = json.data
  } catch (e) { console.error(e) }
}

async function loadList() {
  try {
    const params = new URLSearchParams()
    if (filterTemp.value) params.set('temperature', filterTemp.value)
    const res = await fetch(`/api/enterprise/leads?${params}`)
    const json = await res.json()
    if (json.code === 0) {
      items.value = (json.data.items || []).map(l => ({
        ...l,
        intentSignalsParsed: JSON.parse(l.intentSignals || '[]')
      }))
    }
  } catch (e) { console.error(e) }
}

async function analyzeLeads() {
  try {
    const res = await fetch('/api/enterprise/leads/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'douyin',
        platformUserId: 'user_0_19_4',
        customerName: '王总',
        industry: '新能源',
        companySize: '200+'
      })
    })
    const json = await res.json()
    if (json.code === 0) {
      alert(`线索分析成功！意向分: ${json.data.intentScore}, 温度: ${json.data.temperature}`)
      await loadList()
      await loadStats()
    } else {
      alert(json.message)
    }
  } catch (e) { alert('分析失败: ' + e.message) }
}

function funnelLabel(k) {
  return { new: '新线索', contacting: '联系中', qualified: '已认证', opportunity: '商机', won: '成交' }[k] || k
}

function funnelColor(k) {
  return { new: 'text-gray-400', contacting: 'text-blue-400', qualified: 'text-purple-400', opportunity: 'text-orange-400', won: 'text-green-400' }[k] || 'text-gray-400'
}

function tempClass(t) {
  return { customer: 'bg-yellow-500/10 text-yellow-400', hot: 'bg-orange-500/10 text-orange-400', warm: 'bg-blue-500/10 text-blue-400', cold: 'bg-gray-500/10 text-gray-400' }[t] || 'bg-gray-500/10 text-gray-400'
}

function tempLabel(t) {
  return { customer: '⭐ 客户', hot: '🔥 热线索', warm: '🟡 温线索', cold: '❄️ 冷线索' }[t] || '❄️ 未知'
}

function probClass(p) {
  if (p >= 70) return 'text-green-400'
  if (p >= 50) return 'text-blue-400'
  return 'text-yellow-400'
}

function statusClass(s) {
  return { new: 'text-gray-400', contacting: 'text-blue-400', qualified: 'text-purple-400', opportunity: 'text-orange-400', won: 'text-green-400', lost: 'text-red-400' }[s] || 'text-gray-400'
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
  const now = new Date()
  const diff = (now - d) / (1000 * 60 * 60 * 24)
  if (diff < 1) return '今天'
  if (diff < 7) return `${Math.floor(diff)}天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

watch(filterTemp, () => loadList())

onMounted(() => {
  loadStats()
  loadList()
})
</script>
