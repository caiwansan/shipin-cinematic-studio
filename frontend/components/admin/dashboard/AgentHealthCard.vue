<!-- SPRINT-AGENT-OPERATIONS-01 T02: AI 员工健康中心 -->
<!-- 真实数据判定：绿=30天有执行且成功率≥95% · 黄=成功率<95%或7天无执行 · 红=非active或成功率<90% · 待上岗=无执行记录 -->
<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">🩺 AI 员工健康中心</h3>
      <span class="text-[9px] text-gray-600">30 天真实执行 · 规则判定</span>
    </div>

    <!-- 健康分布 -->
    <div v-if="summary" class="grid grid-cols-4 gap-1.5 mb-2 shrink-0">
      <div class="rounded-lg px-2 py-1.5 text-center" :class="'bg-emerald-400/10'">
        <div class="text-[13px] font-bold text-emerald-400 font-mono">{{ summary.green }}</div>
        <div class="text-[8px] text-gray-500">🟢 正常</div>
      </div>
      <div class="rounded-lg px-2 py-1.5 text-center" :class="'bg-amber-400/10'">
        <div class="text-[13px] font-bold text-amber-400 font-mono">{{ summary.yellow }}</div>
        <div class="text-[8px] text-gray-500">🟡 注意</div>
      </div>
      <div class="rounded-lg px-2 py-1.5 text-center" :class="'bg-red-400/10'">
        <div class="text-[13px] font-bold text-red-400 font-mono">{{ summary.red }}</div>
        <div class="text-[8px] text-gray-500">🔴 异常</div>
      </div>
      <div class="rounded-lg px-2 py-1.5 text-center" :class="'bg-gray-400/10'">
        <div class="text-[13px] font-bold text-gray-400 font-mono">{{ summary.idle }}</div>
        <div class="text-[8px] text-gray-500">⚪ 待上岗</div>
      </div>
    </div>

    <div class="flex-1 space-y-1.5 overflow-y-auto pr-1" style="max-height: 200px">
      <template v-if="agents.length === 0">
        <div class="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-4 text-center">
          <p class="text-[10px] text-gray-500">暂无 AI 员工实例</p>
        </div>
      </template>
      <div v-for="a in agents" :key="a.agentInstanceId" class="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 flex items-center gap-2">
        <span class="text-[10px]">{{ levelIcon(a.health.level) }}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-semibold text-white/80 truncate">{{ a.agentName || a.agentInstanceId.slice(0, 8) }}</span>
            <span class="text-[8px] text-gray-600 truncate">{{ a.orgName }}</span>
          </div>
          <div class="text-[8px] text-gray-500 truncate">{{ a.health.label }} · {{ a.tasks }} 次执行 · 成功率 {{ a.successRate ?? '—' }}%</div>
        </div>
        <span v-if="a.hasValueParam" class="text-[8px] px-1 py-0.5 rounded bg-cyan-400/10 text-cyan-400 shrink-0">📐 价值参数</span>
      </div>
    </div>

    <div class="mt-2 pt-2 border-t border-white/[0.05] shrink-0">
      <p class="text-[8px] text-gray-600 leading-relaxed">{{ summary?.note }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ data?: any }>()

const agents = computed(() => props.data?.agents || [])
const summary = computed(() => props.data?.summary || null)

function levelIcon(l: string) {
  return { green: '🟢', yellow: '🟡', red: '🔴', idle: '⚪' }[l] || '⚪'
}
</script>
