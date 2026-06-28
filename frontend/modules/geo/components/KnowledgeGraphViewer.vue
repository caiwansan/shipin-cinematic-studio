<template>
  <div class="knowledge-graph-viewer" ref="containerRef">
    <div v-if="!data" class="knowledge-graph-viewer__empty">
      <div class="knowledge-graph-viewer__placeholder">🕸️ 暂无图谱数据</div>
      <div class="knowledge-graph-viewer__hint">请先构建知识图谱</div>
    </div>
    <svg v-else ref="svgRef" class="knowledge-graph-viewer__svg" />
    <div v-if="data" class="knowledge-graph-viewer__stats">
      <span>{{ data.nodes.length }} 节点</span>
      <span>{{ data.edges.length }} 边</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import type { GraphVisualizationData } from '../types/index'
import * as d3 from 'd3'

const props = defineProps<{
  data: GraphVisualizationData | null
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

function renderGraph() {
  if (!props.data || !svgRef.value || !containerRef.value) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight || 400
  svg.attr('width', width).attr('height', height)

  const simulation = d3.forceSimulation(props.data.nodes as any)
    .force('link', d3.forceLink(props.data.edges as any).id((d: any) => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(30))

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10)

  // Draw edges
  const link = svg.append('g')
    .selectAll('line')
    .data(props.data.edges)
    .join('line')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.6)

  // Draw edge labels
  const linkLabel = svg.append('g')
    .selectAll('text')
    .data(props.data.edges)
    .join('text')
    .text(d => d.label)
    .attr('font-size', 10)
    .attr('fill', '#9ca3af')
    .attr('text-anchor', 'middle')

  // Draw nodes
  const node = svg.append('g')
    .selectAll('g')
    .data(props.data.nodes)
    .join('g')
    .call(d3.drag<any, any>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })
    )

  node.append('circle')
    .attr('r', (d: any) => Math.max(8, d.label.length * 3))
    .attr('fill', (d: any) => colorScale(d.group.toString()))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)

  node.append('text')
    .text((d: any) => d.label)
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => Math.max(8, d.label.length * 3) + 14)
    .attr('font-size', 11)
    .attr('fill', '#374151')

  // Tooltip on hover
  node.append('title')
    .text((d: any) => `${d.label} (${d.type})`)

  // Update simulation
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)

    linkLabel
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2)

    node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
  })
}

onMounted(() => {
  nextTick(() => renderGraph())
})

watch(() => props.data, () => {
  nextTick(() => renderGraph())
})
</script>

<style scoped>
.knowledge-graph-viewer {
  position: relative;
  width: 100%;
  min-height: 400px;
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
}

.knowledge-graph-viewer__svg {
  width: 100%;
  min-height: 400px;
}

.knowledge-graph-viewer__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 8px;
}

.knowledge-graph-viewer__placeholder {
  font-size: 24px;
  color: #9ca3af;
}

.knowledge-graph-viewer__hint {
  font-size: 13px;
  color: #d1d5db;
}

.knowledge-graph-viewer__stats {
  position: absolute;
  bottom: 8px;
  right: 12px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 10px;
  border-radius: 6px;
}
</style>
