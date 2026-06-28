<template>
  <div class="r11-cause-panel">
    <div class="panel-header">
      <h2>Causal Attribution</h2>
      <span class="phase-tag">Phase 5</span>
      <button class="clear-btn" @click="clearAll">Clear</button>
    </div>

    <!-- Simulate drift input -->
    <div class="sim-section">
      <div class="sim-title">Simulate Drift Event</div>
      <div class="sim-controls">
        <label><input type="checkbox" v-model="simInput.projectionDrift" /> Projection Drift</label>
        <label><input type="checkbox" v-model="simInput.replayDrift" /> Replay Drift</label>
        <label><input type="checkbox" v-model="simInput.regression" /> Regression</label>
        <label><input type="checkbox" v-model="simInput.adapterVersionChanged" /> Adapter Changed</label>
      </div>
      <div class="sim-details">
        <label>Fidelity delta:
          <input type="number" step="0.01" v-model.number="simInput.fidelityDelta" class="num-input" />
        </label>
        <label>Old version:
          <input v-model="simInput.oldVersion" class="text-input" size="6" />
        </label>
        <label>New version:
          <input v-model="simInput.newVersion" class="text-input" size="6" />
        </label>
      </div>
      <button class="attr-btn" @click="attributeDrift">Attribute</button>
    </div>

    <!-- Causal Graph -->
    <div class="section" v-if="graph && graph.nodes.length > 0">
      <div class="section-title">
        Causal Graph ({{ graph.reportsCount }} events, {{ graph.nodes.length }} nodes)
      </div>
      <div class="layers-bar">
        <span v-for="layer in graph.layers" :key="layer" class="layer-tag">{{ layer }}</span>
      </div>

      <!-- Causal chain visualization -->
      <div class="causal-chain" v-for="(report, i) in reports" :key="i">
        <div class="chain-header">
          <span class="chain-id">{{ report.trace.driftId }}</span>
          <span :class="['impact-badge', report.impact]">{{ report.impact.toUpperCase() }}</span>
        </div>
        <div class="chain-nodes">
          <div
            v-for="(node, j) in report.trace.chain"
            :key="j"
            class="chain-node"
            :class="node.type"
          >
            <div class="node-type">{{ node.type }}</div>
            <div class="node-label">{{ node.label }}</div>
            <div class="node-detail" v-if="node.detail">{{ node.detail }}</div>
          </div>
          <!-- Arrow between nodes -->
          <div v-if="j < report.trace.chain.length - 1" class="chain-arrow">→</div>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else>
      No causal attribution data. Simulate a drift event to begin.
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'

interface CausalNode { id: string; type: string; label: string; detail?: string }
interface CausalEdge { from: string; to: string; reason: string }
interface CausalTrace { rootCause: CausalNode; chain: CausalNode[]; edges: CausalEdge[]; driftId: string; timestamp: number }
interface CausalReport { trace: CausalTrace; impactedLayers: string[]; impact: string }
interface UnifiedCausalGraph { nodes: CausalNode[]; edges: CausalEdge[]; reportsCount: number; layers: string[] }

export default defineComponent({
  name: 'CausePanel',
  setup() {
    const simInput = ref({
      projectionDrift: true,
      replayDrift: false,
      regression: false,
      fidelityDelta: -0.03,
      adapterVersionChanged: true,
      oldVersion: 'v1.0.0',
      newVersion: 'v2.0.0',
    })

    const reports = ref<CausalReport[]>([])
    const graph = ref<UnifiedCausalGraph | null>(null)

    async function attributeDrift() {
      const res = await fetch('/api/r11/causal/attribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simInput.value),
      })
      if (res.ok) {
        await loadReports()
      }
    }

    async function loadReports() {
      const [graphRes, repRes] = await Promise.all([
        fetch('/api/r11/causal/graph'),
        fetch('/api/r11/causal/reports'),
      ])
      if (graphRes.ok) graph.value = await graphRes.json()
      if (repRes.ok) reports.value = await repRes.json()
    }

    async function clearAll() {
      await fetch('/api/r11/causal/clear', { method: 'POST' })
      reports.value = []
      graph.value = null
    }

    return { simInput, reports, graph, attributeDrift, clearAll }
  },
})
</script>

<style scoped>
.r11-cause-panel {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  color: #e0e0e0;
  font-family: monospace;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.panel-header h2 { margin: 0; font-size: 18px; }
.phase-tag { background: #6a1b9a; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.clear-btn { margin-left: auto; background: #424242; color: #e0e0e0; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-family: monospace; }

.sim-section {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}
.sim-title { color: #ce93d8; font-size: 13px; font-weight: bold; margin-bottom: 8px; }
.sim-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}
.sim-controls label { font-size: 12px; color: #b0bec5; cursor: pointer; }
.sim-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #78909c;
}
.num-input, .text-input {
  background: #0d1117;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 3px;
  padding: 2px 6px;
  font-family: monospace;
  width: 70px;
}
.attr-btn {
  background: #6a1b9a;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 16px;
  cursor: pointer;
  font-family: monospace;
}

.section { margin-bottom: 16px; }
.section-title { color: #ce93d8; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 4px; }
.layers-bar { display: flex; gap: 6px; margin-bottom: 12px; }
.layer-tag { background: #0d2137; color: #90caf9; padding: 2px 8px; border-radius: 4px; font-size: 10px; }

.causal-chain {
  background: #16213e;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.chain-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chain-id { color: #78909c; font-size: 11px; }
.impact-badge { padding: 1px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
.impact-badge.high { background: #b71c1c; color: #f44336; }
.impact-badge.medium { background: #3e2723; color: #ff9800; }
.impact-badge.low { background: #1b5e20; color: #4caf50; }

.chain-nodes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.chain-node { padding: 6px 10px; border-radius: 4px; border: 1px solid #333; font-size: 11px; min-width: 100px; }
.chain-node.adapter { border-color: #1565c0; background: #0d2137; }
.chain-node.graph { border-color: #2e7d32; background: #0d2137; }
.chain-node.runtime { border-color: #e65100; background: #0d2137; }
.chain-node.policy { border-color: #c62828; background: #0d2137; }
.node-type { font-weight: bold; color: #90caf9; font-size: 10px; text-transform: uppercase; }
.node-label { margin-top: 2px; color: #e0e0e0; }
.node-detail { margin-top: 1px; color: #78909c; font-size: 10px; }
.chain-arrow { color: #546e7a; font-size: 16px; }

.empty-state { text-align: center; padding: 40px; color: #546e7a; }
</style>
