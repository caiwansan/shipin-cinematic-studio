<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">⚡ 实时事件流</h3>
      <span class="flex items-center gap-1 text-[9px] text-emerald-400">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE
      </span>
    </div>

    <div v-if="events.length === 0" class="text-center py-10 text-[10px] text-gray-600">近 72h 暂无事件</div>

    <div class="relative space-y-3 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
      <!-- 时间线竖线 -->
      <div class="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]"></div>

      <div v-for="(e, i) in events.slice(0, 12)" :key="i" class="relative flex items-start gap-3 pl-0.5">
        <span class="relative z-10 w-[15px] h-[15px] rounded-full flex items-center justify-center text-[7px] shrink-0 mt-0.5"
          :class="dotClass(e.kind)">{{ e.icon }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-[10px] text-white/70 truncate">{{ e.text }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5 font-mono">{{ timeStr(e.time) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  events: { time: string; icon: string; text: string; kind: string }[]
}>()

const dotClass = (k: string) => ({
  user: 'bg-blue-500/20 border border-blue-500/30',
  payment: 'bg-emerald-500/20 border border-emerald-500/30',
  usage: 'bg-indigo-500/20 border border-indigo-500/30',
  audit: 'bg-amber-500/20 border border-amber-500/30',
}[k] || 'bg-gray-500/20 border border-gray-500/30')

const timeStr = (t: string) => {
  const d = new Date(t)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 3px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
</style>
