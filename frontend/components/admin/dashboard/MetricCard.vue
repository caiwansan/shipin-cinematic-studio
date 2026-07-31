<template>
  <div class="metric-card relative overflow-hidden rounded-2xl p-5 border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-xl group hover:border-white/[0.12] transition-all duration-300 cursor-default">
    <!-- 左上角光晕 -->
    <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40" :style="{ background: glowColor }"></div>

    <div class="flex items-start justify-between relative">
      <div>
        <div class="text-[10px] tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
          <span :style="{ color: glowColor }">{{ icon }}</span>
          {{ label }}
        </div>
        <div class="mt-2 text-3xl font-bold text-white/90 font-mono leading-none">
          <span v-if="loading" class="text-gray-600 animate-pulse">···</span>
          <span v-else>{{ formatted }}</span>
        </div>
      </div>
      <span v-if="badge" class="text-[9px] px-2 py-0.5 rounded-full border whitespace-nowrap"
        :class="badgeClass">{{ badge }}</span>
    </div>

    <div v-if="sub" class="mt-3 text-[10px] text-gray-500 relative">
      {{ sub }}
      <span v-if="subHighlight" class="ml-1.5 font-medium" :style="{ color: glowColor }">{{ subHighlight }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  icon?: string
  value: string | number
  sub?: string
  subHighlight?: string
  badge?: string
  badgeTone?: 'ok' | 'warn' | 'bad' | 'info'
  color?: string
  loading?: boolean
}>()

const glowColor = computed(() => props.color || '#6366f1')

const formatted = computed(() => {
  const v = props.value
  if (typeof v === 'number' && !Number.isInteger(v)) {
    return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  }
  return String(v ?? '—')
})

const badgeClass = computed(() => {
  const tone = props.badgeTone || 'info'
  return {
    ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    bad: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }[tone]
})
</script>

<style scoped>
.metric-card {
  background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
  box-shadow: 0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
}
</style>
