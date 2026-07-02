<template>
  <div class="di-panel">
    <!-- Header -->
    <div class="di-panel__header">
      <h2 class="di-panel__title">Decision Graph</h2>
      <span v-if="loading" class="di-panel__badge di-panel__badge--loading">Loading</span>
      <span v-else-if="error" class="di-panel__badge di-panel__badge--error">Error</span>
      <span v-else class="di-panel__badge di-panel__badge--ready">
        {{ summary.total }} Issues
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="di-panel__loading">
      <div class="di-panel__spinner"></div>
      <p>Analyzing brand visibility...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="di-panel__error">
      <p>Failed to analyze decision graph: {{ error }}</p>
      <button @click="fetchGraph" class="di-panel__retry">Retry</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!graph" class="di-panel__empty">
      <p>No issues detected. Run a scan first.</p>
    </div>

    <!-- Main Content -->
    <div v-else class="di-panel__body">
      <div class="di-panel__layout">
        <!-- Left: Key Metrics -->
        <aside class="di-panel__sidebar">
          <div class="di-panel__metric-group">
            <h3 class="di-panel__metric-title">Root Causes</h3>
            <div v-if="rootCauseNodes.length" class="di-panel__root-causes">
              <div
                v-for="node in rootCauseNodes"
                :key="node.id"
                class="di-panel__root-cause-card"
                :class="severityClass(node.severity)"
                @click="selectIssue(node)"
              >
                <span class="di-panel__root-emoji">🔴</span>
                <div>
                  <div class="di-panel__root-title">{{ kindLabel(node.kind) }}</div>
                  <div class="di-panel__root-conf">Confidence {{ (node.confidence * 100).toFixed(0) }}%</div>
                </div>
              </div>
            </div>
            <p v-else class="di-panel__no-data">No root causes identified</p>
          </div>

          <div class="di-panel__metric-group">
            <h3 class="di-panel__metric-title">Overview</h3>
            <div class="di-panel__metrics">
              <div class="di-panel__metric">
                <span class="di-panel__metric-value di-panel__metric-value--critical">{{ summary.critical }}</span>
                <span class="di-panel__metric-label">Critical</span>
              </div>
              <div class="di-panel__metric">
                <span class="di-panel__metric-value di-panel__metric-value--major">{{ summary.major }}</span>
                <span class="di-panel__metric-label">Major</span>
              </div>
              <div class="di-panel__metric">
                <span class="di-panel__metric-value di-panel__metric-value--minor">{{ summary.minor }}</span>
                <span class="di-panel__metric-label">Minor</span>
              </div>
              <div class="di-panel__metric">
                <span class="di-panel__metric-value">{{ summary.rootCauseCount }}</span>
                <span class="di-panel__metric-label">Root</span>
              </div>
              <div class="di-panel__metric">
                <span class="di-panel__metric-value">{{ edges.length }}</span>
                <span class="di-panel__metric-label">Deps</span>
              </div>
              <div class="di-panel__metric">
                <span class="di-panel__metric-value">{{ summary.longestChain }}</span>
                <span class="di-panel__metric-label">Depth</span>
              </div>
            </div>
          </div>

          <div class="di-panel__metric-group">
            <h3 class="di-panel__metric-title">Distribution</h3>
            <div class="di-panel__distribution">
              <div
                v-for="(count, kind) in severityDistribution"
                :key="kind"
                class="di-panel__dist-item"
              >
                <span class="di-panel__dist-kind">{{ kindLabel(kind) }}</span>
                <div class="di-panel__dist-bar">
                  <div
                    class="di-panel__dist-fill"
                    :style="{ width: distPercent(count) + '%' }"
                    :class="kindClass(kind)"
                  ></div>
                </div>
                <span class="di-panel__dist-count">{{ count }}</span>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right: DAG Graph -->
        <main class="di-panel__graph-area">
          <svg
            ref="svgRef"
            :width="svgWidth"
            :height="svgHeight"
            class="di-panel__svg"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
          >
            <!-- Edges (lines) -->
            <path
              v-for="(edge, ei) in edgePaths"
              :key="'e-' + ei"
              :d="edge.path"
              :class="['di-panel__edge', {
                'di-panel__edge--active': selectedIssueId && (edge.fromId === selectedIssueId || edge.toId === selectedIssueId)
              }]"
              :stroke="edgeColor(edge.relationship)"
              stroke-width="1.5"
              fill="none"
              stroke-dasharray="4,3"
            />
            <text
              v-for="(edge, ei) in edgeLabels"
              :key="'el-' + ei"
              :x="edge.labelX"
              :y="edge.labelY"
              class="di-panel__edge-label"
              text-anchor="middle"
              font-size="10"
            >{{ edge.relationship }}</text>

            <!-- Nodes -->
            <g
              v-for="node in nodePositions"
              :key="node.id"
              :transform="'translate(' + node.x + ',' + node.y + ')'"
              class="di-panel__node-group"
              @click="selectIssue(node)"
            >
              <!-- Node circle -->
              <circle
                :r="nodeRadius(node)"
                :class="[
                  'di-panel__node-circle',
                  nodeClass(node),
                  { 'di-panel__node--selected': selectedIssueId === node.id }
                ]"
                :fill="nodeColor(node)"
                stroke="#fff"
                stroke-width="2"
              />
              <!-- Node label -->
              <text
                class="di-panel__node-text"
                text-anchor="middle"
                dy="4"
                font-size="11"
                fill="#fff"
              >{{ kindLabel(node.kind).slice(0, 6) }}</text>
            </g>
          </svg>

          <!-- Zoom Controls -->
          <div class="di-panel__zoom">
            <button @click="zoomIn" class="di-panel__zoom-btn" title="Zoom in">+</button>
            <span class="di-panel__zoom-level">{{ (zoom * 100).toFixed(0) }}%</span>
            <button @click="zoomOut" class="di-panel__zoom-btn" title="Zoom out">−</button>
            <button @click="resetZoom" class="di-panel__zoom-btn di-panel__zoom-btn--reset" title="Reset">⊙</button>
          </div>
        </main>
      </div>

      <!-- Bottom: Issue List -->
      <div class="di-panel__issue-list">
        <h3 class="di-panel__section-title">
          Issue List
          <span class="di-panel__issue-count">{{ sortedIssues.length }} issues</span>
        </h3>
        <div class="di-panel__issue-cards">
          <div
            v-for="issue in sortedIssues"
            :key="issue.id"
            class="di-panel__issue-card"
            :class="{ 'di-panel__issue-card--selected': selectedIssueId === issue.id }"
            @click="selectIssue(issue)"
          >
            <div class="di-panel__issue-card-left">
              <span class="di-panel__issue-badge" :class="severityClass(issue.severity)">
                {{ severityLabel(issue.severity) }}
              </span>
              <span class="di-panel__issue-kind">{{ kindLabel(issue.kind) }}</span>
            </div>
            <div class="di-panel__issue-card-center">
              <div class="di-panel__issue-title">{{ issue.title }}</div>
              <div class="di-panel__issue-meta">
                <span>Confidence {{ (issue.confidence * 100).toFixed(0) }}%</span>
                <span>Status: {{ issue.status }}</span>
                <span>Source: {{ issue.source }}</span>
              </div>
            </div>
            <div class="di-panel__issue-card-right">
              <svg width="32" height="32" viewBox="0 0 32 32" v-if="issue.rootCause">
                <circle cx="16" cy="16" r="14" fill="#ef4444" opacity="0.2" />
                <text x="16" y="20" text-anchor="middle" font-size="12" fill="#ef4444">RC</text>
              </svg>
              <span v-else class="di-panel__issue-deps">{{ dependenciesFor(issue.id).length }} deps</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Issue Detail Drawer -->
    <Transition name="drawer">
      <div v-if="selectedIssue && showDrawer" class="di-panel__drawer-overlay" @click.self="closeDrawer">
        <div class="di-panel__drawer">
          <div class="di-panel__drawer-header">
            <h3>Issue Detail</h3>
            <button @click="closeDrawer" class="di-panel__drawer-close">&times;</button>
          </div>
          <div class="di-panel__drawer-body">
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Title</span>
              <span>{{ selectedIssue.title }}</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Kind</span>
              <span class="di-panel__drawer-kind">{{ kindLabel(selectedIssue.kind) }}</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Severity</span>
              <span :class="severityClass(selectedIssue.severity)">{{ severityLabel(selectedIssue.severity) }} ({{ selectedIssue.severity }}/10)</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Confidence</span>
              <span>{{ (selectedIssue.confidence * 100).toFixed(0) }}%</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Status</span>
              <span>{{ selectedIssue.status }}</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Root Cause</span>
              <span>{{ selectedIssue.rootCause ? 'Yes' : 'No' }}</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Source</span>
              <span>{{ selectedIssue.source }}</span>
            </div>
            <div class="di-panel__drawer-row">
              <span class="di-panel__drawer-label">Dependencies</span>
              <div class="di-panel__drawer-deps">
                <div v-for="dep in dependenciesFor(selectedIssue.id)" :key="dep.from + dep.to" class="di-panel__drawer-dep">
                  {{ dep.from.slice(0, 12) }} → {{ dep.to.slice(0, 12) }} [{{ dep.relationship }}]
                </div>
                <span v-if="!dependenciesFor(selectedIssue.id).length" class="di-panel__drawer-dep-none">None</span>
              </div>
            </div>
          </div>
          <!-- Evidence placeholder for A1.1 -->
          <div class="di-panel__drawer-footer">
            <p class="di-panel__drawer-evidence">Evidence analysis coming in future release.</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { Issue, IssueEdge, IssueGraph, GraphSummary } from '~/workspaces/geo/services/diService'

