<template>
  <div class="agent-detail-panel space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
    <!-- Header -->
    <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl">
          {{ agentEmoji[detail?.employee?.agentType] || '🤖' }}
        </div>
        <div class="flex-1">
          <h2 class="text-base font-bold text-white">{{ detail?.employee?.name }}</h2>
          <p class="text-xs text-gray-400">{{ detail?.employee?.goal }}</p>
        </div>
      </div>

      <!-- Identity badges -->
      <div class="flex flex-wrap gap-2 text-[10px]">
        <span class="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded">
          {{ detail?.employee?.agentType }}
        </span>
        <span v-if="detail?.employee?.capabilities?.length" class="bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded">
          {{ detail.employee.capabilities.length }} 项能力
        </span>
        <span v-if="detail?.instance" class="bg-green-500/10 text-green-300 px-2 py-0.5 rounded">
          {{ detail.instance.runtime }}
        </span>
      </div>
    </div>

    <!-- Runtime Card -->
    <AgentRuntimeCard :runtime="detail?.instance" />

    <!-- Health Card -->
    <AgentHealthCard
      :score="healthScore"
      :total-tasks="detail?.instance?.totalTasks || 0"
      :total-errors="detail?.instance?.totalErrors || 0"
      :tasks="detail?.recentTasks || []"
    />

    <!-- Model Card -->
    <AgentModelCard
      :bindings="detail?.modelBindings || []"
      :active-binding="activeModelBinding"
    />

    <!-- Channel Card (Phase 4) -->
    <AgentChannelCard
      :bindings="detail?.channelBindings || []"
      :available-channels="[]"
      @add="handleAddChannel"
      @remove="handleRemoveChannel"
    />

    <!-- Timeline -->
    <AgentTimeline :tasks="detail?.recentTasks || []" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AgentRuntimeCard from './AgentRuntimeCard.vue'
import AgentHealthCard from './AgentHealthCard.vue'
import AgentModelCard from './AgentModelCard.vue'
import AgentChannelCard from './AgentChannelCard.vue'
import AgentTimeline from './AgentTimeline.vue'

const props = defineProps({
  detail: { type: Object, default: null }
})

const emit = defineEmits(['addChannel', 'removeChannel'])

const agentEmoji = {
  growth_director: '🧠',
  market_analyst: '📊',
  content_manager: '✍',
  customer_ops: '🤝',
  sales_assistant: '💼'
}

const healthScore = computed(() => {
  const tasks = props.detail?.instance?.totalTasks || 0
  const errors = props.detail?.instance?.totalErrors || 0
  if (tasks === 0) return 100
  return Math.round((1 - errors / tasks) * 100)
})

const activeModelBinding = computed(() => {
  const bindings = props.detail?.modelBindings || []
  return bindings.find(b => b.enabled) || bindings[0] || null
})

function handleAddChannel(payload) {
  emit('addChannel', payload)
}

function handleRemoveChannel(bindingId) {
  emit('removeChannel', bindingId)
}
</script>

<style scoped>
.agent-detail-panel::-webkit-scrollbar {
  width: 4px;
}
.agent-detail-panel::-webkit-scrollbar-track {
  background: transparent;
}
.agent-detail-panel::-webkit-scrollbar-thumb {
  background: #1A2240;
  border-radius: 2px;
}
</style>
