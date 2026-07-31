<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🗺️ Workspace 生态地图</h3>
      <span class="text-[9px] text-gray-600">本月 · {{ (ranking || []).length }} 业务线</span>
    </div>

    <!-- 生态规模 -->
    <div class="grid grid-cols-4 gap-2 mb-4 text-center">
      <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <div class="text-base font-bold text-white/90 font-mono">{{ data?.totalEnterprises ?? '—' }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">企业</div>
      </div>
      <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <div class="text-base font-bold text-white/90 font-mono">{{ data?.totalProjects ?? '—' }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">项目</div>
      </div>
      <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <div class="text-base font-bold text-emerald-400 font-mono">{{ data?.paidEnterprises ?? '—' }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">付费企业</div>
      </div>
      <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <div class="text-base font-bold text-white/90 font-mono">{{ data?.totalUsers ?? '—' }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">用户</div>
      </div>
    </div>

    <!-- 业务线卡片 -->
    <div class="space-y-2">
      <div v-for="(r, i) in rankingTop" :key="r.biz"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all">
        <span class="text-lg">{{ r.icon }}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-white/80 font-medium">{{ r.label }}</span>
            <span class="text-[8px] text-gray-600">{{ r.biz }}</span>
          </div>
          <div class="flex items-center gap-3 mt-1 text-[9px] text-gray-500">
            <span>⚡ {{ r.calls }} 次调用</span>
            <span v-if="r.projects">📁 {{ r.projects }} 项目</span>
            <span v-if="r.enterprises">🏢 {{ r.enterprises }} 企业</span>
            <span class="text-amber-400/70 font-mono">¥{{ r.cost.toFixed(2) }}</span>
          </div>
        </div>
        <div class="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
          <div class="h-full rounded-full" :style="{ width: barWidth(r.calls), background: barColor(i) }"></div>
        </div>
      </div>
      <div v-if="(ranking || []).length === 0" class="text-center text-[10px] text-gray-600 py-6">
        本月暂无业务线调用
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  ranking: any[]
  data?: any
}>()

const rankingTop = computed(() => (props.ranking || []).slice(0, 6))
const maxCalls = computed(() => Math.max(...(props.ranking || []).map((r: any) => r.calls), 1))

const barWidth = (calls: number) => Math.max((calls / maxCalls.value) * 100, 4) + '%'
const barColor = (i: number) => [
  'linear-gradient(90deg,#60a5fa,#3b82f6)',
  'linear-gradient(90deg,#34d399,#10b981)',
  'linear-gradient(90deg,#a78bfa,#8b5cf6)',
  'linear-gradient(90deg,#fbbf24,#f59e0b)',
  'linear-gradient(90deg,#22d3ee,#06b6d4)',
  'linear-gradient(90deg,#f472b6,#ec4899)',
][i % 6]
</script>