interface LayoutNode {
  id: string
  x: number
  y: number
  kind: string
  severity: number
  rootCause: boolean
  confidence: number
  title: string
  status: string
  source: string
}

interface LayoutEdge {
  fromId: string
  toId: string
  relationship: string
  path: string
  labelX: number
  labelY: number
}

const props = defineProps<{
  brandId: string
}>()

const emit = defineEmits<{
  issueSelected: [issue: Issue | null]
}>()

// ── State ──
const loading = ref(false)
const error = ref<string | null>(null)
const graph = ref<IssueGraph | null>(null)
const selectedIssueId = ref<string | null>(null)
const selectedIssue = ref<Issue | null>(null)
const showDrawer = ref(false)

// SVG ref
const svgRef = ref<SVGSVGElement | null>(null)

// Zoom
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

// ── Computed ──
const nodes = computed(() => graph.value?.nodes || [])
const edges = computed(() => graph.value?.edges || [])
const summary = computed<GraphSummary>(() => graph.value?.summary || {
  total: 0, critical: 0, major: 0, minor: 0, rootCauseCount: 0, longestChain: 0, severityDistribution: {}
})

const rootCauseNodes = computed(() => nodes.value.filter(n => n.rootCause))
const severityDistribution = computed(() => summary.value.severityDistribution || {})

