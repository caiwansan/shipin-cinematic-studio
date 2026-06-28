<template>
  <div class="workflow-monitor">
    <!-- Header -->
    <header class="monitor-header">
      <h2>工作流监控</h2>
      <div class="monitor-controls">
        <select v-model="selectedInstanceId" @change="loadInstance">
          <option value="">选择实例...</option>
          <option v-for="inst in runningInstances" :key="inst.id" :value="inst.id">
            {{ inst.id?.slice(0, 8) }} — {{ inst.status }}
          </option>
        </select>
        <div class="monitor-status" v-if="instance">
          <span class="status-dot" :class="instance.status"></span>
          <span>{{ instance.status }}</span>
        </div>
      </div>
    </header>

    <div class="monitor-body">
      <!-- Instance Info -->
      <section class="info-section" v-if="instance">
        <div class="info-grid">
          <div class="info-item">
            <label>实例 ID</label>
            <span>{{ instance.id }}</span>
          </div>
          <div class="info-item">
            <label>工作流</label>
            <span>{{ instance.workflowId }}</span>
          </div>
          <div class="info-item">
            <label>状态</label>
            <span class="status-badge" :class="instance.status">{{ instance.status }}</span>
          </div>
          <div class="info-item">
            <label>耗时</label>
            <span>{{ duration }}</span>
          </div>
          <div class="info-item">
            <label>成本</label>
            <span>{{ instance.cost ? `$${instance.cost.toFixed(4)}` : '-' }}</span>
          </div>
          <div class="info-item" v-if="instance.error">
            <label>错误</label>
            <span class="error-text">{{ instance.error }}</span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="btn btn-success" @click="execute" :disabled="!canExecute">▶ 执行</button>
          <button class="btn btn-warning" @click="pause" :disabled="!canPause">⏸ 暂停</button>
          <button class="btn btn-info" @click="resume" :disabled="!canResume">▶ 恢复</button>
          <button class="btn btn-danger" @click="cancel" :disabled="!canCancel">⏹ 取消</button>
          <button class="btn btn-secondary" @click="replayFull">↺ 重放</button>
        </div>
      </section>

      <!-- DAG Visualization -->
      <section class="dag-section" v-if="nodes.length > 0">
        <h3>执行图</h3>
        <svg class="dag-svg" :width="dagWidth" :height="dagHeight">
          <!-- Edges -->
          <g v-for="edge in edges" :key="edge.id">
            <path
              :d="getEdgePath(edge)"
              :class="['dag-edge', getEdgeStatusClass(edge)]"
            />
          </g>

          <!-- Nodes -->
          <g v-for="node in nodes" :key="node.id" :transform="`translate(${getNodeX(node)}, ${getNodeY(node)})`">
            <rect
              :width="nodeWidth"
              :height="nodeHeight"
              rx="8"
              :class="['dag-node', `node-${node.status}`]"
            />
            <text x="60" y="20" text-anchor="middle" class="node-type">{{ node.type }}</text>
            <text x="60" y="40" text-anchor="middle" class="node-name">{{ node.name }}</text>
            <text x="60" y="55" text-anchor="middle" class="node-status">{{ node.status }}</text>
            <circle cx="120" cy="55" r="8" :class="['node-indicator', `indicator-${node.status}`]" v-if="node.status === 'running'" />
          </g>
        </svg>
      </section>

      <!-- Events Timeline -->
      <section class="events-section" v-if="events.length > 0">
        <h3>事件流 <span class="event-count">({{ events.length }})</span></h3>
        <div class="events-list">
          <div
            v-for="event in events"
            :key="event.id"
            :class="['event-item', `event-${event.type}`]"
          >
            <span class="event-time">{{ formatTime(event.timestamp) }}</span>
            <span class="event-type">{{ event.type }}</span>
            <span class="event-node" v-if="event.nodeId">[{{ event.nodeId }}]</span>
            <span class="event-data" v-if="event.data">{{ truncate(JSON.stringify(event.data), 50) }}</span>
          </div>
        </div>
      </section>

      <!-- Stats Section -->
      <section class="stats-section" v-if="nodes.length > 0">
        <h3>执行统计</h3>
        <div class="stats-grid">
          <div class="stat-card completed">
            <span class="stat-value">{{ completedCount }}</span>
            <span class="stat-label">已完成</span>
          </div>
          <div class="stat-card running">
            <span class="stat-value">{{ runningCount }}</span>
            <span class="stat-label">运行中</span>
          </div>
          <div class="stat-card failed">
            <span class="stat-value">{{ failedCount }}</span>
            <span class="stat-label">失败</span>
          </div>
          <div class="stat-card pending">
            <span class="stat-value">{{ pendingCount }}</span>
            <span class="stat-label">等待中</span>
          </div>
        </div>
      </section>

      <!-- Empty state -->
      <div v-if="!instance" class="empty-state">
        <p>选择或创建一个工作流实例开始监控</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { WorkflowInstance, WorkflowNode, WorkflowEdge, WorkflowEvent } from '../types/index.js'
