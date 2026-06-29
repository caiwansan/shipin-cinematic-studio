<template>
  <div class="trace-viewer">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <input v-model="filterProject" placeholder="Project ID..." class="filter-input" />
      <select v-model="filterAgent" class="filter-select">
        <option value="">All Agents</option>
        <option v-for="a in availableAgents" :key="a" :value="a">{{ a }}</option>
      </select>
      <button @click="loadTraces" class="btn-primary">Refresh</button>
      <button @click="runBenchmark" class="btn-secondary">Run Benchmark</button>
    </div>

    <!-- Summary Cards -->
    <div v-if="summary" class="summary-row">
      <div class="summary-card">
        <span class="sc-label">Total Executions</span>
        <span class="sc-value">{{ summary.totalTraces }}</span>
      </div>
      <div class="summary-card">
        <span class="sc-label">Total Tokens</span>
        <span class="sc-value">{{ formatNum(summary.totalTokens) }}</span>
      </div>
      <div class="summary-card">
        <span class="sc-label">Avg Latency</span>
        <span class="sc-value">{{ summary.avgLatencyMs }}ms</span>
      </div>
      <div class="summary-card">
        <span class="sc-label">Success Rate</span>
        <span class="sc-value" :class="summary.successRate < 80 ? 'rate-warn' : 'rate-ok'">{{ summary.successRate }}%</span>
      </div>
      <div class="summary-card">
        <span class="sc-label">Total Cost</span>
        <span class="sc-value">${{ summary.totalCost.toFixed(4) }}</span>
      </div>
      <!-- Regression Badge -->
      <div v-if="regression" class="summary-card regression-badge regression-yes">⚠ Regression</div>
      <div v-else class="summary-card regression-badge regression-ok">✅ Baseline Passed</div>
    </div>

    <!-- Trace List -->
    <div class="trace-list">
      <div class="trace-header">
        <div class="trace-cell th-cell">Agent</div>
        <div class="trace-cell th-cell">Provider / Model</div>
        <div class="trace-cell th-cell tokens-cell">Tokens</div>
        <div class="trace-cell th-cell">Latency</div>
        <div class="trace-cell th-cell">Status</div>
        <div class="trace-cell th-cell time-cell">Timestamp</div>
      </div>
      <div
        v-for="trace in traces"
        :key="trace.traceId"
        class="trace-row"
        :class="{ 'trace-row--selected': selectedTrace?.traceId === trace.traceId }"
        @click="selectTrace(trace)"
      >
        <div class="trace-cell agent-cell">{{ trace.agent }}</div>
        <div class="trace-cell">{{ trace.provider }}/{{ trace.model }}</div>
        <div class="trace-cell tokens-cell">{{ formatNum(trace.totalTokens) }}</div>
        <div class="trace-cell">{{ trace.latencyMs }}ms</div>
        <div class="trace-cell">
          <span class="status-dot" :class="trace.status === 'success' ? 'dot-ok' : 'dot-fail'"></span>
          {{ trace.status }}
        </div>
        <div class="trace-cell time-cell">{{ formatTime(trace.createdAt) }}</div>
      </div>
      <div v-if="!traces.length && !loading" class="trace-empty">
        No traces found. Select a project and click Refresh.
      </div>
      <div v-if="loading" class="trace-empty">Loading traces...</div>
    </div>

    <!-- Trace Detail (expanded) -->
    <div v-if="selectedTrace" class="trace-detail">
      <div class="detail-header">
        <h4 class="detail-title">Trace: <code>{{ selectedTrace.traceId.slice(0, 12) }}...</code></h4>
        <button class="btn-close" @click="selectedTrace = null">✕</button>
      </div>

      <!-- Timeline -->
      <div class="detail-section">
        <h5 class="detail-section-title">⏱ Execution Timeline</h5>
        <TraceTimeline :stages="timelineStages" />
      </div>

      <!-- 3-column detail panels -->
      <div class="detail-grid">
        <!-- Prompt Panel -->
        <div class="detail-panel">
          <div class="detail-panel-header">
            <h5>📝 Prompt</h5>
            <button class="btn-copy" @click="copyPrompt">Copy</button>
          </div>
          <div class="info-row"><span class="label">Key</span><code class="value">{{ selectedTrace.promptKey }}</code></div>
          <div class="info-row"><span class="label">Version</span><span class="value">{{ selectedTrace.promptVersion }}</span></div>
          <div class="prompt-body-section">
            <button class="btn-toggle-body" @click="promptBodyExpanded = !promptBodyExpanded">
              {{ promptBodyExpanded ? '▾ Hide' : '▸ Show' }} Prompt Body
            </button>
            <div v-if="promptBodyExpanded" class="prompt-body">
              {{ selectedTrace.promptBody || '// No prompt body recorded' }}
            </div>
          </div>
        </div>

        <!-- Output Panel -->
        <div class="detail-panel">
          <h5>📊 Output</h5>
          <div class="info-row"><span class="label">Entities</span><span class="value">{{ outputStats.entityCount }}</span></div>
          <div class="info-row"><span class="label">Relations</span><span class="value">{{ outputStats.relationCount }}</span></div>
          <div class="info-row">
            <span class="label">Validation</span>
            <span :class="['badge', outputStats.validation === 'PASS' ? 'badge-ok' : 'badge-fail']">{{ outputStats.validation }}</span>
          </div>
          <div class="info-row">
            <span class="label">Parser</span>
            <span class="badge badge-muted">{{ outputStats.parserStage }}</span>
          </div>
          <div class="raw-json-section">
            <button class="btn-toggle-body" @click="rawJsonExpanded = !rawJsonExpanded">
              {{ rawJsonExpanded ? '▾ Hide' : '▸ Show' }} Raw JSON
            </button>
            <pre v-if="rawJsonExpanded" class="raw-json">{{ formatJson(selectedTrace.rawOutput) }}</pre>
          </div>
        </div>

        <!-- Usage Panel -->
        <div class="detail-panel">
          <h5>💰 Usage</h5>
          <div class="info-row"><span class="label">Provider</span><span class="value">{{ selectedTrace.provider }}</span></div>
          <div class="info-row"><span class="label">Model</span><span class="value">{{ selectedTrace.model }}</span></div>
          <div class="info-row"><span class="label">Prompt Tokens</span><span class="value">{{ formatNum(selectedTrace.promptTokens) }}</span></div>
          <div class="info-row"><span class="label">Completion</span><span class="value">{{ formatNum(selectedTrace.completionTokens) }}</span></div>
          <div class="info-row"><span class="label">Total</span><span class="value">{{ formatNum(selectedTrace.totalTokens) }}</span></div>
          <div class="info-row"><span class="label">Cost</span><span class="value">${{ selectedTrace.cost?.toFixed(6) }}</span></div>
          <div class="info-row"><span class="label">Latency</span><span class="value">{{ selectedTrace.latencyMs }}ms</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TraceTimeline from './TraceTimeline.vue'