const sortedIssues = computed(() =>
  [...nodes.value].sort((a, b) => b.severity - a.severity || b.confidence - a.confidence)
)

// ── Laid out positions (simple vertical stack layout, no dagre) ──
const nodePositions = computed<LayoutNode[]>(() => {
  const issues = sortedIssues.value
  const mid = Math.ceil(issues.length / 2)
  const left = issues.slice(0, mid)
  const right = issues.slice(mid)

  const positions: LayoutNode[] = []
  const gapX = 200
  const gapY = 100
  const startX = 100
  const startY = 80

  left.forEach((n, i) => {
    positions.push({
      id: n.id,
      x: startX,
      y: startY + i * gapY,
      kind: n.kind,
      severity: n.severity,
      rootCause: n.rootCause,
      confidence: n.confidence,
      title: n.title,
      status: n.status,
      source: n.source,
    })
  })
  right.forEach((n, i) => {
    positions.push({
      id: n.id,
      x: startX + gapX,
      y: startY + i * gapY,
      kind: n.kind,
      severity: n.severity,
      rootCause: n.rootCause,
      confidence: n.confidence,
      title: n.title,
      status: n.status,
      source: n.source,
    })
  })
  return positions
})

const nodeMap = computed(() => {
  const m = new Map<string, { x: number; y: number }>()
  for (const n of nodePositions.value) m.set(n.id, { x: n.x, y: n.y })
  return m
})

