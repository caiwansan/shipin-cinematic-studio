<template>
  <div class="r11-console">
    <div class="console-header">
      <h1>R11 Observability Console</h1>
      <span class="subtitle">System Microscope — Passive Visualization Layer</span>
    </div>

    <!-- Tab navigation -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Structure View -->
    <div class="tab-content" v-if="activeTab === 'structure'">
      <StructureView
        :domains="domains"
        @load-graph="handleLoadGraph"
        ref="structureViewRef"
      />
    </div>

    <!-- Diff Timeline View -->
    <div class="tab-content" v-if="activeTab === 'diff'">
      <DiffTimelineView
        :domains="domains"
        @run-diff="handleRunDiff"
        ref="diffViewRef"
      />
    </div>

    <!-- Replay Inspector View -->
    <div class="tab-content" v-if="activeTab === 'replay'">
      <ReplayView
        :domains="domains"
        @run-replay="handleRunReplay"
        ref="replayViewRef"
      />
    </div>

    <!-- Drift Monitor (Phase 3B — overlay tab, equal-level metric layer) -->
    <div class="tab-content" v-if="activeTab === 'drift'">
      <DriftMonitor :domains="domains" />
    </div>

    <!-- Stability Dashboard (Phase 4 — control layer) -->
    <div class="tab-content" v-if="activeTab === 'stability'">
      <StabilityDashboard />
    </div>

    <!-- Cause Panel (Phase 5 — causal attribution) -->
    <div class="tab-content" v-if="activeTab === 'causal'">
      <CausePanel />
    </div>

    <!-- Footer status -->
    <div class="console-footer">
      <span>Phase 3A+3B — R11 == Perception + Time-Stability</span>
      <span class="status">Status: Active (derived + passive + non-interpreting)</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import StructureView from './StructureView.vue'
import DiffTimelineView from './DiffTimelineView.vue'
import ReplayView from './ReplayView.vue'
import DriftMonitor from '../../components/r11/DriftMonitor.vue'
import StabilityDashboard from '../../components/r11/StabilityDashboard.vue'
import CausePanel from '../../components/r11/CausePanel.vue'
import { fetchGraphView, fetchDiffView, fetchReplayView, fetchFidelity } from '../../../components/r11/r11-api'

interface Tab {
  id: string
  label: string
}

export default defineComponent({
  name: 'R11Console',
  components: { StructureView, DiffTimelineView, ReplayView },
  setup() {
    const tabs: Tab[] = [
      { id: 'structure', label: 'Structure Viewer' },
      { id: 'diff', label: 'Diff Timeline' },
      { id: 'replay', label: 'Replay Inspector' },
      { id: 'drift', label: 'Drift Monitor ⏱' },
      { id: 'stability', label: 'Stability 🔒' },
      { id: 'causal', label: 'Causal 🔍' },
    ]

    const activeTab = ref('structure')
    const domains = ref<string[]>(['agent-graph', 'decision-graph', 'character-image-dag', 'prompt-version-graph'])

    // These will hold sample test graphs for frontend demo
    // In production, these come from the runtime
    const sampleGraphs = ref<Map<string, any>>(new Map())

    const structureViewRef = ref<any>(null)
    const diffViewRef = ref<any>(null)
    const replayViewRef = ref<any>(null)

    onMounted(() => {
      // Load sample data for agent-graph by default
      handleLoadGraph({ domain: 'agent-graph', viewMode: 'normalized' })
    })

    async function handleLoadGraph({ domain, viewMode }: { domain: string; viewMode: string }) {
      const graph = sampleGraphs.value.get(domain)
      if (!graph) return

      const data = await fetchGraphView(domain, graph, viewMode as 'normalized' | 'raw')
      const f = await fetchFidelity(domain, graph)

      if (structureViewRef.value) {
        structureViewRef.value.updateGraph(data, f)
      }
    }

    async function handleRunDiff({ domain }: { domain: string }) {
      // Placeholder — in production, loads baseline vs current from runtime snapshots
      if (diffViewRef.value) {
        diffViewRef.value.updateDiff(null)
      }
    }

    async function handleRunReplay({ domain }: { domain: string }) {
      const graph = sampleGraphs.value.get(domain)
      if (!graph) return

      const data = await fetchReplayView(domain, graph, 1)

      if (replayViewRef.value) {
        replayViewRef.value.updateReplay(data)
      }
    }

    return {
      tabs,
      activeTab,
      domains,
      sampleGraphs,
      structureViewRef,
      diffViewRef,
      replayViewRef,
      handleLoadGraph,
      handleRunDiff,
      handleRunReplay,
    }
  },
})
</script>

<style scoped>
.r11-console {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
}
.console-header {
  margin-bottom: 20px;
}
.console-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: bold;
  color: #e0e0e0;
}
.subtitle {
  font-size: 12px;
  color: #78909c;
  margin-top: 4px;
  display: block;
}
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #333;
}
.tab-btn {
  background: transparent;
  color: #78909c;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-family: monospace;
  font-size: 13px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab-btn:hover {
  color: #e0e0e0;
}
.tab-btn.active {
  color: #4fc3f7;
  border-bottom-color: #4fc3f7;
}
.tab-content {
  min-height: 500px;
}
.console-footer {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #546e7a;
}
.status {
  color: #4caf50;
}
</style>
