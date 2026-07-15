<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center gap-3">
      <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
      <span class="text-gray-600">/</span>
      <h1 class="text-lg font-semibold">💰 增长收益</h1>
      <span class="ml-auto text-xs text-gray-500">投入 · 产出 · 预测</span>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 来源指示器 -->
      <div v-if="sourceFrom" class="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
        <span class="text-blue-400 text-sm">📊</span>
        <div class="flex-1 text-xs">
          <span class="text-blue-300 font-medium">数据来源：{{ sourceFrom.label }}</span>
          <span class="text-gray-400 ml-2">{{ sourceFrom.detail }}</span>
        </div>
        <NuxtLink to="/enterprise/approval" class="text-xs text-gray-400 hover:text-blue-400 transition">← 返回审批中心</NuxtLink>
      </div>

      <!-- 三分离展示 -->
      <div class="grid grid-cols-3 gap-4">
        <!-- 投入 -->
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
          <div class="text-gray-400 text-xs mb-2">📥 AI投入（真实）</div>
          <div class="text-2xl font-bold text-blue-400">{{ roi.investment?.displayCost || '¥0' }}</div>
          <div class="mt-2 space-y-1 text-xs text-gray-500">
            <div>套餐: {{ formatFen(roi.investment?.planCost) }}</div>
            <div>Token: {{ formatFen(roi.investment?.tokenCost) }}</div>
            <div>渠道: {{ formatFen(roi.investment?.channelCost) }}</div>
          </div>
        </div>
        <!-- 已产生价值 -->
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
          <div class="text-gray-400 text-xs mb-2">📊 已产生价值（真实）</div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div class="text-xl font-bold text-purple-400">{{ roi.realized?.leads || 0 }}</div>
              <div class="text-[10px] text-gray-500">线索数</div>
            </div>
            <div>
              <div class="text-xl font-bold text-orange-400">{{ roi.realized?.hotLeads || 0 }}</div>
              <div class="text-[10px] text-gray-500">热线索</div>
            </div>
            <div>
              <div class="text-xl font-bold text-cyan-400">{{ roi.realized?.interactions || 0 }}</div>
              <div class="text-[10px] text-gray-500">互动数</div>
            </div>
            <div>
              <div class="text-xl font-bold text-green-400">{{ roi.realized?.opportunities || 0 }}</div>
              <div class="text-[10px] text-gray-500">商机数</div>
            </div>
          </div>
        </div>
        <!-- 预测价值 -->
        <div class="bg-[#0D1328] border border-yellow-500/20 rounded-xl p-5">
          <div class="text-gray-400 text-xs mb-2">🔮 预测价值（模型）</div>
          <div class="text-2xl font-bold text-yellow-400">{{ roi.predicted?.displayRevenue || '¥0' }}</div>
          <div class="mt-2 space-y-1 text-xs text-gray-500">
            <div>平均客单价: {{ formatFen(roi.predicted?.avgDealSize) }}</div>
            <div>加权Pipeline: {{ roi.predicted?.displayPipeline }}</div>
          </div>
        </div>
      </div>

      <!-- ROI 倍数 + 效率 -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 text-center">
          <div class="text-gray-400 text-xs mb-1">ROI 倍数</div>
          <div class="text-3xl font-bold" :class="(roi.efficiency?.roiRatio || 0) > 0 ? 'text-green-400' : 'text-gray-400'">
            {{ roi.efficiency?.roiDisplay || '0x' }}
          </div>
          <div class="w-full bg-[#060A18] rounded-full h-2 mt-2">
            <div class="bg-green-500 h-2 rounded-full" :style="{ width: Math.min((roi.efficiency?.roiRatio || 0) * 10, 100) + '%' }"></div>
          </div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 text-center">
          <div class="text-gray-400 text-xs mb-1">单线索成本</div>
          <div class="text-3xl font-bold text-cyan-400">{{ formatFen(roi.efficiency?.costPerLead) }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 text-center">
          <div class="text-gray-400 text-xs mb-1">投入产出比</div>
          <div class="text-3xl font-bold text-purple-400">{{ roi.realized?.leads || 0 }}:1</div>
          <div class="text-[10px] text-gray-500 mt-1">每元投入: {{ roi.realized?.leads || 0 }}个线索</div>
        </div>
      </div>

      <!-- 渠道分解 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="text-xs text-gray-400 mb-3">按渠道分解</div>
        <div v-if="channels.length > 0" class="grid grid-cols-4 gap-3">
          <div v-for="ch in channels" :key="ch.platform" class="bg-[#060A18] border border-[#1A2240] rounded-lg p-3 text-center">
            <div class="text-sm font-semibold">{{ platformLabels[ch.platform] || ch.platform }}</div>
            <div class="text-lg font-bold text-blue-400 mt-1">{{ ch.interactions }}</div>
            <div class="text-[10px] text-gray-500">互动</div>
            <div class="text-lg font-bold text-green-400 mt-1">{{ ch.leads }}</div>
            <div class="text-[10px] text-gray-500">线索</div>
            <div class="text-xs font-bold text-yellow-400 mt-1">{{ formatFen(ch.predictedRevenue) }}</div>
            <div class="text-[10px] text-gray-500">预测收入</div>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 text-sm py-4">暂无渠道数据</div>
      </div>

      <!-- CEO 结论卡 -->
      <div class="bg-gradient-to-r from-[#0D1328] to-[#1A0D28] border border-purple-500/20 rounded-xl p-6">
        <div class="text-sm font-semibold text-purple-300 mb-2">💡 CEO 收入结论</div>
        <div class="text-sm text-gray-300 leading-relaxed">
          本月AI增长部门投入 <strong class="text-blue-400">{{ roi.investment?.displayCost || '¥0' }}</strong>，
          发现 <strong class="text-purple-400">{{ roi.realized?.leads || 0 }}</strong> 个潜在客户，
          其中 <strong class="text-orange-400">{{ roi.realized?.hotLeads || 0 }}</strong> 个高意向线索。
          预测商机价值 <strong class="text-yellow-400">{{ roi.predicted?.displayRevenue || '¥0' }}</strong>，
          ROI <strong :class="(roi.efficiency?.roiRatio || 0) > 0 ? 'text-green-400' : 'text-gray-400'">{{ roi.efficiency?.roiDisplay || '0x' }}</strong>。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const roi = ref({})
const channels = ref([])
const platformLabels = {
  wechat_official: '公众号',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手'
}

// 跨页面来源
const sourceFrom = computed(() => {
  if (route.query.source === 'approval') {
    return { label: '审批中心', detail: '审批通过后的渠道发布效果' }
  }
  return null
})

async function loadROI() {
  try {
    const res = await fetch('/api/enterprise/roi')
    const json = await res.json()
    if (json.code === 0) roi.value = json.data
  } catch (e) { console.error(e) }
}

async function loadChannels() {
  try {
    const res = await fetch('/api/enterprise/roi/channels')
    const json = await res.json()
    if (json.code === 0) channels.value = json.data.channels || []
  } catch (e) { console.error(e) }
}

function formatFen(fen) {
  if (!fen) return '¥0'
  const yuan = fen / 100
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}万`
  if (yuan >= 1000) return `¥${(yuan / 1000).toFixed(1)}k`
  return `¥${yuan.toFixed(0)}`
}

onMounted(() => {
  loadROI()
  loadChannels()
})
</script>