const edgePaths = computed<LayoutEdge[]>(() => {
  return edges.value.map(e => {
    const from = nodeMap.value.get(e.from)
    const to = nodeMap.value.get(e.to)
    if (!from || !to) {
      return { fromId: e.from, toId: e.to, relationship: e.relationship, path: '', labelX: 0, labelY: 0 }
    }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const mx = (from.x + to.x) / 2
    const my = (from.y + to.y) / 2

    // Simple bezier curve
    const controlOffset = Math.abs(dy) * 0.3
    const path = `M ${from.x} ${from.y} Q ${mx} ${from.y + controlOffset}, ${to.x} ${to.y}`
    return {
      fromId: e.from,
      toId: e.to,
      relationship: e.relationship,
      path,
      labelX: mx + 15,
      labelY: from.y + (dy > 0 ? controlOffset + 10 : controlOffset - 10),
    }
  })
})

const edgeLabels = computed(() => edgePaths.value)

// ── SVG sizing ──
const svgWidth = computed(() => {
  const maxX = Math.max(...nodePositions.value.map(n => n.x), 100)
  return Math.max(400, maxX + 150)
})
const svgHeight = computed(() => {
  const maxY = Math.max(...nodePositions.value.map(n => n.y), 100)
  return Math.max(300, maxY + 100)
})

// ── Helpers ──
function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    schema: 'Schema',
    content: 'Content',
    authority: 'Authority',
    technical: 'Technical',
    unknown: 'Unknown',
  }
  return labels[kind] || kind
}

function severityClass(severity: number): string {
  if (severity >= 8) return 'severity-critical'
  if (severity >= 5) return 'severity-major'
  return 'severity-minor'
}

function severityLabel(severity: number): string {
  if (severity >= 8) return 'Critical'
  if (severity >= 5) return 'Major'
  return 'Minor'
}

function kindClass(kind: string): string {
  const classes: Record<string, string> = {
    schema: 'fill-kind-schema',
    content: 'fill-kind-content',
    authority: 'fill-kind-authority',
    technical: 'fill-kind-technical',
  }
  return classes[kind] || ''
}

function nodeColor(node: LayoutNode): string {
  const colors: Record<string, string> = {
    schema: node.rootCause ? '#ef4444' : '#3b82f6',
    content: node.rootCause ? '#ef4444' : '#10b981',
    authority: node.rootCause ? '#ef4444' : '#f59e0b',
    technical: node.rootCause ? '#ef4444' : '#8b5cf6',
  }
  return colors[node.kind] || '#6b7280'
}

function nodeClass(node: LayoutNode): string {
  return node.rootCause ? 'di-panel__node--root-cause' : ''
}

function nodeRadius(node: LayoutNode): number {
  return Math.max(16, Math.min(24, 16 + node.severity))
}

function edgeColor(relationship: string): string {
  const colors: Record<string, string> = {
    causes: '#ef4444',
    blocks: '#f59e0b',
    duplicates: '#9ca3af',
    related: '#60a5fa',
    depends_on: '#a78bfa',
  }
  return colors[relationship] || '#9ca3af'
}

function distPercent(count: number): number {
  const max = Math.max(...Object.values(severityDistribution.value), 1)
  return (count / max) * 100
}

function dependenciesFor(issueId: string): IssueEdge[] {
  return edges.value.filter(e => e.from === issueId || e.to === issueId)
}

// ── Actions ──
function selectIssue(issue: Issue): void {
  selectedIssueId.value = issue.id
  selectedIssue.value = issue
  showDrawer.value = true
  emit('issueSelected', issue)
}

function closeDrawer(): void {
  showDrawer.value = false
  selectedIssueId.value = null
  selectedIssue.value = null
  emit('issueSelected', null)
}

function zoomIn(): void {
  zoom.value = Math.min(zoom.value + 0.2, 3)
}

function zoomOut(): void {
  zoom.value = Math.max(zoom.value - 0.2, 0.3)
}

function resetZoom(): void {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function onMouseMove(e: MouseEvent): void {
  if (!isPanning.value) return
  panX.value += (e.clientX - panStart.value.x) / zoom.value
  panY.value += (e.clientY - panStart.value.y) / zoom.value
  panStart.value = { x: e.clientX, y: e.clientY }
}

function onMouseUp(): void {
  isPanning.value = false
}

async function fetchGraph(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const { fetchIssueGraph } = await import('~/workspaces/geo/services/diService')
    const result = await fetchIssueGraph(props.brandId)
    graph.value = result
  } catch (err: any) {
    error.value = err.message || 'Failed to load decision graph'
  } finally {
    loading.value = false
  }
}

// ── Lifecycle ──
onMounted(() => {
  if (props.brandId) fetchGraph()
})

