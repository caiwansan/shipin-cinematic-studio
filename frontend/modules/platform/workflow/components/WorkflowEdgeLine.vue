<template>
  <svg class="workflow-edge-line" :width="width" :height="height">
    <path
      :d="path"
      :class="['edge-line', statusClass]"
      :stroke-width="selected ? 3 : 2"
    />
    <text
      v-if="label"
      :x="midX"
      :y="midY"
      class="edge-label"
      text-anchor="middle"
    >{{ label }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  x1: number
  y1: number
  x2: number
  y2: number
  label?: string
  selected?: boolean
  status?: string
}>()

const width = computed(() => Math.abs(props.x2 - props.x1) + 40)
const height = computed(() => Math.abs(props.y2 - props.y1) + 40)

const path = computed(() => {
  const dx = Math.abs(props.x2 - props.x1) * 0.4
  return `M ${props.x1} ${props.y1} C ${props.x1 + dx} ${props.y1}, ${props.x2 - dx} ${props.y2}, ${props.x2} ${props.y2}`
})

const midX = computed(() => (props.x1 + props.x2) / 2)
const midY = computed(() => (props.y1 + props.y2) / 2)

const statusClass = computed(() => {
  switch (props.status) {
    case 'completed': return 'edge-completed'
    case 'running': return 'edge-running'
    case 'failed': return 'edge-failed'
    default: return 'edge-pending'
  }
})
</script>

<style scoped>
.edge-line {
  fill: none;
  stroke: #555;
  stroke-width: 2;
}

.edge-completed { stroke: #4CAF50; }
.edge-running { stroke: #2196F3; stroke-dasharray: 5,5; }
.edge-failed { stroke: #F44336; }
.edge-pending { stroke: #555; }

.edge-label {
  fill: #888;
  font-size: 11px;
}
</style>
