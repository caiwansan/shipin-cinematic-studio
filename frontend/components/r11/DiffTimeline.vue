<template>
  <div class="r11-diff-timeline">
    <!-- Stats bar -->
    <div class="stats-bar">
      <span class="stat equal">= {{ diff.stats.equal }}</span>
      <span class="stat modified">~ {{ diff.stats.modified }}</span>
      <span class="stat added">+ {{ diff.stats.added }}</span>
      <span class="stat removed">- {{ diff.stats.removed }}</span>
    </div>

    <!-- Timeline changes -->
    <div class="changes-list">
      <div
        v-for="(change, i) in diff.changes"
        :key="i"
        class="change-item"
        :class="change.color"
      >
        <span class="change-dot" :style="{ background: colorMap[change.color] }" />
        <span class="change-node-id">{{ change.nodeId }}</span>
        <span class="change-type-badge">{{ change.changeType }}</span>
        <span v-if="change.detail" class="change-detail">{{ change.detail }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { DiffRenderData } from './r11-api'

export default defineComponent({
  name: 'DiffTimeline',
  props: {
    diff: {
      type: Object as PropType<DiffRenderData>,
      required: true,
    },
  },
  setup() {
    const colorMap: Record<string, string> = {
      green: '#4caf50',
      red: '#f44336',
      yellow: '#ff9800',
      gray: '#757575',
    }
    return { colorMap }
  },
})
</script>

<style scoped>
.r11-diff-timeline {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 13px;
}
.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}
.stat {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 14px;
}
.stat.equal { background: #2c2c2c; color: #9e9e9e; }
.stat.modified { background: #3e2723; color: #ff9800; }
.stat.added { background: #1b5e20; color: #4caf50; }
.stat.removed { background: #b71c1c; color: #f44336; }
.changes-list {
  max-height: 400px;
  overflow-y: auto;
}
.change-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #252525;
  font-size: 12px;
}
.change-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.change-node-id {
  color: #90caf9;
  min-width: 100px;
}
.change-type-badge {
  padding: 0 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}
.change-item.green .change-type-badge { background: #1b5e20; color: #4caf50; }
.change-item.red .change-type-badge { background: #b71c1c; color: #f44336; }
.change-item.yellow .change-type-badge { background: #3e2723; color: #ff9800; }
.change-item.gray .change-type-badge { background: #2c2c2c; color: #9e9e9e; }
.change-detail {
  color: #78909c;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
