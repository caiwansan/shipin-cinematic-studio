<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 space-y-4 hover:border-blue-500/30 transition cursor-pointer" @click="$emit('select')">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl">
            {{ agentEmoji[agent.agentType] || '🤖' }}
          </div>
          <div
            :class="statusDotClass"
            class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0D1328]"
          />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-white">{{ agent.name }}</h3>
          <div class="text-xs text-gray-400">{{ agent.goal || agent.role }}</div>
        </div>
      </div>
      <button
        @click.stop="$emit('toggle')"
        :class="agent.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'"
        class="text-xs px-3 py-1 rounded-lg border border-current transition"
      >
        {{ agent.status === 'active' ? '暂停' : '启用' }}
      </button>
    </div>

    <!-- Runtime Identity -->
    <div v-if="agent.agentId" class="bg-[#060A18] rounded-lg px-3 py-2 space-y-1">
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-500">Agent ID</span>
        <span class="text-gray-300 font-mono text-[11px]">{{ agent.agentId }}</span>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-500">Namespace</span>
        <span class="text-gray-400 font-mono text-[11px]">{{ agent.namespace }}</span>
      </div>
    </div>

    <!-- Health Score -->
    <div v-if="agent.healthScore !== undefined" class="flex items-center gap-3">
      <div class="flex-1 bg-[#060A18] rounded-full h-2 overflow-hidden">
        <div
          :class="healthBarClass"
          class="h-2 rounded-full transition-all"
          :style="{ width: agent.healthScore + '%' }"
        />
      </div>
      <span class="text-xs font-medium" :class="healthTextClass">{{ agent.healthScore }}%</span>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="bg-[#060A18] rounded-lg p-2">
        <div class="text-sm font-semibold text-white">{{ agent.todayTasks ?? 0 }}</div>
        <div class="text-[10px] text-gray-500">今日任务</div>
      </div>
      <div class="bg-[#060A18] rounded-lg p-2">
        <div class="text-sm font-semibold text-green-400">{{ agent.totalTasks ?? 0 }}</div>
        <div class="text-[10px] text-gray-500">总计</div>
      </div>
      <div class="bg-[#060A18] rounded-lg p-2">
        <div class="text-sm font-semibold" :class="agent.totalErrors > 0 ? 'text-red-400' : 'text-green-400'">
          {{ agent.totalErrors ?? 0 }}
        </div>
        <div class="text-[10px] text-gray-500">失败</div>
      </div>
    </div>

    <!-- Model Info -->
    <div v-if="agent.modelName" class="flex items-center gap-2 text-xs text-gray-400">
      <span class="text-gray-500">🧮</span>
      <span>{{ agent.modelName }}</span>
      <span v-if="agent.requireOwnLLMKey" class="text-[10px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded">BYOK</span>
    </div>

    <!-- Last Activity -->
    <div v-if="agent.lastActiveAt" class="text-[11px] text-gray-600 text-right">
      最近活动: {{ formatTime(agent.lastActiveAt) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  agent: { type: Object, required: true }
})

defineEmits(['select', 'toggle'])

const agentEmoji = {
  growth_director: '🧠',
  market_analyst: '📊',
  content_manager: '✍',
  customer_ops: '🤝',
  sales_assistant: '💼'
}

const statusDotClass = computed(() => {
  const s = props.agent.runtimeStatus || props.agent.status
  if (s === 'active' || s === 'running') return 'bg-green-400'
  if (s === 'paused') return 'bg-yellow-400'
  return 'bg-gray-500'
})

const healthBarClass = computed(() => {
  const score = props.agent.healthScore || 0
  if (score >= 90) return 'bg-gradient-to-r from-green-500 to-emerald-400'
  if (score >= 70) return 'bg-gradient-to-r from-yellow-500 to-orange-400'
  return 'bg-gradient-to-r from-red-500 to-pink-400'
})

const healthTextClass = computed(() => {
  const score = props.agent.healthScore || 0
  if (score >= 90) return 'text-green-400'
  if (score >= 70) return 'text-yellow-400'
  return 'text-red-400'
})

function formatTime(date) {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return Math.floor(diffMs / 60000) + ' 分钟前'
  if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + ' 小时前'
  return d.toLocaleDateString('zh-CN')
}
</script>
