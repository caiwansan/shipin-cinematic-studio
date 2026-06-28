<template>
  <div class="workflow-studio">
    <!-- Header -->
    <header class="studio-header">
      <div class="header-left">
        <h2>{{ isEditing ? '编辑工作流' : '新建工作流' }}</h2>
        <div class="workflow-meta" v-if="isEditing">
          <span class="badge" :class="definition.status">{{ definition.status }}</span>
          <span class="version">v{{ definition.version }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="saveDraft" :disabled="saving">
          {{ saving ? '保存中...' : '保存草稿' }}
        </button>
        <button class="btn btn-primary" @click="saveAndActivate" :disabled="saving || !isValid">
          {{ saving ? '保存中...' : '发布工作流' }}
        </button>
      </div>
    </header>

    <div class="studio-body">
      <!-- Left: Node Palette -->
      <aside class="node-palette">
        <h3>节点类型</h3>
        <div class="palette-list">
          <div
            v-for="nodeType in availableNodeTypes"
            :key="nodeType.type"
            class="palette-item"
            :class="`node-type-${nodeType.type}`"
            draggable="true"
            @dragstart="onDragStart($event, nodeType)"
          >
            <span class="node-icon" v-html="nodeType.icon"></span>
            <span class="node-label">{{ nodeType.label }}</span>
          </div>
        </div>
      </aside>

      <!-- Center: Canvas -->
      <main class="canvas-area">
        <!-- Toolbar -->
        <div class="canvas-toolbar">
          <div class="toolbar-group">
            <button class="toolbar-btn" @click="zoomIn" title="放大">🔍+</button>
            <button class="toolbar-btn" @click="zoomOut" title="缩小">🔍-</button>
            <button class="toolbar-btn" @click="resetZoom" title="重置缩放">⟲</button>
          </div>
          <div class="toolbar-group">
            <button class="toolbar-btn" @click="deleteSelected" :disabled="!selectedNode" title="删除选中节点">🗑</button>
            <button class="toolbar-btn" @click="clearCanvas" title="清空画布">✕</button>
          </div>
          <div class="toolbar-status">
            <span v-if="validationResult" :class="validationResult.valid ? 'valid' : 'invalid'">
              {{ validationResult.valid ? '✓ 有效' : `✗ ${validationResult.errors.length} 个错误` }}
            </span>
          </div>
        </div>

        <!-- SVG Canvas -->
        <div
          class="canvas-container"
          ref="canvasRef"
          @drop="onDrop"
          @dragover.prevent="onDragOver"
          @click="clearSelection"
        >
          <svg
            class="canvas-svg"
            :width="canvasWidth"
            :height="canvasHeight"
            @click.stop
          >
            <!-- Edges -->
            <g class="edges-layer">
              <g v-for="edge in edges" :key="edge.id">
                <path
                  :d="getEdgePath(edge)"
                  class="edge-line"
                  :class="{ selected: selectedEdge?.id === edge.id }"
                  @click.stop="selectEdge(edge)"
                />
                <text
                  v-if="edge.condition"
                  :x="getEdgeMidpoint(edge).x"
                  :y="getEdgeMidpoint(edge).y"
                  class="edge-label"
                  text-anchor="middle"
                >{{ edge.condition }}</text>
              </g>
            </g>

            <!-- Nodes -->
            <g class="nodes-layer">
              <g
                v-for="node in nodes"
                :key="node.id"
                :transform="`translate(${node.position?.x || 0}, ${node.position?.y || 0})`"
                class="node-group"
                :class="{ selected: selectedNode?.id === node.id }"
                @click.stop="selectNode(node)"
              >
                <!-- Node shape based on type -->
                <component :is="getNodeShape(node)" :node="node" :selected="selectedNode?.id === node.id" />
                <!-- Node label -->
                <text
                  :x="getNodeWidth(node) / 2"
                  y="70"
                  text-anchor="middle"
                  class="node-name"
                >{{ node.name }}</text>
                <!-- Ports -->
                <circle
                  cx="0"
                  cy="35"
                  r="6"
                  class="port port-input"
                  @mousedown.stop="startEdgeConnection(node, 'input')"
                />
                <circle
                  :cx="getNodeWidth(node)"
                  cy="35"
                  r="6"
                  class="port port-output"
                  @mousedown.stop="startEdgeConnection(node, 'output')"
                />
              </g>
            </g>

            <!-- Temporary edge during connection -->
            <line
              v-if="connecting.connected"
              :x1="connecting.startX"
              :y1="connecting.startY"
              :x2="connecting.currentX"
              :y2="connecting.currentY"
              class="temp-edge"
            />
          </svg>

          <!-- Drop zone hint -->
          <div v-if="nodes.length === 0" class="canvas-empty">
            <p>从左侧拖拽节点到此处开始构建工作流</p>
          </div>
        </div>
      </main>

      <!-- Right: Config Panel -->
      <aside class="config-panel">
        <h3>配置</h3>
        <div v-if="!selectedNode && !selectedEdge" class="config-empty">
          <p>选择一个节点或边进行配置</p>
        </div>

        <!-- Node config -->
        <div v-if="selectedNode" class="node-config">
          <div class="config-field">
            <label>节点名称</label>
            <input v-model="selectedNode.name" @input="updateNode(selectedNode)" />
          </div>
          <div class="config-field">
            <label>节点类型</label>
            <input :value="selectedNode.type" disabled class="readonly" />
          </div>
          <div class="config-field" v-if="hasConfigurableFields(selectedNode.type)">
            <label>{{ getConfigLabel(selectedNode.type) }}</label>
            <textarea
              v-model="nodeConfigStr"
              @input="updateNodeConfig"
              rows="4"
            ></textarea>
          </div>
        </div>

        <!-- Edge config -->
        <div v-if="selectedEdge" class="edge-config">
          <div class="config-field">
            <label>条件</label>
            <input v-model="selectedEdge.condition" @input="updateEdge(selectedEdge)" placeholder="e.g. ${status} == 'completed'" />
          </div>
          <div class="config-field">
            <label>标签</label>
            <input v-model="selectedEdge.label" @input="updateEdge(selectedEdge)" />
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import type { DagNode, DagEdge, DagDefinition, WorkflowDefinition } from '../types/index.js'
import { NodeType } from '../types/index.js'
import { workflowService } from '../services/workflow.service.js'

// ─── Props ───

const props = defineProps<{
  definitionId?: string
}>()

const emit = defineEmits<{
  saved: [definition: WorkflowDefinition]
}>()

// ─── Node Types Palette ───

const availableNodeTypes = [
  { type: 'start', label: '开始', icon: '▶', color: '#4CAF50' },
  { type: 'agent', label: 'Agent', icon: '🤖', color: '#2196F3' },
  { type: 'capability', label: '能力', icon: '⚡', color: '#FF9800' },
  { type: 'condition', label: '条件', icon: '◇', color: '#9C27B0' },
  { type: 'parallel', label: '并行', icon: '⇉', color: '#00BCD4' },
  { type: 'loop', label: '循环', icon: '↻', color: '#607D8B' },
  { type: 'merge', label: '合并', icon: '⇇', color: '#795548' },
  { type: 'delay', label: '延迟', icon: '⏱', color: '#FF5722' },
  { type: 'event', label: '事件', icon: '📡', color: '#E91E63' },
  { type: 'humanApproval', label: '审批', icon: '👤', color: '#3F51B5' },
  { type: 'humanEdit', label: '编辑', icon: '✏', color: '#009688' },
  { type: 'humanReview', label: '审核', icon: '🔍', color: '#673AB7' },
  { type: 'humanUpload', label: '上传', icon: '📤', color: '#8BC34A' },
  { type: 'humanDecision', label: '决策', icon: '✓', color: '#CDDC39' },
  { type: 'end', label: '结束', icon: '■', color: '#F44336' },
]

// ─── State ───

const nodes = ref<DagNode[]>([])
const edges = ref<DagEdge[]>([])
const selectedNode = ref<DagNode | null>(null)
const selectedEdge = ref<DagEdge | null>(null)
const nodeConfigStr = ref('')
const saving = ref(false)
const canvasRef = ref<HTMLElement | null>(null)
const isEditing = ref(false)
const definition = ref<Partial<WorkflowDefinition>>({
  code: '',
  name: '',
  version: '1.0.0',
  description: '',
  trigger: 'manual',
  category: '',
  graph: { nodes: [], edges: [] },
})

const canvasWidth = ref(1200)
const canvasHeight = ref(800)
const zoom = ref(1)

const connecting = reactive({
  connected: false as boolean,
  sourceNode: null as DagNode | null,
  startX: 0 as number,
  startY: 0 as number,
  currentX: 0 as number,
  currentY: 0 as number,
})

// ─── Computed ───

const validationResult = computed(() => {
  // Basic validation
  const errors: string[] = []
  const startCount = nodes.value.filter(n => n.type === 'start').length
  const endCount = nodes.value.filter(n => n.type === 'end').length

  if (startCount === 0) errors.push('缺少开始节点')
  if (endCount === 0) errors.push('缺少结束节点')
  if (nodes.value.length === 0) errors.push('画布为空')

  return {
    valid: errors.length === 0,
    errors,
  }
})

const isValid = computed(() => validationResult.value.valid)

// ─── Methods ───

function onDragStart(event: DragEvent, nodeType: typeof availableNodeTypes[0]) {
  event.dataTransfer?.setData('text/plain', nodeType.type)
  event.dataTransfer!.effectAllowed = 'copy'
}

function onDragOver(event: DragEvent) {
  event.dataTransfer!.dropEffect = 'copy'
}

function onDrop(event: DragEvent) {
  if (!canvasRef.value) return

  const type = event.dataTransfer?.getData('text/plain')
  if (!type) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = (event.clientX - rect.left - 60) / zoom.value
  const y = (event.clientY - rect.top - 35) / zoom.value

  const nodeTypeInfo = availableNodeTypes.find(nt => nt.type === type)
  const newNode: DagNode = {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    name: nodeTypeInfo?.label || type,
    position: { x, y },
    config: getDefaultConfig(type),
  }

  nodes.value.push(newNode)
  updateGraph()
}

function getDefaultConfig(type: string): Record<string, any> {
  switch (type) {
    case 'delay': return { duration: 1000 }
    case 'event': return { eventType: 'customEvent' }
    case 'agent': return { agentCode: '' }
    case 'capability': return { capabilityName: '' }
    default: return {}
  }
}

function selectNode(node: DagNode) {
  selectedNode.value = node
  selectedEdge.value = null
  if (node.config) {
    nodeConfigStr.value = JSON.stringify(node.config, null, 2)
  } else {
    nodeConfigStr.value = '{}'
  }
}

function selectEdge(edge: DagEdge) {
  selectedEdge.value = edge
  selectedNode.value = null
}

function clearSelection() {
  selectedNode.value = null
  selectedEdge.value = null
}

function updateNode(node: DagNode) {
  // Trigger reactivity
  nodes.value = [...nodes.value]
  updateGraph()
}

function updateNodeConfig() {
  if (!selectedNode.value) return
  try {
    selectedNode.value.config = JSON.parse(nodeConfigStr.value)
  } catch {
    // Invalid JSON — don't update
  }
  updateGraph()
}

function updateEdge(edge: DagEdge) {
  edges.value = [...edges.value]
  updateGraph()
}

function updateGraph() {
  definition.value.graph = { nodes: nodes.value, edges: edges.value }
}

// ─── Edge Connection ───

function startEdgeConnection(node: DagNode, _port: string) {
  connecting.connected = true
  connecting.sourceNode = node
  connecting.startX = (node.position?.x || 0) + getNodeWidth(node)
  connecting.startY = (node.position?.y || 0) + 35

  const onMouseMove = (event: MouseEvent) => {
    if (!canvasRef.value) return
    const rect = canvasRef.value.getBoundingClientRect()
    connecting.currentX = (event.clientX - rect.left) / zoom.value
    connecting.currentY = (event.clientY - rect.top) / zoom.value
  }

  const onMouseUp = (event: MouseEvent) => {
    if (!canvasRef.value) return
    const rect = canvasRef.value.getBoundingClientRect()
    const x = (event.clientX - rect.left) / zoom.value
    const y = (event.clientY - rect.top) / zoom.value

    // Find target node by position
    const targetNode = nodes.value.find(n => {
      if (n.id === connecting.sourceNode?.id) return false
      const nx = n.position?.x || 0
      const ny = n.position?.y || 0
      const nw = getNodeWidth(n)
      return x >= nx && x <= nx + nw && y >= ny && y <= ny + 70
    })

    if (targetNode && connecting.sourceNode) {
      const newEdge: DagEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: connecting.sourceNode.id,
        target: targetNode.id,
        condition: '',
      }
      edges.value.push(newEdge)
      updateGraph()
    }

    connecting.connected = false
    connecting.sourceNode = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// ─── Edge Rendering ───

function getEdgePath(edge: DagEdge): string {
  const sourceNode = nodes.value.find(n => n.id === edge.source)
  const targetNode = nodes.value.find(n => n.id === edge.target)
  if (!sourceNode || !targetNode) return ''

  const x1 = (sourceNode.position?.x || 0) + getNodeWidth(sourceNode)
  const y1 = (sourceNode.position?.y || 0) + 35
  const x2 = targetNode.position?.x || 0
  const y2 = (targetNode.position?.y || 0) + 35

  const dx = Math.abs(x2 - x1) * 0.4
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

function getEdgeMidpoint(edge: DagEdge): { x: number; y: number } {
  const sourceNode = nodes.value.find(n => n.id === edge.source)
  const targetNode = nodes.value.find(n => n.id === edge.target)
  if (!sourceNode || !targetNode) return { x: 0, y: 0 }

  return {
    x: ((sourceNode.position?.x || 0) + (targetNode.position?.x || 0)) / 2 + getNodeWidth(sourceNode) / 2,
    y: ((sourceNode.position?.y || 0) + (targetNode.position?.y || 0)) / 2 + 35,
  }
}

function getNodeWidth(_node: DagNode): number {
  return 120
}

function getNodeShape(node: DagNode): string {
  const shapes: Record<string, string> = {
    start: 'ellipse',
    end: 'rect',
    condition: 'diamond',
    default: 'rect',
  }
  return shapes[node.type] || shapes.default
}

function hasConfigurableFields(type: string): boolean {
  return ['agent', 'capability', 'delay', 'event', 'humanApproval', 'humanEdit', 'humanReview', 'humanUpload', 'humanDecision'].includes(type)
}

function getConfigLabel(type: string): string {
  const labels: Record<string, string> = {
    agent: 'Agent 代码',
    capability: '能力名称',
    delay: '延迟(ms)',
    event: '事件类型',
    humanApproval: '审批配置',
    humanEdit: '编辑配置',
    humanReview: '审核配置',
    humanUpload: '上传配置',
    humanDecision: '决策配置',
  }
  return labels[type] || '节点配置 (JSON)'
}

// ─── Zoom ───

function zoomIn() {
  zoom.value = Math.min(3, zoom.value + 0.2)
}

function zoomOut() {
  zoom.value = Math.max(0.3, zoom.value - 0.2)
}

function resetZoom() {
  zoom.value = 1
}

// ─── Delete ───

function deleteSelected() {
  if (selectedNode.value) {
    nodes.value = nodes.value.filter(n => n.id !== selectedNode.value!.id)
    edges.value = edges.value.filter(e => e.source !== selectedNode.value!.id && e.target !== selectedNode.value!.id)
    selectedNode.value = null
  }
  updateGraph()
}

function clearCanvas() {
  nodes.value = []
  edges.value = []
  selectedNode.value = null
  selectedEdge.value = null
  updateGraph()
}

// ─── Save ───

async function saveDraft() {
  await save('draft')
}

async function saveAndActivate() {
  if (!isValid.value) return
  await save('active')
}

async function save(status: string) {
  saving.value = true
  try {
    const data: WorkflowDefinition = {
      code: definition.value.code || `${Date.now()}`,
      name: definition.value.name || 'Untitled Workflow',
      version: definition.value.version || '1.0.0',
      description: definition.value.description,
      trigger: definition.value.trigger || 'manual',
      category: definition.value.category,
      graph: { nodes: nodes.value, edges: edges.value },
      status,
    }

    let result: WorkflowDefinition
    if (isEditing.value && definition.value.id) {
      result = await workflowService.updateDefinition(definition.value.id, data)
    } else {
      result = await workflowService.createDefinition(data)
    }

    isEditing.value = true
    definition.value = result
    emit('saved', result)
  } finally {
    saving.value = false
  }
}

// ─── Load existing definition ───

async function loadDefinition(id: string) {
  try {
    const def = await workflowService.getDefinition(id)
    definition.value = def
    isEditing.value = true

    const graph = typeof def.graph === 'string' ? JSON.parse(def.graph) : def.graph
    if (graph?.nodes) nodes.value = graph.nodes
    if (graph?.edges) edges.value = graph.edges
  } catch (err: any) {
    console.error('Failed to load definition:', err)
  }
}

onMounted(async () => {
  if (props.definitionId) {
    await loadDefinition(props.definitionId)
  }
})
</script>

<style scoped>
.workflow-studio {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
}

.studio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #333;
  background: #16213e;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
}

.workflow-meta {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge.active { background: #4CAF50; color: #fff; }
.badge.draft { background: #FF9800; color: #fff; }
.badge.disabled { background: #666; color: #fff; }

.version {
  color: #888;
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.studio-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ─── Palette ─── */

.node-palette {
  width: 160px;
  border-right: 1px solid #333;
  padding: 12px;
  overflow-y: auto;
  background: #16213e;
}

.node-palette h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #aaa;
}

.palette-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: grab;
  transition: background 0.2s;
}

.palette-item:hover {
  background: rgba(255,255,255,0.1);
}

.node-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
}

.node-label {
  font-size: 13px;
}

/* ─── Canvas ─── */

.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  align-items: center;
}

.toolbar-btn {
  background: #333;
  border: 1px solid #555;
  color: #e0e0e0;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-status {
  margin-left: auto;
  font-size: 12px;
}

.toolbar-status .valid { color: #4CAF50; }
.toolbar-status .invalid { color: #F44336; }

.canvas-container {
  flex: 1;
  overflow: auto;
  position: relative;
  background: #0d1117;
}

.canvas-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #555;
  text-align: center;
}

.canvas-svg {
  min-width: 1200px;
  min-height: 800px;
}

/* ─── SVG Nodes ─── */

.node-group {
  cursor: pointer;
}

.node-group:hover .node-rect {
  filter: brightness(1.2);
}

.node-group.selected .node-rect {
  stroke-width: 3;
  filter: brightness(1.3);
}

.node-name {
  fill: #e0e0e0;
  font-size: 12px;
  pointer-events: none;
}

.port {
  fill: #555;
  stroke: #888;
  stroke-width: 1;
  cursor: crosshair;
}

.port:hover {
  fill: #4CAF50;
  stroke: #4CAF50;
}

/* ─── SVG Edges ─── */

.edge-line {
  fill: none;
  stroke: #555;
  stroke-width: 2;
  cursor: pointer;
}

.edge-line:hover,
.edge-line.selected {
  stroke: #4CAF50;
  stroke-width: 3;
}

.edge-label {
  fill: #888;
  font-size: 11px;
}

.temp-edge {
  stroke: #4CAF50;
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

/* ─── Config Panel ─── */

.config-panel {
  width: 280px;
  border-left: 1px solid #333;
  padding: 12px;
  overflow-y: auto;
  background: #16213e;
}

.config-panel h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #aaa;
}

.config-empty {
  color: #555;
  text-align: center;
  padding: 20px;
}

.config-field {
  margin-bottom: 12px;
}

.config-field label {
  display: block;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 4px;
}

.config-field input,
.config-field textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 13px;
  box-sizing: border-box;
}

.config-field input.readonly {
  color: #888;
}

.config-field textarea {
  resize: vertical;
  font-family: monospace;
}

/* ─── Buttons ─── */

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-secondary {
  background: #333;
  color: #e0e0e0;
  border: 1px solid #555;
}
</style>
