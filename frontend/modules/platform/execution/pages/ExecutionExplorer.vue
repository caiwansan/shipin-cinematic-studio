<template>
  <div class="execution-explorer">
    <div class="header">
      <h1>Execution Explorer</h1>
      <div class="header-actions">
        <button @click="refresh" :disabled="loading" class="btn-refresh">
          {{ loading ? 'Loading...' : '🔄 Refresh' }}
        </button>
      </div>
    </div>

    <!-- Dashboard -->
    <div class="dashboard-cards">
      <div class="card">
        <span class="card-label">Total Executions</span>
        <span class="card-value">{{ dashboard?.globalMetrics?.totalExecutions || 0 }}</span>
      </div>
      <div class="card success">
        <span class="card-label">Successful</span>
        <span class="card-value">{{ dashboard?.globalMetrics?.successfulExecutions || 0 }}</span>
      </div>
      <div class="card failed">
        <span class="card-label">Failed</span>
        <span class="card-value">{{ dashboard?.globalMetrics?.failedExecutions || 0 }}</span>
      </div>
      <div class="card">
        <span class="card-label">Total Plans</span>
        <span class="card-value">{{ dashboard?.totalPlans || 0 }}</span>
      </div>
      <div class="card">
        <span class="card-label">Avg Duration</span>
        <span class="card-value">{{ formatDuration(dashboard?.globalMetrics?.averageDurationMs || 0) }}</span>
      </div>
      <div class="card">
        <span class="card-label">Total Retries</span>
        <span class="card-value">{{ dashboard?.globalMetrics?.totalRetries || 0 }}</span>
      </div>
    </div>

    <!-- DAG Visualization -->
    <div class="section">
      <h2>Current Execution</h2>
      <div v-if="store.currentPlan" class="dag-view">
        <div class="plan-info">
          <span class="plan-id">Plan: {{ store.currentPlan.id }}</span>
          <span class="plan-capability">Capability: {{ store.currentPlan.capabilityId }}</span>
          <span class="plan-status" :class="store.currentResult?.status">
            {{ store.isExecuting ? 'Running...' : (store.currentResult?.status || 'Ready') }}
          </span>
        </div>

        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: store.progressPercent + '%' }"></div>
          <span class="progress-text">{{ store.completedSteps }}/{{ store.totalSteps }} steps</span>
        </div>

        <!-- Step Timeline -->
        <div class="step-timeline">
          <div
            v-for="step in store.currentPlan.steps"
            :key="step.id"
            class="step-node"
            :class="getStepClass(step.id)"
          >
            <div class="step-header">
              <span class="step-type">{{ step.type }}</span>
              <span class="step-name">{{ step.name }}</span>
            </div>
            <div class="step-meta">
              <span v-if="getStepResult(step.id)?.durationMs" class="step-duration">
                {{ formatDuration(getStepResult(step.id)!.durationMs!) }}
              </span>
              <span v-if="getStepResult(step.id)?.retryCount" class="step-retry">
                🔄 {{ getStepResult(step.id)!.retryCount }}
              </span>
            </div>
            <div v-if="getStepResult(step.id)?.error" class="step-error">
              {{ getStepResult(step.id)!.error!.message }}
            </div>
            <div class="step-deps">
              <span v-for="dep in step.dependencies" :key="dep" class="dep-badge">
                ← {{ getStepName(dep) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>No active execution. Execute a plan from the Plans tab.</p>
      </div>
    </div>

    <!-- Recent History -->
    <div class="section">
      <h2>Recent Executions</h2>
      <div v-if="store.history.length > 0" class="history-table">
        <div class="history-header">
          <span>Plan ID</span>
          <span>Capability</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Steps</span>
          <span>Time</span>
        </div>
        <div
          v-for="record in store.history.slice(0, 20)"
          :key="record.id"
          class="history-row"
          :class="record.status"
        >
          <span class="cell-id">{{ record.planId.slice(0, 24) }}...</span>
          <span>{{ record.capabilityId }}</span>
          <span class="status-badge" :class="record.status">{{ record.status }}</span>
          <span>{{ formatDuration(record.durationMs || 0) }}</span>
          <span>{{ record.completedSteps }}/{{ record.totalSteps }}</span>
          <span>{{ formatTime(record.startedAt) }}</span>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>No execution history yet.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useExecutionStore } from '../store/useExecutionStore.js'
import type { StepResult } from '../types/index.js'

const store = useExecutionStore()
const loading = ref(false)

const dashboard = computed(() => store.dashboard)

onMounted(async () => {
  await Promise.all([
    store.fetchDashboard(),
    store.fetchHistory(),
    store.fetchPlans(),
  ])
})

async function refresh() {
  loading.value = true
  await Promise.all([
    store.fetchDashboard(),
    store.fetchHistory(),
    store.fetchPlans(),
  ])
  loading.value = false
}

function getStepResult(stepId: string): StepResult | undefined {
  return store.currentResult?.stepResults.find(r => r.stepId === stepId)
}

function getStepClass(stepId: string): string {
  const result = getStepResult(stepId)
  if (!result) return 'pending'
  return result.status
}

function getStepName(stepId: string): string {
  return store.currentPlan?.steps.find(s => s.id === stepId)?.name || stepId
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString()
  } catch {
    return iso
  }
}
</script>

