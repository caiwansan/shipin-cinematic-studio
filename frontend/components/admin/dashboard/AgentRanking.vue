<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🤖 Agent 运营中心</h3>
      <span class="text-[9px] text-gray-600">Agent Instance</span>
    </div>

    <!-- Agent 活跃企业 -->
    <div v-if="activeEnterprises.count > 0" class="mb-3 px-3 py-2 rounded-lg bg-indigo-500/[0.06] border border-indigo-500/20 text-[9px] text-indigo-300/80">
      🏢 服务企业 {{ activeEnterprises.count }} 家：{{ activeEnterprises.names.join(' · ') }}
    </div>

    <div v-if="agents.length === 0" class="text-center py-10 text-[10px] text-gray-600">暂无 AI 员工实例</div>

    <div v-else class="space-y-2">
      <div v-for="(a, i) in agents.slice(0, 6)" :key="a.id"
        class="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] transition-all">
        <div class="flex items-center gap-2">
          <span class="text-sm">{{ ['🥇', '🥈', '🥉'][i] || '▪️' }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-white/80 font-medium truncate">{{ shortId(a.agentId) }}</span>
              <span class="text-[8px] px-1.5 py-0.5 rounded-full border" :class="statusClass(a.status)">{{ statusText(a.status) }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span v-if="a.orgName !== '—'" class="text-[8px] text-gray-600 truncate">{{ a.orgName }}</span>
              <span v-if="a.orgPlan !== '—'" class="text-[8px] px-1 py-px rounded bg-white/[0.04] text-gray-500">{{ a.orgPlan }}</span>
            </div>
            <div class="mt-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500" :style="{ width: rateWidth(a.successRate) }"></div>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[11px] text-white/70 font-mono">{{ a.totalTasks }} 次</div>
            <div class="text-[9px] text-emerald-400/80">{{ a.successRate }}% 成功</div>
            <div class="text-[8px] text-amber-400/60 font-mono">¥{{ a.cost.toFixed(2) }}</div>
            <div v-if="a.servedOrganizations" class="text-[8px] text-gray-500">🏢 {{ a.servedOrganizations }} 企业</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  agents: any[]
  activeEnterprises?: { count: number; names: string[] }
}>()

const activeEnterprises = computed(() => props.activeEnterprises || { count: 0, names: [] })

const shortId = (id: string) => (id || '').length > 28 ? id.slice(0, 28) + '…' : id || '—'
const statusClass = (s: string) => ({
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  stopped: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}[s] || 'bg-blue-500/10 text-blue-400 border-blue-500/20')
const statusText = (s: string) => ({ active: '活跃', paused: '暂停', stopped: '停止' }[s] || s || '—')
const rateWidth = (r: number) => Math.max(2, Math.min(100, r || 0)) + '%'
</script>
