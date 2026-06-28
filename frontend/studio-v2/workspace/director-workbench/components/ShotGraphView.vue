<!--
ShotGraphView.vue
导演驾驶舱 — 镜头语法图（Cinematic Grammar System 可视化）
-->

<template>
  <div class="shot-graph" v-if="store.state.showGrammarGraph">
    <div class="graph-header">
      <span class="graph-title">🧩 镜头语法图</span>
      <button @click="store.toggleGrammarGraph()" class="close-btn">✕</button>
    </div>

    <div class="graph-body" ref="graphBodyRef">
      <svg :width="svgWidth" :height="svgHeight" class="graph-svg">
        <!-- 连线 -->
        <line
          v-for="(edge, i) in edges"
          :key="'edge-' + i"
          :x1="edge.x1" :y1="edge.y1"
          :x2="edge.x2" :y2="edge.y2"
          :stroke="edge.color"
          :stroke-width="edge.thickness"
          class="graph-edge"
        />

        <!-- 节点 -->
        <g
          v-for="(node, i) in nodes"
          :key="'node-' + i"
          :transform="`translate(${node.x}, ${node.y})`"
          class="graph-node-group"
          @click="store.selectShot(i)"
          :class="{ selected: i === store.state.currentShotIndex }"
        >
          <!-- 节点圆 -->
          <circle
            :r="node.radius"
            :fill="node.color"
            :stroke="i === store.state.currentShotIndex ? '#fff' : 'transparent'"
            stroke-width="2"
            class="graph-node"
            @mouseenter="onNodeHover(i)"
          />

          <!-- 标签 -->
          <text
            :y="-node.radius - 10"
            text-anchor="middle"
            class="node-label"
          >{{ i + 1 }}. {{ node.shortType }}</text>

          <!-- 情绪张力指示 -->
          <text
            :y="node.radius + 16"
            text-anchor="middle"
            class="node-tension"
          >{{ node.tensionLabel }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDirectorRuntimeStore } from '../stores/director-runtime-store'

const store = useDirectorRuntimeStore()
const graphBodyRef = ref<HTMLElement | null>(null)

const SVG_WIDTH = 600
const SVG_HEIGHT = 180
const NODE_SPACING_X = 90
const NODE_RADIUS = 28

const typeColors: Record<string, string> = {
  establishing: '#3a8a3a',
  build_up: '#3a6a8a',
  peak: '#8a3a3a',
  release: '#6a3a8a',
  reaction: '#3a6a6a',
  insert: '#8a8a3a',
  transition: '#6a6a6a',
}

const typeShort: Record<string, string> = {
  establishing: 'EST',
  build_up: 'BUP',
  peak: 'PEAK',
  release: 'REL',
  reaction: 'RXN',
  insert: 'INS',
  transition: 'TRN',
}

const nodes = computed(() =>
  store.state.timeline.map((shot, i) => {
    const total = store.totalShots
    const spacing = total > 1 ? SVG_WIDTH / (total - 1) : SVG_WIDTH / 2
    const x = total > 1 ? i * spacing : SVG_WIDTH / 2
    const y = SVG_HEIGHT / 2
    const tension = (shot.emotionalTension ?? 0.5) * 100
    const radius = NODE_RADIUS + (tension / 100) * 12

    return {
      x, y,
      radius: Math.min(radius, 50),
      color: typeColors[shot.grammarType] ?? '#555',
      shortType: typeShort[shot.grammarType] ?? shot.grammarType.slice(0, 4),
      tensionLabel: tension.toFixed(0) + '%',
    }
  }),
)

const edges = computed(() => {
  const result: { x1: number; y1: number; x2: number; y2: number; color: string; thickness: number }[] = []
  for (let i = 1; i < nodes.value.length; i++) {
    const prev = nodes.value[i - 1]
    const curr = nodes.value[i]
    const continuity = store.state.timeline[i]?.temporalContinuity ?? 0.5
    result.push({
      x1: prev.x,
      y1: prev.y,
      x2: curr.x,
      y2: curr.y,
      color: continuity < 0.4 ? '#f66' : continuity < 0.7 ? '#ff6' : '#6f6',
      thickness: 1 + continuity * 2,
    })
  }
  return result
})

const svgWidth = computed(() => Math.max(SVG_WIDTH, (store.totalShots - 1) * NODE_SPACING_X + 100))
const svgHeight = SVG_HEIGHT

function onNodeHover(index: number) {
  // future: tooltip
}
</script>

<style scoped>
.shot-graph {
  background: #111;
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #222;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.graph-title {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: 1px solid #333;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
}

.graph-body {
  overflow-x: auto;
}

.graph-svg {
  display: block;
}

.graph-edge {
  transition: all 0.3s;
}

.graph-node-group {
  cursor: pointer;
  transition: transform 0.15s;
}

.graph-node-group:hover {
  transform: scale(1.1);
}

.graph-node {
  transition: all 0.2s;
}

.node-label {
  fill: #aaa;
  font-size: 11px;
  font-family: 'Courier New', monospace;
}

.node-tension {
  fill: #666;
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.graph-node-group.selected .node-label {
  fill: #fff;
}
</style>
