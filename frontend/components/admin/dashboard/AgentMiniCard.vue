<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">🤖 Agent 运营</h3>
      <button @click="$emit('detail')" class="text-[9px] text-blue-400/80 hover:text-blue-300 cursor-pointer flex items-center gap-0.5 transition-colors">
        查看详情 <span class="text-[8px]">›</span>
      </button>
    </div>
    <div class="flex items-center gap-2 mb-2 shrink-0">
      <div class="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-1 text-center">
        <span class="text-base font-bold text-white/90 font-mono">{{ agents.length }}</span>
        <span class="text-[8px] text-gray-600 ml-1">AI 员工</span>
      </div>
      <div class="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex-1 text-center">
        <span class="text-base font-bold text-indigo-400 font-mono">{{ activeEnterprises?.count ?? 0 }}</span>
        <span class="text-[8px] text-gray-600 ml-1">服务企业</span>
      </div>
    </div>
    <div class="space-y-1.5 flex-1">
      <div v-for="(a, i) in agents.slice(0, 3)" :key="a.id"
        class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <span class="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-mono shrink-0"
          :style="{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }">{{ i + 1 }}</span>
        <span class="text-[10px] text-white/70 font-mono truncate flex-1">{{ shortId(a.agentId) }}</span>
        <span class="text-[9px] text-emerald-400/80 shrink-0">{{ a.successRate }}%</span>
        <span class="text-[8px] text-gray-500 font-mono shrink-0">{{ a.totalTasks }}次</span>
      </div>
      <div v-if="!agents.length" class="text-[9px] text-gray-600 text-center py-3">暂无 Agent 实例</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ agents: any[]; activeEnterprises?: any }>()
defineEmits<{ (e: 'detail'): void }>()

const shortId = (id: string) => (id || '').replace('agent_', '').slice(0, 14)
</script>
