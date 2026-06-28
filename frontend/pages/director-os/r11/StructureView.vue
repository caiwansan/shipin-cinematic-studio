<template>
  <div class="r11-structure-view">
    <div class="controls">
      <label class="domain-select">
        Graph:
        <select v-model="selectedDomain">
          <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label class="view-toggle">
        View:
        <select v-model="viewMode">
          <option value="normalized">Normalized</option>
          <option value="raw">Raw</option>
        </select>
      </label>
      <span class="fidelity-badge" v-if="fidelity">
        Fidelity: {{ (fidelity.score * 100).toFixed(1) }}%
      </span>
    </div>

    <div class="graph-container" v-if="graphData">
      <GraphRenderer :data="graphData" @node-click="onNodeClick" />
    </div>
    <div class="empty-state" v-else>
      Select a domain to view graph structure
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import GraphRenderer from '../../../components/r11/GraphRenderer.vue'
import type { GraphRenderData, LayoutNode, FidelityInfo } from '../../../components/r11/r11-api'

export default defineComponent({
  name: 'StructureView',
  components: { GraphRenderer },
  props: {
    domains: {
      type: Array as () => string[],
      required: true,
    },
  },
  emits: ['loadGraph'],
  setup(props, { emit }) {
    const selectedDomain = ref(props.domains[0] || '')
    const viewMode = ref<'normalized' | 'raw'>('normalized')
    const graphData = ref<GraphRenderData | null>(null)
    const fidelity = ref<FidelityInfo | null>(null)

    watch([selectedDomain, viewMode], ([domain]) => {
      emit('loadGraph', { domain, viewMode: viewMode.value })
    })

    function updateGraph(data: GraphRenderData | null, f: FidelityInfo | null) {
      graphData.value = data
      fidelity.value = f
    }

    function onNodeClick(node: LayoutNode) {
      // Passive — no interpretation, just expose node data
      console.log('[R11] Node clicked:', node.id, node.type, node.rawSnippet)
    }

    return { selectedDomain, viewMode, graphData, fidelity, updateGraph, onNodeClick }
  },
})
</script>

<style scoped>
.r11-structure-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.controls {
  display: flex;
  gap: 16px;
  align-items: center;
}
.controls select {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
}
.fidelity-badge {
  margin-left: auto;
  background: #1b5e20;
  color: #4caf50;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}
.graph-container {
  background: #0d1117;
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
}
.empty-state {
  background: #0d1117;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: #546e7a;
  font-size: 14px;
}
</style>
