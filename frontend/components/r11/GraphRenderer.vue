<template>
  <svg
    :width="data.width"
    :height="data.height"
    :viewBox="`0 0 ${data.width} ${data.height}`"
    class="r11-graph-renderer"
  >
    <!-- Edges -->
    <g class="edges">
      <path
        v-for="(edge, i) in data.edges"
        :key="`edge-${i}`"
        :d="edgePath(edge.path)"
        fill="none"
        :stroke="edgeColor(edge.type)"
        stroke-width="2"
        stroke-opacity="0.6"
        class="r11-edge"
      />
    </g>

    <!-- Nodes -->
    <g class="nodes">
      <g
        v-for="(node, i) in data.nodes"
        :key="`node-${i}`"
        :transform="`translate(${node.x}, ${node.y})`"
        class="r11-node"
        @click="$emit('nodeClick', node)"
      >
        <!-- Node rect -->
        <rect
          :width="node.width"
          :height="node.height"
          rx="6"
          ry="6"
          :fill="nodeColor(node.type)"
          stroke="#444"
          stroke-width="1"
          class="r11-node-rect"
        />
        <!-- Node label -->
        <text
          :x="node.width / 2"
          :y="node.height / 2 + 5"
          text-anchor="middle"
          fill="#fff"
          font-size="12"
          class="r11-node-label"
        >
          {{ node.id }}
        </text>
        <!-- Degree badge -->
        <circle
          :cx="node.width - 12"
          :cy="12"
          r="10"
          fill="#333"
          stroke="#666"
          stroke-width="0.5"
        />
        <text
          :x="node.width - 12"
          :y="16"
          text-anchor="middle"
          fill="#aaa"
          font-size="9"
        >
          {{ node.outgoingCount }}
        </text>
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { GraphRenderData } from './r11-api'

export default defineComponent({
  name: 'GraphRenderer',
  props: {
    data: {
      type: Object as PropType<GraphRenderData>,
      required: true,
    },
  },
  emits: ['nodeClick'],
  methods: {
    edgePath(path: Array<{ x: number; y: number }>): string {
      if (path.length < 2) return ''
      const start = `M ${path[0].x} ${path[0].y}`
      if (path.length === 2) {
        return `${start} L ${path[1].x} ${path[1].y}`
      }
      // Bezier: M start C cp1 cp2 end
      const cp1 = path[1]
      const cp2 = path[2]
      const end = path[3]
      return `${start} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`
    },
    edgeColor(type: string): string {
      const colors: Record<string, string> = {
        flow: '#4fc3f7',
        data: '#81c784',
        control: '#ffb74d',
        depends: '#ce93d8',
        version: '#e0e0e0',
        unknown: '#757575',
      }
      return colors[type] || '#757575'
    },
    nodeColor(type: string): string {
      const colors: Record<string, string> = {
        agent: '#1565c0',
        tool: '#2e7d32',
        transform: '#6a1b9a',
        state: '#e65100',
        decision: '#c62828',
        llm: '#283593',
        pipeline: '#00838f',
        unknown: '#424242',
      }
      return colors[type] || '#424242'
    },
  },
})
</script>

<style scoped>
.r11-graph-renderer {
  background: #1a1a2e;
  border-radius: 8px;
  overflow: visible;
}
.r11-node {
  cursor: pointer;
  transition: opacity 0.2s;
}
.r11-node:hover {
  opacity: 0.85;
}
.r11-node-rect {
  transition: fill 0.3s;
}
.r11-edge {
  transition: stroke-opacity 0.2s;
}
</style>
