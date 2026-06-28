<template>
  <div ref="canvas" class="w-full h-full relative overflow-hidden"></div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  nodes: any[]
  edges: any[]
  frame?: number
}>()

const canvas = ref<HTMLDivElement>()
let renderNodes: Map<string, HTMLElement> = new Map()

function renderGraph() {
  if (!canvas.value) return
  canvas.value.innerHTML = ''

  // render nodes
  for (const n of props.nodes) {
    const el = document.createElement('div')
    el.innerText = n.id
    el.title = `type: ${n.type}\nstatus: ${n.status}\nintensity: ${n.intensity}`
    el.style.position = 'absolute'
    el.style.left = (Math.random() * 600) + 'px'
    el.style.top = (Math.random() * 400) + 'px'
    el.style.color = '#e0e0e0'
    el.style.fontSize = '12px'
    el.style.fontFamily = 'monospace'
    el.style.whiteSpace = 'nowrap'
    el.style.background = getNodeColor(n.type, n.status)
    el.style.borderRadius = '6px'
    el.style.padding = '6px 10px'
    el.style.cursor = 'pointer'
    el.style.transition = 'opacity 0.3s, transform 0.2s'
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'

    // heatmap intensity
    const intensity = n.intensity ?? 0.2
    el.style.opacity = String(0.4 + intensity * 0.6)

    // hover effect
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.05)'
      el.style.zIndex = '10'
    })
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)'
      el.style.zIndex = '1'
    })

    canvas.value.appendChild(el)
    renderNodes.set(n.id, el)
  }

  // render edges (simple lines between parent-child nodes)
  for (const e of props.edges) {
    const from = renderNodes.get(e.from)
    const to = renderNodes.get(e.to)
    if (!from || !to) continue

    const line = document.createElement('div')
    line.style.position = 'absolute'
    line.style.height = '2px'
    line.style.background = 'rgba(100, 180, 255, 0.3)'
    line.style.transformOrigin = 'left center'
    line.style.borderRadius = '1px'
    line.style.pointerEvents = 'none'

    const fromRect = from.getBoundingClientRect()
    const toRect = to.getBoundingClientRect()
    const canvasRect = canvas.value.getBoundingClientRect()

    const x1 = fromRect.left - canvasRect.left + fromRect.width / 2
    const y1 = fromRect.top - canvasRect.top + fromRect.height / 2
    const x2 = toRect.left - canvasRect.left + toRect.width / 2
    const y2 = toRect.top - canvasRect.top + toRect.height / 2

    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    line.style.width = len + 'px'
    line.style.left = x1 + 'px'
    line.style.top = (y1 - 1) + 'px'
    line.style.transform = `rotate(${angle}deg)`

    canvas.value.appendChild(line)
  }
}

function getNodeColor(type: string, status: string): string {
  const baseColor = {
    DIRECTOR: '#6366f1',
    SCENE: '#8b5cf6',
    SHOT: '#06b6d4',
    RENDER: '#f59e0b',
  }[type] ?? '#6b7280'

  if (status === 'FAILED') return '#ef4444'
  if (status === 'RUNNING') return '#22c55e'
  return baseColor
}

onMounted(renderGraph)
watch(() => props.nodes, renderGraph, { deep: true })
</script>

<style scoped>
div {
  user-select: none;
}
</style>
