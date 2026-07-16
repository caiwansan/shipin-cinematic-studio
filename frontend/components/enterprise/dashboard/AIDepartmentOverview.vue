<template>
  <div class="ai-department-overview">
    <!-- Top: KPI Row -->
    <div class="ai-kpi-row">
      <div class="ai-kpi-card">
        <span class="ai-kpi-value text-cyan">{{ data.totalAgents }}</span>
        <span class="ai-kpi-sub">运行中 {{ data.activeAgents }}</span>
        <span class="ai-kpi-label">AI 员工</span>
      </div>
      <div class="ai-kpi-card">
        <span class="ai-kpi-value text-green">{{ data.todayTasks }}</span>
        <span class="ai-kpi-label">今日完成任务</span>
      </div>
      <div class="ai-kpi-card">
        <span class="ai-kpi-value text-blue">{{ data.signalsDiscovered + data.suggestionsGenerated }}</span>
        <span class="ai-kpi-sub">信号 {{ data.signalsDiscovered }} · 建议 {{ data.suggestionsGenerated }}</span>
        <span class="ai-kpi-label">AI 产出</span>
      </div>
      <div class="ai-kpi-card">
        <span class="ai-kpi-value text-yellow">{{ data.tasksExecuted }}</span>
        <span class="ai-kpi-label">自动执行</span>
      </div>
    </div>

    <!-- Middle: Grid -->
    <div class="ai-grid-row">
      <!-- Left: Team Status -->
      <div class="ai-grid-left">
        <AIAgentStatusGrid :agents="data.agents" />
      </div>
      <!-- Right: Health + Activity -->
      <div class="ai-grid-right">
        <AITeamHealthCard :data="data.health" />
        <AITeamActivityFeed :activities="data.recentActivity" />
      </div>
    </div>
  </div>
</template>

<script setup>
import AIAgentStatusGrid from './AIAgentStatusGrid.vue'
import AITeamHealthCard from './AITeamHealthCard.vue'
import AITeamActivityFeed from './AITeamActivityFeed.vue'

defineProps({
  data: {
    type: Object,
    default: () => ({
      totalAgents: 0,
      activeAgents: 0,
      todayTasks: 0,
      successRate: 0,
      signalsDiscovered: 0,
      suggestionsGenerated: 0,
      tasksExecuted: 0,
      agents: [],
      health: { score: 100, status: '良好', taskSuccessRate: 100, errorCount: 0 },
      recentActivity: []
    })
  }
})
</script>

<style scoped>
.ai-department-overview {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* KPI Row */
.ai-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.ai-kpi-card {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}
.ai-kpi-value {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.ai-kpi-value.text-cyan { color: #22d3ee; }
.ai-kpi-value.text-green { color: #22c55e; }
.ai-kpi-value.text-blue { color: #60a5fa; }
.ai-kpi-value.text-yellow { color: #facc15; }
.ai-kpi-sub {
  font-size: 10px;
  color: #5A6A8A;
}
.ai-kpi-label {
  font-size: 12px;
  color: #8899B8;
  margin-top: 4px;
}

/* Grid Row */
.ai-grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.ai-grid-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ai-grid-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1024px) {
  .ai-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .ai-grid-row {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .ai-kpi-row {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .ai-kpi-value {
    font-size: 22px;
  }
}
</style>