const filterProject = ref('')
const filterAgent = ref('')
const traces = ref<any[]>([])
const summary = ref<any>(null)
const selectedTrace = ref<any>(null)
const regression = ref(false)
const availableAgents = ref<string[]>([])
const loading = ref(false)
const promptBodyExpanded = ref(false)
const rawJsonExpanded = ref(false)

async function loadTraces() {
  loading.value = true
  try {
    let url = '/api/geo/traces?limit=20'
    if (filterProject.value) {
      url += '&projectId=' + encodeURIComponent(filterProject.value)
    }
    // Also load summary
    if (filterProject.value) {
      const sumRes = await $_authFetch(`/api/geo/traces/project/${encodeURIComponent(filterProject.value)}/summary`).catch(() => null)
      if (sumRes?.data) summary.value = sumRes.data
    }
    const res = await $_authFetch(url)
    if (res?.data?.traces) {
      traces.value = res.data.traces
      availableAgents.value = [...new Set(res.data.traces.map((t: any) => t.agent).filter(Boolean))]
    }
  } finally {
    loading.value = false
  }
}

const timelineStages = computed(() => {
  if (!selectedTrace.value) return []
  return [
    { name: 'Prompt Render', durationMs: null, status: 'na' as const },
    { name: 'Provider Resolve', durationMs: null, status: 'na' as const },
    {
      name: 'LLM Request',
      durationMs: selectedTrace.value.latencyMs,
      status: selectedTrace.value.status === 'success' ? 'success' as const : 'fail' as const,
      retry: selectedTrace.value.retryCount || 0,
    },
    { name: 'Output Parser', durationMs: null, status: 'na' as const },
    { name: 'Schema Validator', durationMs: null, status: 'na' as const },
    { name: 'Persistence', durationMs: null, status: 'na' as const },
  ]
})

const outputStats = computed(() => {
  const raw = selectedTrace.value
  return {
    entityCount: raw?.entityCount ?? raw?.output?.entities?.length ?? '—',
    relationCount: raw?.relationCount ?? raw?.output?.relations?.length ?? '—',
    validation: raw?.validationStatus || (raw?.status === 'success' ? 'PASS' : 'FAIL'),
    parserStage: raw?.parserStage || 'Extract JSON',
  }
})

function selectTrace(trace: any) {
  if (selectedTrace.value?.traceId === trace.traceId) {
    selectedTrace.value = null
  } else {
    selectedTrace.value = trace
    promptBodyExpanded.value = false
    rawJsonExpanded.value = false
  }
}

async function copyPrompt() {
  if (!selectedTrace.value?.promptKey) return
  try {
    await navigator.clipboard.writeText(
      selectedTrace.value.promptBody || selectedTrace.value.promptKey
    )
  } catch {
    // fallback
  }
}

async function runBenchmark() {
  // Placeholder: triggers benchmark
  console.log('Benchmark requested')
}

