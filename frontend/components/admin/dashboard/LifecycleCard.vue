<!-- SPRINT-AGENT-OPERATIONS-01 T03: 企业 AI 员工生命周期 + 流失风险 -->
<!-- 阶段：试用→上岗观察→稳定运行→沉睡/到期；到期≤14天=续费风险；部署未使用=可能流失 -->
<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">🔄 企业 AI 员工生命周期</h3>
      <span class="text-[9px] text-gray-600">试用 → 观察 → 运行 → 续费</span>
    </div>

    <!-- 汇总 -->
    <div v-if="summary" class="flex flex-wrap gap-1.5 mb-2 shrink-0">
      <span class="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] text-gray-400">企业 {{ summary.enterprises }}</span>
      <span class="text-[9px] px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400">运行中 {{ summary.working }}</span>
      <span class="text-[9px] px-2 py-1 rounded-full bg-amber-400/10 text-amber-400">沉睡 {{ summary.dormant }}</span>
      <span class="text-[9px] px-2 py-1 rounded-full bg-orange-400/10 text-orange-400">续费风险 {{ summary.renewalRisk }}</span>
      <span class="text-[9px] px-2 py-1 rounded-full bg-red-400/10 text-red-400">到期 {{ summary.expired }}</span>
    </div>

    <div class="flex-1 space-y-1.5 overflow-y-auto pr-1" style="max-height: 200px">
      <template v-if="enterprises.length === 0">
        <div class="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-4 text-center">
          <p class="text-[10px] text-gray-500">暂无企业订阅</p>
        </div>
      </template>
      <div v-for="e in enterprises" :key="e.orgId" class="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-semibold text-white/80 truncate">{{ e.orgName }}</span>
          <span class="text-[8px] text-gray-600 truncate">{{ e.planName }}</span>
          <span class="ml-auto text-[8px] px-1.5 py-0.5 rounded-full shrink-0" :class="stageClass(e.stage)">{{ e.stageLabel }}</span>
        </div>
        <div class="flex items-center gap-2 mt-0.5 text-[8px] text-gray-500">
          <span>员工 {{ e.agents }}</span>
          <span>· 执行 {{ e.tasks30d }}</span>
          <span>· 成本 ¥{{ e.cost30d }}</span>
          <span v-if="e.savedValue != null" class="text-emerald-400">· 价值 ¥{{ e.savedValue }}</span>
          <span v-if="e.daysToExpire != null" :class="e.daysToExpire <= 14 ? 'text-orange-400' : ''">· {{ e.daysToExpire }} 天后到期</span>
        </div>
        <div v-if="e.risks.length" class="mt-0.5 space-y-0.5">
          <p v-for="(r, i) in e.risks" :key="i" class="text-[8px] text-red-400/90">⚠️ {{ r }}</p>
        </div>
      </div>
    </div>

    <div class="mt-2 pt-2 border-t border-white/[0.05] shrink-0">
      <p class="text-[8px] text-gray-600 leading-relaxed">{{ summary?.stageNote }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data?: any }>()

const enterprises = computed(() => props.data?.enterprises || [])
const summary = computed(() => props.data?.summary || null)

function stageClass(s: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-400/10 text-emerald-400',
    OBSERVING: 'bg-sky-400/10 text-sky-400',
    TRIAL: 'bg-violet-400/10 text-violet-400',
    RENEWAL_RISK: 'bg-orange-400/10 text-orange-400',
    DORMANT: 'bg-amber-400/10 text-amber-400',
    EXPIRED: 'bg-red-400/10 text-red-400',
    NO_SUBSCRIPTION: 'bg-gray-400/10 text-gray-400',
  }
  return map[s] || 'bg-gray-400/10 text-gray-400'
}
</script>
