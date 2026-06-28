<template>
  <div class="r11-drift-monitor">
    <div class="controls">
      <label class="domain-select">
        Domain:
        <select v-model="selectedDomain" @change="loadTimeline">
          <option value="">All</option>
          <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <button class="record-btn" @click="recordSnapshot">Record Snapshot</button>
      <button class="clear-btn" @click="clearHistory">Clear</button>
      <span class="record-count">Records: {{ data?.totalRecords ?? 0 }}</span>
    </div>

    <!-- Stats Summary -->
    <div class="summary-bar" v-if="data">
      <span class="stat fidelity">
        Latest Fidelity: {{ (data.latestFidelity * 100).toFixed(1) }}%
      </span>
      <span class="stat regression" v-if="data.regressionCount > 0">
        Regression Events: {{ data.regressionCount }}
      </span>
      <span class="stat stable" v-else>
        Stable: No regressions
      </span>
    </div>

    <!-- Timeline Chart (simple bar) -->
    <div class="timeline-chart" ref="chartRef" v-if="data && data.trend.length > 0">
      <svg :width="chartWidth" :height="chartHeight" class="drift-svg">
        <!-- Y axis label -->
        <text x="10" y="15" fill="#78909c" font-size="10" font-family="monospace">1.0</text>
        <text x="10" y="115" fill="#78909c" font-size="10" font-family="monospace">0.0</text>

        <!-- Fidelity bars -->
        <g v-for="(point, i) in visiblePoints" :key="i">
          <!-- Bar -->
          <rect
            :x="barX(i)"
            :y="barY(point.fidelityScore)"
            :width="barWidth"
            :height="barHeight(point.fidelityScore)"
            :fill="barColor(point)"
            rx="2"
            ry="2"
            class="fidelity-bar"
            @mouseenter="hovered = i"
            @mouseleave="hovered = null"
          />
          <!-- Drift markers -->
          <circle
            v-if="point.projectionDrift"
            :cx="barX(i) + barWidth / 2"
            :cy="12"
            r="4"
            fill="#ff9800"
            title="Projection Drift"
          />
          <circle
            v-if="point.replayDrift"
            :cx="barX(i) + barWidth / 2"
            :cy="4"
            r="4"
            fill="#f44336"
            title="Replay Drift"
          />
        </g>
      </svg>

      <!-- Tooltip -->
      <div class="tooltip" v-if="hovered !== null && visiblePoints[hovered]">
        <div class="tooltip-fidelity">
          Fidelity: {{ (visiblePoints[hovered].fidelityScore * 100).toFixed(1) }}%
        </div>
        <div v-if="visiblePoints[hovered].projectionDrift" class="drift-tag projection">
          ⚡ Projection Drift
        </div>
        <div v-if="visiblePoints[hovered].replayDrift" class="drift-tag replay">
          ⚡ Replay Drift
        </div>
        <div v-if="visiblePoints[hovered].regression" class="drift-tag regression">
          📉 Regression
        </div>
      </div>
    </div>

    <div class="empty-state" v-else>
      No drift data collected. Click "Record Snapshot" to begin.
    </div>

    <!-- Legend -->
    <div class="legend" v-if="data && data.trend.length > 0">
      <span class="legend-item"><span class="dot" style="background:#4caf50"/> Stable</span>
      <span class="legend-item"><span class="dot" style="background:#ff9800"/> Projection Drift</span>
      <span class="legend-item"><span class="dot" style="background:#f44336"/> Replay Drift</span>
      <span class="legend-item"><span class="dot" style="background:#e91e63"/> Regression</span>
    </div>

    <!-- Adapter Changes -->
    <div class="adapter-changes" v-if="data && data.adapterChanges.length > 0">
      <div class="section-title">Adapter Version Changes</div>
      <div class="change-list">
        <div v-for="(chg, i) in data.adapterChanges" :key="i" class="change-row">
          <span>{{ chg.oldVersion }} → {{ chg.newVersion }}</span>
          <span :class="chg.degraded ? 'badge-regression' : 'badge-stable'">
            {{ chg.degraded ? 'Degraded' : 'Stable' }}
            ({{ (chg.delta * 100).toFixed(1) }}%)
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue'
import { fetchDriftTimeline, recordDriftSnapshot, clearDriftHistory } from '../../components/r11/r11-api'

interface DriftTimelinePoint {
  fromTimestamp: number
  toTimestamp: number
  fidelityScore: number
  projectionDrift: boolean
  replayDrift: boolean
  regression: boolean
}

interface AdapterChangeResult {
  stable: boolean
  degraded: boolean
  versionChanged: boolean
  oldVersion: string
  newVersion: string
  delta: number
}

interface DriftTimelineData {
  domains: string[]
  totalRecords: number
  latestFidelity: number
  trend: DriftTimelinePoint[]
  regressionCount: number
  adapterChanges: AdapterChangeResult[]
}

