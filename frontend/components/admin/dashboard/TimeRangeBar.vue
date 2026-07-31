<template>
  <div class="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
    <!-- 标题 -->
    <div class="flex items-center gap-2 mr-1">
      <span class="text-sm font-bold tracking-wide" style="background: linear-gradient(90deg,#fff,#60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        昆仑镜 AI Operating Center
      </span>
      <span class="text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
        <span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span> 系统正常
      </span>
    </div>

    <div class="flex-1"></div>

    <!-- 数据范围 -->
    <div class="flex items-center gap-1 bg-black/20 rounded-lg p-1">
      <span class="text-[9px] text-gray-500 px-1.5">数据范围</span>
      <button v-for="r in ranges" :key="r.key" @click="$emit('change', r.key)"
        class="px-2.5 py-1 text-[10px] rounded-md transition-all cursor-pointer"
        :class="modelValue === r.key
          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30 font-medium'
          : 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-transparent'">
        {{ r.label }}
      </button>
    </div>

    <!-- 企业筛选（数据层未绑定 → 禁用态，05 接入） -->
    <div class="flex items-center gap-1 bg-black/20 rounded-lg px-2.5 py-1 cursor-not-allowed opacity-50" title="企业级数据绑定将在 ADMIN-IA-REALITY-05 Agent 管理中打通">
      <span class="text-[9px] text-gray-500">企业</span>
      <span class="text-[10px] text-gray-300">全部 ▾</span>
    </div>

    <button @click="$emit('refresh')" class="text-[10px] px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer flex items-center gap-1">
      ⟳ <span v-if="loading" class="animate-spin inline-block">◌</span><span v-else>刷新</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  loading?: boolean
}>()
defineEmits<{ (e: 'change', range: string): void; (e: 'refresh'): void }>()

const ranges = [
  { key: 'today', label: '今天' },
  { key: '7d', label: '7天' },
  { key: '30d', label: '30天' },
  { key: '90d', label: '90天' },
  { key: 'year', label: '今年' },
]
</script>