watch(() => props.brandId, (newId) => {
  if (newId) fetchGraph()
})
</script>

<style scoped>
.di-panel {
  @apply bg-white rounded-lg border border-gray-200;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Header */
.di-panel__header {
  @apply flex items-center justify-between px-5 py-3 border-b border-gray-100;
}
.di-panel__title {
  @apply text-lg font-semibold text-gray-800 m-0;
}
.di-panel__badge {
  @apply text-xs px-2.5 py-1 rounded-full font-medium;
}
.di-panel__badge--ready {
  @apply bg-blue-50 text-blue-700;
}
.di-panel__badge--loading {
  @apply bg-yellow-50 text-yellow-700;
}
.di-panel__badge--error {
  @apply bg-red-50 text-red-700;
}

/* Loading */
.di-panel__loading {
  @apply flex flex-col items-center justify-center py-16 text-gray-500;
}
.di-panel__spinner {
  @apply w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3;
}

/* Error / Empty */
.di-panel__error {
  @apply text-center py-12 text-red-600;
}
.di-panel__retry {
  @apply mt-3 px-4 py-2 bg-blue-500 text-white rounded text-sm;
}
.di-panel__empty {
  @apply text-center py-12 text-gray-400;
}

/* Body Layout */
.di-panel__body {
  @apply p-0;
}
.di-panel__layout {
  @apply flex;
}

/* Sidebar */
.di-panel__sidebar {
  @apply w-64 shrink-0 border-r border-gray-100 p-4 overflow-y-auto;
  max-height: 500px;
}
.di-panel__metric-group {
  @apply mb-5;
}
.di-panel__metric-title {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2;
}

/* Root Cause Cards */
.di-panel__root-causes {
  @apply space-y-2;
}
.di-panel__root-cause-card {
  @apply flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors;
  @apply hover:bg-gray-50;
}
.di-panel__root-cause-card.severity-critical {
  @apply border-red-200 bg-red-50;
}
.di-panel__root-cause-card.severity-major {
  @apply border-orange-200 bg-orange-50;
}
.di-panel__root-emoji {
  font-size: 16px;
  line-height: 1;
}
.di-panel__root-title {
  @apply text-sm font-medium text-gray-800;
}
.di-panel__root-conf {
  @apply text-xs text-gray-500;
}
.di-panel__no-data {
  @apply text-xs text-gray-400 italic;
}

/* Metrics Grid */
.di-panel__metrics {
  @apply grid grid-cols-3 gap-2;
}
.di-panel__metric {
  @apply text-center p-2 rounded-lg bg-gray-50;
}
.di-panel__metric-value {
  @apply block text-lg font-bold text-gray-800;
}
.di-panel__metric-value--critical {
  @apply text-red-600;
}
.di-panel__metric-value--major {
  @apply text-orange-500;
}
.di-panel__metric-value--minor {
  @apply text-blue-500;
}
.di-panel__metric-label {
  @apply block text-xs text-gray-500 mt-0.5;
}

/* Distribution bars */
.di-panel__distribution {
  @apply space-y-1.5;
}
.di-panel__dist-item {
  @apply flex items-center gap-2;
}
.di-panel__dist-kind {
  @apply w-20 text-xs text-gray-600 shrink-0;
}
.di-panel__dist-bar {
  @apply flex-1 h-3 bg-gray-100 rounded-full overflow-hidden;
}
.di-panel__dist-fill {
  @apply h-full rounded-full transition-all duration-300;
}
.di-panel__dist-fill.fill-kind-schema { @apply bg-blue-500; }
.di-panel__dist-fill.fill-kind-content { @apply bg-emerald-500; }
.di-panel__dist-fill.fill-kind-authority { @apply bg-amber-500; }
.di-panel__dist-fill.fill-kind-technical { @apply bg-purple-500; }
.di-panel__dist-count {
  @apply w-6 text-right text-xs text-gray-500;
}

/* Graph Area */
.di-panel__graph-area {
  @apply flex-1 relative overflow-hidden bg-gray-50/50;
  min-height: 500px;
}
.di-panel__svg {
  @apply cursor-grab active:cursor-grabbing transition-transform;
}
.di-panel__edge {
  @apply transition-opacity duration-200;
}
.di-panel__edge--active {
  stroke-width: 2.5;
  opacity: 1 !important;
}
.di-panel__edge:not(.di-panel__edge--active) {
  opacity: 0.4;
}
.di-panel__edge-label {
  @apply fill-gray-400 text-xs;
  pointer-events: none;
}
.di-panel__node-group {
  @apply cursor-pointer;
}
.di-panel__node-circle {
  @apply transition-all duration-200;
}
.di-panel__node-circle:hover {
  filter: brightness(1.15);
  stroke-width: 3;
}
.di-panel__node--selected {
  stroke: #1d4ed8 !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 6px rgba(29, 78, 216, 0.4));
}
.di-panel__node--root-cause {
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.5));
}
.di-panel__node-text {
  pointer-events: none;
  font-weight: 600;
}