export default defineComponent({
  name: 'DriftMonitor',
  props: {
    domains: {
      type: Array as () => string[],
      default: () => [],
    },
  },
  setup(props) {
    const selectedDomain = ref('')
    const data = ref<DriftTimelineData | null>(null)
    const hovered = ref<number | null>(null)

    const CHART_WIDTH = 600
    const CHART_HEIGHT = 120
    const MARGIN_X = 30
    const MAX_BARS = 50

    const chartWidth = ref(CHART_WIDTH)
    const chartHeight = ref(CHART_HEIGHT)

    const visiblePoints = computed(() => {
      if (!data.value) return []
      return data.value.trend.slice(-MAX_BARS)
    })

    const barWidth = computed(() => {
      const w = data.value?.trend?.length ?? 1
      const count = Math.min(w, MAX_BARS)
      return Math.max(4, (CHART_WIDTH - MARGIN_X) / count - 2)
    })

    function barX(i: number): number {
      return MARGIN_X + i * (barWidth.value + 2)
    }

    function barY(score: number): number {
      return CHART_HEIGHT - 10 - (score * (CHART_HEIGHT - 20))
    }

    function barHeight(score: number): number {
      return Math.max(2, score * (CHART_HEIGHT - 20))
    }

    function barColor(point: DriftTimelinePoint): string {
      if (point.regression) return '#e91e63'
      if (point.replayDrift) return '#f44336'
      if (point.projectionDrift) return '#ff9800'
      return '#4caf50'
    }

    async function loadTimeline() {
      const res = await fetch('/api/r11/drift/timeline', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        params: selectedDomain.value ? { domain: selectedDomain.value } : {},
      })
      if (res.ok) {
        data.value = await res.json()
      }
    }

    async function recordSnapshot() {
      const domain = selectedDomain.value || props.domains[0]
      if (!domain) return

      // Use a simple test graph for demonstration
      const rawGraph = {
        name: 'test-run',
        nodes: new Map([['n1', { id: 'n1', type: 'agent' }]]),
        edges: [],
      }

      const res = await fetch('/api/r11/drift/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, rawGraph, runId: `run-${Date.now()}` }),
      })
      if (res.ok) {
        await loadTimeline()
      }
    }

    async function clearHistory() {
      await fetch('/api/r11/drift/clear', { method: 'POST' })
      data.value = null
    }

    // Shim for fetch with params
    async function fetch(url: string, opts: RequestInit & { params?: Record<string, string> } = {}): Promise<Response> {
      const { params, ...rest } = opts
      let u = url
      if (params) {
        const qs = new URLSearchParams(params).toString()
        u += '?' + qs
      }
      return globalThis.fetch(u, rest)
    }

    onMounted(loadTimeline)

    return {
      selectedDomain,
      data,
      hovered,
      chartWidth,
      chartHeight,
      visiblePoints,
      barWidth,
      barX, barY, barHeight, barColor,
      loadTimeline,
      recordSnapshot,
      clearHistory,
    }
  },
})
</script>

<style scoped>
.r11-drift-monitor {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 13px;
}
.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.controls select {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
}
.record-btn, .clear-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
}
.record-btn { background: #1565c0; color: #fff; }
.clear-btn { background: #424242; color: #e0e0e0; }
.record-count { margin-left: auto; color: #78909c; font-size: 11px; }

.summary-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px;
  background: #16213e;
  border-radius: 4px;
}
.stat { font-size: 12px; }
.stat.fidelity { color: #4fc3f7; }
.stat.regression { color: #f44336; }
.stat.stable { color: #4caf50; }

.timeline-chart {
  background: #0d1117;
  border-radius: 4px;
  padding: 8px;
  position: relative;
  margin-bottom: 8px;
}
.drift-svg {
  display: block;
}
.fidelity-bar {
  cursor: pointer;
  transition: opacity 0.2s;
}
.fidelity-bar:hover { opacity: 0.7; }

.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
  margin-bottom: 4px;
}
.tooltip-fidelity { color: #e0e0e0; }
.drift-tag { font-size: 10px; margin-top: 2px; }
.drift-tag.projection { color: #ff9800; }
.drift-tag.replay { color: #f44336; }
.drift-tag.regression { color: #e91e63; }

.empty-state {
  text-align: center;
  padding: 40px;
  color: #546e7a;
}

.legend {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 11px;
  color: #78909c;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.adapter-changes {
  margin-top: 12px;
}
.section-title {
  color: #78909c;
  font-size: 11px;
  margin-bottom: 6px;
}
.change-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.change-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: #16213e;
  border-radius: 4px;
  font-size: 11px;
}
.badge-regression { color: #f44336; }
.badge-stable { color: #4caf50; }
</style>
