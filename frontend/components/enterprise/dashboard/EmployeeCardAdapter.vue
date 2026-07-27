<!-- EmployeeCardAdapter.vue — bridges Dashboard status → EmployeeCard props -->
<!-- ER-02: Added click-to-profile navigation -->
<template>
  <div @click="navigateToProfile" class="employee-card-link">
    <EmployeeCard
      v-if="adaptedEmployee"
      :employee="adaptedEmployee"
      :today-task-list="todayTaskList"
      @toggle="$emit('toggle', $event)"
      @update-note="$emit('update-note', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EmployeeCard from '~/components/enterprise/EmployeeCard.vue'

/**
 * EmployeeCardAdapter — Bridge between lightweight Dashboard status and rich EmployeeCard props
 *
 * Maps:
 *   Dashboard API agentStatus → EmployeeCard employee object
 *   OutcomeSummary agents → kpiMetrics for contribution grid
 *
 * No new API. No new DB. Pure data shaping on the client.
 */

interface DashboardAgent {
  agentId: string
  agentName: string
  agentType: string
  status: string
  todayTasks: number
  lastActiveAt: string | null
}

interface OutcomeAgent {
  agentId: string
  agentName: string
  actionsCompleted: number
  outcomesGenerated: number
  impactValue: string
  topOutcome: string | null
}

interface TodayTask {
  action: string
  agentName: string
  time: string
  status: string
}

const props = defineProps<{
  agent: DashboardAgent
  outcomeAgents?: OutcomeAgent[]
  todayTaskList?: TodayTask[]
}>()

defineEmits<{
  (e: 'toggle'): void
  (e: 'update-note', note: string): void
}>()

const adaptedEmployee = computed(() => {
  if (!props.agent) return null

  const outcomeAgent = props.outcomeAgents?.find(
    (a) => a.agentId === props.agent.agentId
  )

  const status = props.agent.status === 'running' || props.agent.status === 'active'
    ? 'active'
    : 'idle'

  const kpiMetrics: Record<string, number> = {}
  if (outcomeAgent) {
    if (outcomeAgent.actionsCompleted > 0) kpiMetrics.opportunities_found = outcomeAgent.actionsCompleted
    if (outcomeAgent.outcomesGenerated > 0) kpiMetrics.content_created = outcomeAgent.outcomesGenerated
  }

  return {
    name: props.agent.agentName || 'AI员工',
    agentType: props.agent.agentType || 'custom',
    role: props.agent.agentType || 'custom',
    status,
    todayCompleted: props.agent.todayTasks ?? 0,
    dailyTarget: 10,
    goal: outcomeAgent?.topOutcome || `执行 ${props.agent.agentType} 相关任务`,
    kpiMetrics: JSON.stringify(kpiMetrics),
    capabilities: JSON.stringify([]),
    knowledgeScope: JSON.stringify([]),
    managerNote: '',
    successRate: 95,
  }
})

// ER-02: Navigate to Employee Profile page on click
function navigateToProfile() {
  window.location.href = `/enterprise/agent/${props.agent.agentId}`
}
</script>

<style scoped>
.employee-card-link {
  cursor: pointer;
  transition: transform 0.15s;
}

.employee-card-link:hover {
  transform: scale(1.02);
}

.employee-card-link :deep(.employee-card:hover) {
  transform: none;
}
</style>
