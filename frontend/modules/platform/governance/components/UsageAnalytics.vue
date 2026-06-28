<template>
  <div class="usage-analytics">
    <h3>用量分析</h3>
    <div class="metric-grid">
      <div v-for="metric in metrics" :key="metric.label" class="metric-card">
        <div class="metric-value">{{ metric.value }}</div>
        <div class="metric-label">{{ metric.label }}</div>
        <div class="metric-change" :class="metric.trend === 'up' ? 'up' : 'down'">
          {{ metric.change }}%
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  metrics: { label: string; value: string; change: number; trend: 'up' | 'down' }[]
}>()
</script>

<style scoped>
.usage-analytics { padding: 16px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.metric-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; text-align: center; }
.metric-value { font-size: 28px; font-weight: 700; }
.metric-label { font-size: 13px; color: #666; margin: 4px 0; }
.metric-change { font-size: 12px; }
.metric-change.up { color: #389e0d; }
.metric-change.down { color: #cf1322; }
</style>
