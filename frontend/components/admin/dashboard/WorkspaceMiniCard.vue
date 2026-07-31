<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">🗺️ Workspace 生态</h3>
      <button @click="$emit('detail')" class="text-[9px] text-blue-400/80 hover:text-blue-300 cursor-pointer flex items-center gap-0.5 transition-colors">
        查看详情 <span class="text-[8px]">›</span>
      </button>
    </div>
    <div class="grid grid-cols-4 gap-2 mb-2 shrink-0">
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-white/90 font-mono">{{ data?.totalProjects ?? 0 }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">项目</div>
      </div>
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-blue-400 font-mono">{{ data?.totalEnterprises ?? 0 }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">组织</div>
      </div>
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-emerald-400 font-mono">{{ data?.paidEnterprises ?? 0 }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">付费</div>
      </div>
      <div class="px-1.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-base font-bold text-purple-400 font-mono">{{ data?.totalUsers ?? 0 }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">用户</div>
      </div>
    </div>
    <!-- 业务线 Top2 -->
    <div class="space-y-1.5 flex-1">
      <div v-for="(r, i) in (data?.ranking || []).slice(0, 2)" :key="r.biz"
        class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <span class="text-sm">{{ r.icon }}</span>
        <span class="text-[10px] text-white/70 w-14 truncate shrink-0">{{ r.label }}</span>
        <div class="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div class="h-full rounded-full" :style="{ width: barWidth(r), background: barColor(i) }"></div>
        </div>
        <span class="text-[9px] text-gray-500 font-mono shrink-0">{{ r.projects }} 项目 · {{ r.calls }} 调用</span>
      </div>
      <div v-if="!(data?.ranking || []).length" class="text-[9px] text-gray-600 text-center py-3">暂无业务线数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data?: any }>()
defineEmits<{ (e: 'detail'): void }>()

const maxCalls = computed(() => Math.max(...(props.data?.ranking || []).map((r: any) => r.calls || 0), 1))
const barWidth = (r: any) => Math.max(((r.calls || 0) / maxCalls.value) * 100, 6) + '%'
const barColor = (i: number) => ['linear-gradient(90deg,#60a5fa,#3b82f6)', 'linear-gradient(90deg,#34d399,#10b981)', 'linear-gradient(90deg,#a78bfa,#8b5cf6)'][i % 3]
</script>
