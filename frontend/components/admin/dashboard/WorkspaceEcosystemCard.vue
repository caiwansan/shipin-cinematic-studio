<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">🗺️ Workspace 生态地图</h3>
      <span class="text-[9px] text-gray-600">{{ windowLabel }}窗口 · 真实聚合</span>
    </div>
    <div class="grid grid-cols-3 gap-2 flex-1 content-start">
      <div v-for="line in lines" :key="line.code"
        class="rounded-lg border px-2.5 py-2 flex flex-col gap-1"
        :class="line.status === 'offline'
          ? 'border-white/[0.04] bg-white/[0.01] opacity-50'
          : 'border-white/[0.06] bg-white/[0.03]'">
        <div class="flex items-center gap-1.5">
          <span class="text-sm leading-none">{{ line.icon }}</span>
          <span class="text-[10px] font-medium text-white/80 truncate">{{ line.label }}</span>
          <span class="ml-auto text-[8px] px-1.5 py-0.5 rounded-full shrink-0"
            :class="line.status === 'offline' ? 'bg-white/[0.04] text-gray-500' : 'bg-emerald-400/10 text-emerald-400'">
            {{ line.status === 'offline' ? '未上线' : '运营中' }}
          </span>
        </div>
        <template v-if="line.status !== 'offline'">
          <div class="flex items-end gap-2 mt-0.5">
            <span class="text-base font-bold text-white/90 font-mono leading-none">{{ line.projects ?? 0 }}</span>
            <span class="text-[8px] text-gray-500 pb-0.5">项目</span>
            <span class="text-base font-bold text-blue-400 font-mono leading-none ml-2">{{ line.calls ?? 0 }}</span>
            <span class="text-[8px] text-gray-500 pb-0.5">调用</span>
          </div>
          <div class="flex items-center gap-2 text-[8px] text-gray-500">
            <span>{{ line.users ?? 0 }} 用户</span>
            <span v-if="line.agents != null">· {{ line.agents }} AI员工</span>
            <span v-if="(line.cost || 0) > 0">· ${{ Number(line.cost).toFixed(2) }}</span>
          </div>
        </template>
        <div v-else class="text-[8px] text-gray-600 py-1">{{ line.note || '暂无数据' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ data?: any }>()
const lines = computed(() => props.data?.lines || [])
</script>
