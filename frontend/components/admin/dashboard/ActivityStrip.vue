<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-4 py-2.5 flex items-center gap-3 overflow-hidden">
    <div class="flex items-center gap-1.5 shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
      <span class="text-[9px] text-gray-500 font-mono tracking-wider">LIVE</span>
    </div>
    <div class="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1" style="scrollbar-width: none;">
      <div v-for="(e, i) in events.slice(0, 8)" :key="i"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] whitespace-nowrap shrink-0">
        <span class="text-[10px]">{{ e.icon }}</span>
        <span class="text-[9px] text-white/70">{{ e.text }}</span>
        <span class="text-[8px] text-gray-600 font-mono">{{ fmtTime(e.time) }}</span>
      </div>
      <div v-if="!events.length" class="text-[9px] text-gray-600">近 72h 暂无事件</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ events?: any[] }>()

const fmtTime = (t: string) => {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>
