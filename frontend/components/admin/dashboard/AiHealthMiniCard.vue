<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">🩺 AI 健康
        <span class="text-[8px] px-1.5 py-px rounded-full border" :class="healthClass">
          {{ healthText }}
        </span>
      </h3>
      <button @click="$emit('detail')" class="text-[9px] text-blue-400/80 hover:text-blue-300 cursor-pointer flex items-center gap-0.5 transition-colors">
        查看详情 <span class="text-[8px]">›</span>
      </button>
    </div>
    <div class="grid grid-cols-3 gap-2 mb-2 shrink-0">
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-emerald-400 font-mono">{{ taskHealth?.successRate ?? 0 }}%</div>
        <div class="text-[8px] text-gray-600 mt-0.5">成功率</div>
      </div>
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-amber-400 font-mono">¥{{ (taskHealth?.cost ?? 0).toFixed(2) }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">总成本</div>
      </div>
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-cyan-400 font-mono">{{ Math.round((taskHealth?.avgDurationMs ?? 0) / 1000) }}s</div>
        <div class="text-[8px] text-gray-600 mt-0.5">平均响应</div>
      </div>
    </div>
    <!-- Provider 点阵 -->
    <div class="flex items-center gap-1.5 flex-wrap flex-1 content-start">
      <div v-for="p in providers" :key="p.id" :title="`${p.name} · ${p.status}`"
        class="w-5 h-5 rounded-md flex items-center justify-center text-[7px] font-mono cursor-default"
        :class="p.status === 'ok' || p.status === 'healthy' || p.status === 'active'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-red-500/15 text-red-400 border border-red-500/20'">
        {{ p.name?.[0] || p.providerCode?.[0] }}
      </div>
      <div v-if="!providers.length" class="text-[9px] text-gray-600">暂无 Provider</div>
    </div>
    <div class="mt-2 text-[8px] text-gray-600 shrink-0">模型 {{ modelCount }} 个 · Provider {{ providers.length }} 个 · 脏数据已排除 {{ dirtyData?.dagExecutionCount ?? 0 }} 条</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  providers?: any[]
  taskHealth?: any
  modelCount?: number
  dirtyData?: any
  health?: any
}>()
defineEmits<{ (e: 'detail'): void }>()

const healthText = computed(() => {
  const h = props.health?.overall
  return h === 'ok' ? '正常' : h === 'warn' ? '关注' : h === 'error' ? '异常' : '未知'
})
const healthClass = computed(() => {
  const h = props.health?.overall
  return h === 'ok'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : h === 'warn'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20'
})
</script>
