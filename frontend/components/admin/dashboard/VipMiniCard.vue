<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">💎 VIP 经营</h3>
      <button @click="$emit('detail')" class="text-[9px] text-blue-400/80 hover:text-blue-300 cursor-pointer flex items-center gap-0.5 transition-colors">
        查看详情 <span class="text-[8px]">›</span>
      </button>
    </div>
    <div class="flex items-center gap-2 mb-2 shrink-0">
      <div class="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-1 text-center">
        <span class="text-base font-bold text-amber-400 font-mono">{{ data?.total ?? 0 }}</span>
        <span class="text-[8px] text-gray-600 ml-1">VIP 总数</span>
      </div>
      <div class="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-1 text-center">
        <span class="text-base font-bold text-white/90 font-mono">{{ data?.monthNew ?? 0 }}</span>
        <span class="text-[8px] text-gray-600 ml-1">本月新增</span>
      </div>
      <div class="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-1 text-center">
        <span class="text-base font-bold text-emerald-400 font-mono">{{ activeCount }}</span>
        <span class="text-[8px] text-gray-600 ml-1">活跃</span>
      </div>
    </div>
    <!-- 套餐分布 -->
    <div class="space-y-1.5 flex-1">
      <div v-for="t in (data?.tierBreakdown || [])" :key="t.tier"
        class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <span class="text-[10px] text-white/70 w-12 truncate shrink-0">{{ t.name }}</span>
        <div class="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: tierWidth(t.count), background: tierColor(t.tier) }"></div>
        </div>
        <span class="text-[9px] text-gray-500 font-mono shrink-0">{{ t.count }}</span>
      </div>
      <div v-if="!(data?.tierBreakdown || []).length" class="text-[9px] text-gray-600 text-center py-3">暂无 VIP 数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data?: any }>()
defineEmits<{ (e: 'detail'): void }>()

const total = computed(() => (props.data?.tierBreakdown || []).reduce((s: number, t: any) => s + t.count, 0))
const activeCount = computed(() => {
  const h = props.data?.health
  return h && h.active != null ? h.active : total.value
})
const tierWidth = (c: number) => (total.value > 0 ? Math.max((c / total.value) * 100, 6) : 6) + '%'
const tierColor = (tier: string) => ({
  basic: 'linear-gradient(90deg,#94a3b8,#64748b)',
  pro: 'linear-gradient(90deg,#fbbf24,#f59e0b)',
  enterprise: 'linear-gradient(90deg,#a78bfa,#8b5cf6)',
}[tier] || 'linear-gradient(90deg,#fbbf24,#f59e0b)')
</script>
