<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🖥️ 系统健康</h3>
      <span class="text-[9px] px-2 py-0.5 rounded-full font-mono"
        :class="overall === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : overall === 'warn' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'">
        {{ overallLabel }}
      </span>
    </div>

    <div v-if="!checks" class="text-center py-10 text-[10px] text-gray-600">加载中...</div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div v-for="c in orderedChecks" :key="c.key"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <span class="w-2 h-2 rounded-full shrink-0" :class="dotClass(c.status)"></span>
        <div class="flex-1 min-w-0">
          <div class="text-[11px] text-white/80">{{ c.label }}</div>
          <div class="text-[9px] text-gray-500 truncate">{{ c.detail }}</div>
        </div>
        <span class="text-[9px] font-mono" :class="textClass(c.status)">{{ statusLabel(c.status) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
}>()

const checks = computed(() => props.data?.checks || null)
const overall = computed(() => props.data?.overall || 'ok')

const overallLabel = computed(() => ({ ok: '全绿', warn: '关注', error: '异常' })[overall.value] || '—')

const orderedChecks = computed(() => {
  if (!checks.value) return []
  const order = ['database', 'redis', 'queue', 'api', 'models', 'cos']
  return order.filter((k) => checks.value[k]).map((k) => ({ key: k, ...checks.value[k] }))
})

const dotClass = (s: string) => ({
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-red-400',
}[s] || 'bg-gray-500')

const textClass = (s: string) => ({
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
}[s] || 'text-gray-500')

const statusLabel = (s: string) => ({ ok: '正常', warn: '关注', error: '异常' }[s] || '—')
</script>