<style scoped>
.execution-explorer {
  padding: 24px;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.btn-refresh {
  background: #1a73e8;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.card {
  background: #1a1d2e;
  border: 1px solid #2a2d3e;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card.success { border-color: #2e7d32; }
.card.failed { border-color: #c62828; }

.card-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
}

.section {
  margin-bottom: 24px;
}

.section h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #ccc;
}

.dag-view {
  background: #1a1d2e;
  border: 1px solid #2a2d3e;
  border-radius: 8px;
  padding: 16px;
}

.plan-info {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
}
.plan-id { color: #64b5f6; }
.plan-capability { color: #aaa; }
.plan-status { font-weight: 600; }
.plan-status.completed { color: #4caf50; }
.plan-status.failed { color: #f44336; }
.plan-status.cancelled { color: #ff9800; }

.progress-bar {
  height: 8px;
  background: #2a2d3e;
  border-radius: 4px;
  position: relative;
  margin-bottom: 16px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1a73e8, #4fc3f7);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-text {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 11px;
  color: #888;
}

.step-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-node {
  background: #0d1117;
  border: 1px solid #2a2d3e;
  border-radius: 6px;
  padding: 10px 12px;
  transition: all 0.2s;
}
.step-node.completed {
  border-color: #2e7d32;
  background: #0a1f0a;
}
.step-node.failed {
  border-color: #c62828;
  background: #1f0a0a;
}
.step-node.running {
  border-color: #1a73e8;
  background: #0a1628;
}
.step-node.skipped {
  opacity: 0.5;
}
.step-node.cancelled {
  border-color: #e65100;
  background: #1a0e00;
}

.step-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.step-type {
  font-size: 10px;
  background: #1a73e8;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.step-name {
  font-size: 13px;
  font-weight: 500;
}

.step-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #888;
}

.step-retry {
  color: #ff9800;
}

.step-error {
  margin-top: 4px;
  font-size: 11px;
  color: #f44336;
}

.step-deps {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.dep-badge {
  font-size: 10px;
  background: #2a2d3e;
  padding: 1px 4px;
  border-radius: 2px;
  color: #888;
}

.empty-state {
  background: #1a1d2e;
  border: 1px dashed #2a2d3e;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  color: #666;
}

.history-table {
  background: #1a1d2e;
  border: 1px solid #2a2d3e;
  border-radius: 8px;
  overflow: hidden;
}

.history-header {
  display: grid;
  grid-template-columns: 1.5fr 1fr 80px 80px 80px 80px;
  gap: 8px;
  padding: 10px 12px;
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  background: #0d1117;
  border-bottom: 1px solid #2a2d3e;
}

.history-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 80px 80px 80px 80px;
  gap: 8px;
  padding: 10px 12px;
  font-size: 12px;
  border-bottom: 1px solid #1a1d2e;
}
.history-row:last-child { border-bottom: none; }
.history-row.completed { background: #0a1f0a; }
.history-row.failed { background: #1f0a0a; }

.cell-id {
  font-family: monospace;
  font-size: 11px;
  color: #64b5f6;
}

.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}
.status-badge.completed { background: #1b5e20; color: #81c784; }
.status-badge.failed { background: #b71c1c; color: #ef9a9a; }
.status-badge.cancelled { background: #e65100; color: #ffcc80; }
.status-badge.running { background: #1a237e; color: #90caf9; }
</style>
