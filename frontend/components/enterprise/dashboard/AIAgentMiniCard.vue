<template>
  <div class="ai-agent-mini-card" :class="`status-${agent.status}`">
    <div class="mini-card-left">
      <div class="agent-emoji">{{ emoji }}</div>
      <div class="agent-meta">
        <span class="agent-name">{{ agent.name }}</span>
        <span class="agent-model">{{ agent.model }}</span>
      </div>
    </div>
    <div class="mini-card-right">
      <div class="mini-stat">
        <span class="stat-value">{{ agent.tasks }}</span>
        <span class="stat-label">今日</span>
      </div>
      <div class="mini-stat">
        <span class="stat-value" :class="agent.successRate >= 90 ? 'text-green' : 'text-yellow'">
          {{ agent.successRate }}%
        </span>
        <span class="stat-label">成功率</span>
      </div>
      <div class="status-indicator" :class="`dot-${agent.status}`" :title="statusTitle" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  agent: { type: Object, required: true }
})

const emojiMap = {
  sales_assistant: '💼',
  customer_ops: '🤝',
  content_manager: '✍',
  market_analyst: '📊',
  custom: '🤖'
}

const emoji = computed(() => emojiMap[props.agent.agentType] || '🤖')

const statusTitle = computed(() => {
  const s = props.agent.status
  if (s === 'running') return '工作中'
  if (s === 'paused') return '已暂停'
  if (s === 'error') return '异常'
  return '空闲'
})
</script>

<style scoped>
.ai-agent-mini-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 10px;
  transition: border-color 0.2s;
}
.ai-agent-mini-card:hover {
  border-color: #2A3A6A;
}
.mini-card-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.agent-emoji {
  font-size: 22px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111833;
  border-radius: 8px;
}
.agent-meta {
  display: flex;
  flex-direction: column;
}
.agent-name {
  font-size: 13px;
  font-weight: 600;
  color: white;
}
.agent-model {
  font-size: 10px;
  color: #5A6A8A;
}
.mini-card-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.mini-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: white;
}
.stat-value.text-green { color: #22c55e; }
.stat-value.text-yellow { color: #eab308; }
.stat-label {
  font-size: 9px;
  color: #5A6A8A;
}
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-running { background: #22c55e; box-shadow: 0 0 6px #22c55e66; }
.dot-paused { background: #eab308; }
.dot-error { background: #ef4444; box-shadow: 0 0 6px #ef444466; }
.dot-idle { background: #4b5563; }
</style>