import { InstanceStatus } from '../types/index.js'
import { workflowService } from '../services/workflow.service.js'
import { workflowClientRuntime } from '../runtime/workflow.runtime.js'

// ─── State ───

const instances = ref<WorkflowInstance[]>([])
const instance = ref<WorkflowInstance | null>(null)
const nodes = ref<WorkflowNode[]>([])
const edges = ref<WorkflowEdge[]>([])
const events = ref<WorkflowEvent[]>([])
const selectedInstanceId = ref('')
const pollingTimer = ref<ReturnType<typeof setInterval> | null>(null)

// ─── Computed ───

const runningInstances = computed(() =>
  instances.value.filter(i => ['running', 'pending', 'paused'].includes(i.status || ''))
)

const completedCount = computed(() => nodes.value.filter(n => n.status === 'completed').length)
const runningCount = computed(() => nodes.value.filter(n => n.status === 'running').length)
const failedCount = computed(() => nodes.value.filter(n => n.status === 'failed').length)
const pendingCount = computed(() => nodes.value.filter(n => n.status === 'pending').length)

const duration = computed(() => {
  if (!instance.value) return '-'
  if (instance.value.finishedAt && instance.value.startedAt) {
    const diff = new Date(instance.value.finishedAt).getTime() - new Date(instance.value.startedAt).getTime()
    return `${(diff / 1000).toFixed(1)}s`
  }
  if (instance.value.startedAt) {
    const diff = Date.now() - new Date(instance.value.startedAt).getTime()
    return `${(diff / 1000).toFixed(1)}s (运行中)`
  }
  return '-'
})

const canExecute = computed(() => instance.value?.status === 'pending')
const canPause = computed(() => instance.value?.status === 'running')
const canResume = computed(() => instance.value?.status === 'paused')
const canCancel = computed(() => ['running', 'paused'].includes(instance.value?.status || ''))

const dagWidth = 800
const dagHeight = 500
const nodeWidth = 120
const nodeHeight = 70

// ─── Methods ───

function getNodeX(node: WorkflowNode): number {
  const index = nodes.value.findIndex(n => n.nodeId === node.nodeId)
  const cols = Math.floor(dagWidth / (nodeWidth + 40))
  return (index % cols) * (nodeWidth + 40) + 20
}

function getNodeY(node: WorkflowNode): number {
  const index = nodes.value.findIndex(n => n.nodeId === node.nodeId)
  const cols = Math.floor(dagWidth / (nodeWidth + 40))
  return Math.floor(index / cols) * (nodeHeight + 40) + 20
}