function formatNum(n: number) { return n?.toLocaleString() || '0' }
function formatTime(t: string) { return t ? new Date(t).toLocaleTimeString() : '' }
function formatJson(obj: any): string {
  if (!obj) return '// No output data'
  try {
    return JSON.stringify(typeof obj === 'string' ? JSON.parse(obj) : obj, null, 2)
  } catch {
    return String(obj)
  }
}

// Expose for parent use
defineExpose({ loadTraces })
</script>

<style scoped>
.trace-viewer { padding: 16px; color: #e0e0e0; }

/* Filter Bar */
.filter-bar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.filter-input, .filter-select {
  padding: 6px 10px; border: 1px solid #333; border-radius: 6px;
  background: #1a1a2e; color: #e0e0e0; font-size: 13px;
}
.filter-input { flex: 1; }
.filter-input::placeholder { color: #555; }
.filter-input:focus, .filter-select:focus { outline: none; border-color: #2563eb; }
.btn-primary, .btn-secondary {
  padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-weight: 500; transition: opacity 0.15s;
}
.btn-primary:hover, .btn-secondary:hover { opacity: 0.85; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-secondary { background: #2d3748; color: #e0e0e0; }
.btn-close { background: none; border: none; color: #64748b; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
.btn-close:hover { color: #e0e0e0; background: rgba(255,255,255,0.05); }

/* Summary Cards */
.summary-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.summary-card {
  background: #1e293b; border-radius: 8px; padding: 10px 14px; min-width: 110px;
  display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.03);
}
.sc-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
.sc-value { font-size: 18px; font-weight: 700; color: #e0e0e0; margin-top: 2px; }
.rate-ok { color: #22c55e; } .rate-warn { color: #f59e0b; }
.regression-badge { justify-content: center; align-items: center; }
.regression-yes { color: #ef4444; } .regression-ok { color: #22c55e; }

/* Trace List */
.trace-list { background: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03); }
.trace-header {
  display: grid; grid-template-columns: 1fr 2fr 1fr 80px 100px 80px;
  padding: 8px 14px; background: #162032; font-size: 11px; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #2d3748;
}
.th-cell { font-weight: 600; }
.trace-row {
  display: grid; grid-template-columns: 1fr 2fr 1fr 80px 100px 80px;
  padding: 8px 14px; border-bottom: 1px solid #2d3748; cursor: pointer;
  font-size: 12px; color: #cbd5e1; align-items: center; transition: background 0.1s;
}
.trace-row:hover { background: #263548; }
.trace-row--selected { background: #1a3a5a; border-left: 3px solid #2563eb; }
.trace-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-cell { font-weight: 600; }
.tokens-cell { text-align: right; }
.time-cell { text-align: right; }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.dot-ok { background: #22c55e; box-shadow: 0 0 4px rgba(34,197,94,0.4); }
.dot-fail { background: #ef4444; box-shadow: 0 0 4px rgba(239,68,68,0.4); }
.trace-empty { padding: 24px; text-align: center; color: #64748b; font-size: 13px; }

/* Trace Detail */
.trace-detail { background: #1e293b; border-radius: 8px; padding: 16px; margin-top: 16px; border: 1px solid rgba(37,99,235,0.2); }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.detail-title { font-size: 14px; color: #94a3b8; margin: 0; }
.detail-title code { color: #4ecca3; font-family: monospace; }
.detail-section { margin-bottom: 16px; }
.detail-section-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; }

.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.detail-panel { background: #0f172a; border-radius: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.03); }
.detail-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.detail-panel h5 { font-size: 12px; color: #64748b; margin: 0 0 8px; }
.info-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
.info-row .label { color: #64748b; }
.info-row .value { color: #e0e0e0; }
.info-row code.value { font-family: monospace; color: #4ecca3; }

.badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #334155; color: #cbd5e1; }
.badge-ok { background: #166534; color: #bbf7d0; }
.badge-fail { background: #7f1d1d; color: #fca5a5; }
.badge-muted { background: #1e293b; color: #94a3b8; }

.btn-copy { font-size: 10px; padding: 2px 8px; border-radius: 4px; background: #334155; color: #94a3b8; border: none; cursor: pointer; }
.btn-copy:hover { background: #475569; color: #e0e0e0; }

.btn-toggle-body { font-size: 11px; color: #64748b; background: none; border: none; cursor: pointer; padding: 4px 0; }
.btn-toggle-body:hover { color: #94a3b8; }

.prompt-body-section { margin-top: 8px; }
.prompt-body {
  margin-top: 4px; padding: 8px; background: #0a0f1a; border-radius: 4px;
  font-size: 11px; color: #cbd5e1; font-family: monospace; white-space: pre-wrap;
  max-height: 200px; overflow-y: auto; border: 1px solid #1e293b;
}

.raw-json-section { margin-top: 8px; }
.raw-json {
  margin-top: 4px; padding: 8px; background: #0a0f1a; border-radius: 4px;
  font-size: 11px; color: #94a3b8; font-family: monospace; white-space: pre;
  max-height: 200px; overflow: auto; border: 1px solid #1e293b;
}
</style>
