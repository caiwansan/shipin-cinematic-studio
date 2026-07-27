<!-- ContributionTimeline.vue — 30d 执行趋势图 -->
<template>
  <section class="contribution-timeline">
    <h2 class="section-title">
      <span class="section-icon">📈</span>
      贡献趋势
      <span class="section-period">近30天</span>
    </h2>

    <div v-if="timeline.data.length > 0" class="timeline-chart">
      <!-- Simple bar chart -->
      <div class="chart-bars">
        <div
          v-for="(item, idx) in displayData"
          :key="idx"
          class="chart-bar"
          :style="{ height: barHeight(item.count) + '%' }"
          :class="{ 'bar-peak': item.date === timeline.peak?.date }"
          :title="`${item.date}: ${item.count}次`"
        />
      </div>
      <div class="chart-labels">
        <span class="chart-label">30天前</span>
        <span class="chart-label">今天</span>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="timeline-stats">
      <div class="ts-item">
        <span class="ts-value">{{ timeline.total }}</span>
        <span class="ts-label">总执行</span>
      </div>
      <div class="ts-item">
        <span class="ts-value">{{ dailyAvg }}</span>
        <span class="ts-label">日均</span>
      </div>
      <div class="ts-item">
        <span class="ts-value">{{ timeline.peak?.count || 0 }}</span>
        <span class="ts-label">峰值 ({{ peakDate }})</span>
      </div>
    </div>

    <div v-if="timeline.data.length === 0" class="timeline-empty">
      <span class="empty-icon">📊</span>
      <span class="empty-text">近30天暂无执行记录</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  timeline: {
    period: string
    data: { date: string; count: number }[]
    total: number
    peak: { date: string; count: number }
  }
}>()

// Display last 14 days for readability
const displayData = computed(() => {
  return props.timeline.data.slice(-14)
})

const dailyAvg = computed(() => {
  if (props.timeline.data.length === 0) return 0
  return Math.round(props.timeline.total / props.timeline.data.length)
})

const peakDate = computed(() => {
  if (!props.timeline.peak?.date) return ''
  const d = new Date(props.timeline.peak.date)
  return `${d.getMonth() + 1}/${d.getDate()}`
})

function barHeight(count: number): number {
  const max = Math.max(...props.timeline.data.map((d) => d.count), 1)
  return Math.max(5, (count / max) * 100)
}
</script>

<style scoped>
.contribution-timeline {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #e8e8e8;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon { font-size: 16px; }

.section-period {
  margin-left: auto;
  font-size: 10px;
  color: #5A6A8A;
  font-weight: 400;
}

/* Chart */
.timeline-chart {
  padding: 10px 0;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 60px;
}

.chart-bar {
  flex: 1;
  min-height: 3px;
  background: linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%);
  border-radius: 2px 2px 0 0;
  opacity: 0.7;
  transition: all 0.2s;
}

.chart-bar:hover {
  opacity: 1;
  transform: scaleY(1.1);
  transform-origin: bottom;
}

.chart-bar.bar-peak {
  background: linear-gradient(180deg, #22C55E 0%, #16A34A 100%);
  opacity: 1;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
}

.chart-label {
  font-size: 10px;
  color: #3A4A6A;
}

/* Stats */
.timeline-stats {
  display: flex;
  justify-content: space-around;
  padding-top: 12px;
  border-top: 1px solid #1A2240;
  margin-top: 12px;
}

.ts-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ts-value {
  font-size: 16px;
  font-weight: 700;
  color: #e8e8e8;
}

.ts-label {
  font-size: 10px;
  color: #5A6A8A;
}

/* Empty */
.timeline-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  color: #5A6A8A;
  font-size: 12px;
}

.empty-icon { font-size: 16px; }
</style>