function getEdgePath(edge: WorkflowEdge): string {
  const sourceNode = nodes.value.find(n => n.nodeId === edge.sourceNodeId)
  const targetNode = nodes.value.find(n => n.nodeId === edge.targetNodeId)
  if (!sourceNode || !targetNode) return ''

  const x1 = getNodeX(sourceNode) + nodeWidth
  const y1 = getNodeY(sourceNode) + nodeHeight / 2
  const x2 = getNodeX(targetNode)
  const y2 = getNodeY(targetNode) + nodeHeight / 2

  const dx = Math.abs(x2 - x1) * 0.4
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

function getEdgeStatusClass(edge: WorkflowEdge): string {
  const sourceNode = nodes.value.find(n => n.nodeId === edge.sourceNodeId)
  if (sourceNode?.status === 'completed') return 'edge-completed'
  if (sourceNode?.status === 'running') return 'edge-active'
  if (sourceNode?.status === 'failed') return 'edge-failed'
  return 'edge-pending'
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleTimeString()
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str
}

// ─── Instance Actions ───

async function loadInstance() {
  if (!selectedInstanceId.value) {
    instance.value = null
    nodes.value = []
    edges.value = []
    events.value = []
    stopPolling()
    return
  }

  await fetchDetail()
  startPolling()
}

async function fetchDetail() {
  if (!selectedInstanceId.value) return
  try {
    const detail = await workflowService.describeInstance(selectedInstanceId.value)
    instance.value = detail.instance
    nodes.value = detail.nodes || []
    edges.value = detail.edges || []
    events.value = detail.events || []
  } catch (err: any) {
    console.error('Failed to fetch detail:', err)
  }
}

async function execute() {
  if (!instance.value?.id) return
  await workflowService.execute(instance.value.id)
  await fetchDetail()
  startPolling()
}

async function pause() {
  if (!instance.value?.id) return
  await workflowService.pause(instance.value.id)
  await fetchDetail()
  stopPolling()
}

async function resume() {
  if (!instance.value?.id) return
  await workflowService.resume(instance.value.id)
  await fetchDetail()
  startPolling()
}

async function cancel() {
  if (!instance.value?.id) return
  async function replayFull() {
    if (!instance.value?.id) return
    await workflowService.replay(instance.value.id)
    await fetchDetail()
    startPolling()
  }
}

function startPolling() {
  stopPolling()
  pollingTimer.value = setInterval(fetchDetail, 3000)
}

function stopPolling() {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

// ─── Lifecycle ───

onMounted(async () => {
  try {
    instances.value = await workflowService.listInstances()
  } catch {}
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.workflow-monitor {
  padding: 20px;
  color: #e0e0e0;
  max-width: 1200px;
  margin: 0 auto;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.monitor-header h2 {
  margin: 0;
  font-size: 20px;
}

.monitor-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.monitor-controls select {
  padding: 6px 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1a1a2e;
  color: #e0e0e0;
}

.monitor-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.running { background: #4CAF50; animation: pulse 1.5s infinite; }
.status-dot.pending { background: #FFC107; }
.status-dot.paused { background: #FF9800; }
.status-dot.completed { background: #4CAF50; }
.status-dot.failed { background: #F44336; }
.status-dot.cancelled { background: #666; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ─── Info Section ─── */

.info-section {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.info-item label {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
}

.info-item span {
  font-size: 14px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.running { background: rgba(76,175,80,0.2); color: #4CAF50; }
.status-badge.pending { background: rgba(255,193,7,0.2); color: #FFC107; }
.status-badge.paused { background: rgba(255,152,0,0.2); color: #FF9800; }
.status-badge.completed { background: rgba(76,175,80,0.2); color: #4CAF50; }
.status-badge.failed { background: rgba(244,67,54,0.2); color: #F44336; }

.error-text {
  color: #F44336;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ─── DAG Section ─── */

.dag-section {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.dag-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.dag-svg {
  width: 100%;
  background: #0d1117;
  border-radius: 8px;
}

.dag-edge {
  fill: none;
  stroke-width: 2;
}

.edge-completed { stroke: #4CAF50; }
.edge-active { stroke: #2196F3; stroke-dasharray: 5,5; }
.edge-failed { stroke: #F44336; }
.edge-pending { stroke: #555; }

.dag-node {
  stroke: #555;
  stroke-width: 1;
}

.node-completed { fill: rgba(76,175,80,0.2); stroke: #4CAF50; }
.node-running { fill: rgba(33,150,243,0.2); stroke: #2196F3; }
.node-failed { fill: rgba(244,67,54,0.2); stroke: #F44336; }
.node-pending { fill: rgba(85,85,85,0.2); stroke: #666; }
.node-skipped { fill: rgba(85,85,85,0.1); stroke: #444; }

.node-type { fill: #aaa; font-size: 10px; }
.node-name { fill: #e0e0e0; font-size: 11px; font-weight: bold; }
.node-status { fill: #888; font-size: 9px; }

.node-indicator { animation: pulse 1.5s infinite; }
.indicator-running { fill: #2196F3; }

/* ─── Events Section ─── */

.events-section {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.events-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.event-count {
  color: #888;
  font-size: 13px;
}

.events-list {
  max-height: 300px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #222;
  font-size: 13px;
}

.event-item:last-child { border-bottom: none; }

.event-time { color: #666; white-space: nowrap; }
.event-type { color: #4FC3F7; }
.event-node { color: #FFB74D; }
.event-data { color: #888; }

/* ─── Stats Section ─── */

.stats-section {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
}

.stats-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  background: #0d1117;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label { font-size: 12px; }

.stat-card.completed .stat-value { color: #4CAF50; }
.stat-card.running .stat-value { color: #2196F3; }
.stat-card.failed .stat-value { color: #F44336; }
.stat-card.pending .stat-value { color: #FFC107; }

/* ─── Buttons ─── */

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-success { background: #4CAF50; color: white; }
.btn-warning { background: #FF9800; color: white; }
.btn-info { background: #2196F3; color: white; }
.btn-danger { background: #F44336; color: white; }
.btn-secondary { background: #333; color: #e0e0e0; border: 1px solid #555; }

/* ─── Empty State ─── */

.empty-state {
  text-align: center;
  padding: 60px;
  color: #555;
}
</style>