/* Zoom Controls */
.di-panel__zoom {
  @apply absolute bottom-3 right-3 flex items-center gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1;
}
.di-panel__zoom-btn {
  @apply w-7 h-7 flex items-center justify-center rounded text-sm font-bold;
  @apply text-gray-600 hover:bg-gray-100 transition-colors;
}
.di-panel__zoom-btn--reset {
  @apply text-xs;
}
.di-panel__zoom-level {
  @apply text-xs text-gray-500 min-w-[3rem] text-center;
}

/* Issue List */
.di-panel__issue-list {
  @apply border-t border-gray-100 p-4;
}
.di-panel__section-title {
  @apply text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2;
}
.di-panel__issue-count {
  @apply text-xs text-gray-400 font-normal;
}
.di-panel__issue-cards {
  @apply grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto;
}
.di-panel__issue-card {
  @apply flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer transition-all;
  @apply hover:border-gray-300 hover:shadow-sm;
}
.di-panel__issue-card--selected {
  @apply border-blue-300 bg-blue-50/50;
}
.di-panel__issue-card-left {
  @apply shrink-0 flex flex-col items-center gap-1 w-16;
}
.di-panel__issue-badge {
  @apply text-xs font-medium px-1.5 py-0.5 rounded;
}
.di-panel__issue-badge.severity-critical {
  @apply bg-red-100 text-red-700;
}
.di-panel__issue-badge.severity-major {
  @apply bg-orange-100 text-orange-700;
}
.di-panel__issue-badge.severity-minor {
  @apply bg-blue-100 text-blue-700;
}
.di-panel__issue-kind {
  @apply text-xs text-gray-400;
}
.di-panel__issue-card-center {
  @apply flex-1 min-w-0;
}
.di-panel__issue-title {
  @apply text-sm text-gray-800 truncate;
}
.di-panel__issue-meta {
  @apply text-xs text-gray-500 mt-0.5 flex gap-2;
}
.di-panel__issue-card-right {
  @apply shrink-0;
}
.di-panel__issue-deps {
  @apply text-xs text-gray-400;
}

/* Drawer */
.di-panel__drawer-overlay {
  @apply fixed inset-0 bg-black/20 z-50 flex justify-end;
}
.di-panel__drawer {
  @apply w-96 max-w-[90vw] bg-white h-full overflow-y-auto shadow-xl;
}
.di-panel__drawer-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200;
}
.di-panel__drawer-header h3 {
  @apply text-lg font-semibold m-0;
}
.di-panel__drawer-close {
  @apply w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl;
}
.di-panel__drawer-body {
  @apply p-4 space-y-3;
}
.di-panel__drawer-row {
  @apply flex items-start gap-3;
}
.di-panel__drawer-label {
  @apply w-24 shrink-0 text-sm text-gray-500;
}
.di-panel__drawer-kind {
  @apply inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100;
}
.di-panel__drawer-deps {
  @apply flex flex-col gap-1;
}
.di-panel__drawer-dep {
  @apply text-xs text-gray-600;
}
.di-panel__drawer-dep-none {
  @apply text-xs text-gray-400 italic;
}
.di-panel__drawer-footer {
  @apply p-4 border-t border-gray-100;
}
.di-panel__drawer-evidence {
  @apply text-xs text-gray-400 italic m-0;
}

/* Drawer transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s;
}
.drawer-enter-active .di-panel__drawer,
.drawer-leave-active .di-panel__drawer {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .di-panel__drawer {
  transform: translateX(100%);
}
.drawer-leave-to .di-panel__drawer {
  transform: translateX(100%);
}
</style>
