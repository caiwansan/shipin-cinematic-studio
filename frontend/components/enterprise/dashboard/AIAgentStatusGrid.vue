<template>
  <div class="ai-agent-status-grid">
    <div class="grid-header">
      <h3 class="grid-title">我的 AI 团队</h3>
      <span class="grid-count">{{ agents.length }} 名成员</span>
    </div>
    <div v-if="agents.length > 0" class="agent-grid">
      <AIAgentMiniCard v-for="agent in agents" :key="agent.name" :agent="agent" />
    </div>
    <div v-else class="empty-team">
      <span class="empty-icon">🤖</span>
      <p>还没有 AI 员工在工作</p>
      <p class="empty-sub">在"员工"模块中添加 AI 员工后，这里将显示实时状态</p>
    </div>
  </div>
</template>

<script setup>
import AIAgentMiniCard from './AIAgentMiniCard.vue'

defineProps({
  agents: { type: Array, default: () => [] }
})
</script>

<style scoped>
.ai-agent-status-grid {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}
.grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.grid-title {
  font-size: 16px;
  font-weight: 700;
  color: white;
}
.grid-count {
  font-size: 11px;
  color: #5A6A8A;
  background: #111833;
  padding: 3px 10px;
  border-radius: 20px;
}
.agent-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-team {
  text-align: center;
  padding: 28px 0;
  color: #5A6A8A;
}
.empty-icon {
  font-size: 28px;
  display: block;
  margin-bottom: 8px;
}
.empty-team p {
  font-size: 13px;
  margin: 0;
}
.empty-sub {
  font-size: 11px !important;
  margin-top: 4px !important;
}
</style>
