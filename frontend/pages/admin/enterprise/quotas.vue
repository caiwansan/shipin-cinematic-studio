<!-- /admin/enterprise/quotas.vue — Sprint-RECRUITMENT-REALITY-04 T03 AI 员工额度 -->
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">AI 员工额度</h1>
        <p class="text-sm text-gray-400 mt-1">Usage Ledger → 套餐配额 — 每个企业本月还能用多少</p>
      </div>
      <div class="text-xs text-gray-500">数据源: EnterpriseAgentTask 真实执行记录 · 每月 1 号重置</div>
    </div>

    <div v-if="!rows.length" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-8 text-center text-gray-500">
      暂无订阅企业
    </div>

    <div v-for="r in rows" :key="r.organizationId" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-200">{{ r.organizationName || r.organizationId.slice(0, 8) }}</span>
          <span class="px-2 py-0.5 bg-[#1A2240] rounded text-[10px] text-gray-400">{{ r.planName || r.planCode || '无套餐' }}</span>
          <span :class="r.status === 'active' ? 'text-green-400' : 'text-gray-500'" class="text-[10px]">{{ r.status }}</span>
        </div>
        <button
          class="px-2 py-1 bg-[#1A2240] hover:bg-[#243054] text-gray-300 rounded text-[10px]"
          @click="recalc(r.organizationId)"
        >重算用量</button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <div v-for="it in r.items" :key="it.capability" class="bg-[#111A38]/60 border border-[#1A2240] rounded-lg p-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-gray-400 font-mono">{{ it.capability }}</span>
            <span :class="levelClass(it.level)" class="text-[10px]">{{ levelLabel(it.level) }}</span>
          </div>
          <div class="mt-1.5 text-sm text-white font-medium">
            {{ it.used }}<span class="text-gray-500 text-xs"> / {{ it.limit }} {{ it.unit }}</span>
          </div>
          <div class="mt-1.5 h-1.5 bg-[#1A2240] rounded-full overflow-hidden">
            <div class="h-full rounded-full" :class="barClass(it.level)" :style="{ width: Math.min(it.pct, 100) + '%' }"></div>
          </div>
          <div class="mt-1 text-[10px] text-gray-500">已用 {{ it.pct }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const rows = ref<any[]>([])

function levelClass(l: string) {
  return { exhausted: 'text-red-400', warning: 'text-yellow-400', normal: 'text-green-400' }[l] || 'text-gray-400'
}
function levelLabel(l: string) {
  return { exhausted: '已用尽', warning: '预警', normal: '正常' }[l] || l
}
function barClass(l: string) {
  return { exhausted: 'bg-red-500', warning: 'bg-yellow-500', normal: 'bg-green-500' }[l] || 'bg-gray-500'
}

async function load() {
  const res = await fetch('/api/admin/enterprise/quotas')
  const d = await res.json()
  rows.value = d.data || []
}

async function recalc(organizationId: string) {
  await fetch(`/api/admin/enterprise/quotas/recalc/${organizationId}`, { method: 'POST' })
  await load()
}

onMounted(load)
</script>
