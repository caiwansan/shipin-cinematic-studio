<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center gap-3">
      <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
      <span class="text-gray-600">/</span>
      <h1 class="text-lg font-semibold">💼 销售参谋</h1>
      <span class="ml-auto text-xs text-gray-500">CEO的销售参谋 · 不是销售机器人</span>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 今日日期 + 概述 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4 flex items-center justify-between">
        <div>
          <div class="text-xs text-gray-400">📅 {{ daily.date }}</div>
          <div class="text-sm font-semibold mt-1">今日重点客户: <span class="text-orange-400">{{ daily.total }}个</span></div>
        </div>
        <div class="text-xs text-gray-500">基于互动证据 · AI排序</div>
      </div>

      <!-- 重点客户推荐 -->
      <div v-for="rec in daily.recommendations" :key="rec.leadId" class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span :class="rec.priority === 'urgent' ? 'bg-red-500/10 text-red-400' : rec.priority === 'high' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'" class="text-xs px-2 py-0.5 rounded">
              {{ rec.priority === 'urgent' ? '🔥 优先' : rec.priority === 'high' ? '⚡ 重要' : '📋 一般' }}
            </span>
            <h3 class="text-sm font-semibold">{{ rec.customer }}</h3>
            <span class="text-xs text-gray-500">{{ rec.platform }}</span>
            <span class="text-xs text-gray-500">{{ rec.industry }}</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div class="text-xs text-gray-500">成交概率</div>
              <div class="text-sm font-bold" :class="rec.purchaseProb >= 70 ? 'text-green-400' : 'text-orange-400'">{{ rec.purchaseProb }}%</div>
            </div>
            <div class="text-right">
              <div class="text-xs text-gray-500">预估金额</div>
              <div class="text-sm font-bold text-yellow-400">{{ formatMoney(rec.estimatedValue) }}</div>
            </div>
          </div>
        </div>

        <!-- 最新互动 -->
        <div class="bg-[#060A18] rounded-lg p-3 mb-3">
          <div class="text-[10px] text-gray-500 mb-1">最新互动</div>
          <div class="text-xs text-gray-300">{{ rec.latestInteraction }}</div>
        </div>

        <!-- AI建议 + 话术 -->
        <div class="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
          <div class="text-[10px] text-blue-400 mb-1">📌 AI建议</div>
          <div class="text-xs text-gray-300">{{ rec.nextAction }}</div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!daily.recommendations || daily.recommendations.length === 0" class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-3">💼</div>
        <div class="text-sm">今日暂无重点推荐</div>
        <div class="text-xs mt-1 text-gray-600">系统会基于互动证据自动识别高意向客户</div>
      </div>

      <!-- AI跟进建议 -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5">
        <div class="text-xs text-gray-400 mb-3">🤖 AI 跟进建议</div>
        <div v-for="rec in recommendations" :key="rec.leadId" class="mb-3 pb-3 border-b border-[#1A2240] last:border-0">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-white">{{ rec.customer }}</span>
            <span class="text-gray-500">成交概率 {{ rec.priority }}%</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">{{ rec.reason }}</div>
          <div class="bg-[#060A18] rounded p-2 mt-2 text-xs text-gray-300 italic">{{ rec.suggestedScript }}</div>
        </div>
        <div v-if="recommendations.length === 0" class="text-xs text-gray-500">暂无建议</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const daily = ref({})
const recommendations = ref([])

async function loadDaily() {
  try {
    const res = await fetch('/api/enterprise/sales/daily')
    const json = await res.json()
    if (json.code === 0) daily.value = json.data
  } catch (e) { console.error(e) }
}

async function loadRecommendations() {
  try {
    const res = await fetch('/api/enterprise/sales/recommendations')
    const json = await res.json()
    if (json.code === 0) recommendations.value = json.data
  } catch (e) { console.error(e) }
}

function formatMoney(v) {
  if (!v) return '¥0'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v}`
}

onMounted(() => {
  loadDaily()
  loadRecommendations()
})
</script>
