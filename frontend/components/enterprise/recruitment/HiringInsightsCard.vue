<!-- Sprint 08: 招聘洞察卡片 — Command Center 展示 -->
<!-- 位置：/components/enterprise/recruitment/HiringInsightsCard.vue -->
<!-- 职责：展示招聘洞察数据 — 面试人数、Offer人数、录用人数、平均匹配度 -->
<template>
  <div class="hiring-insights-card">
    <div class="hic-header">
      <h3 class="hic-title">📊 招聘洞察</h3>
      <div class="hic-range-toggle">
        <button
          v-for="opt in rangeOptions"
          :key="opt.value"
          :class="['hic-range-btn', { active: range === opt.value }]"
          @click="range = opt.value; loadInsights()"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="hic-loading">
      <div class="hic-spinner"></div>
      <span>加载洞察数据...</span>
    </div>

    <!-- Content -->
    <template v-else-if="insights">
      <!-- Main Metrics -->
      <div class="hic-metrics">
        <div class="hic-metric">
          <span class="hic-metric-value">{{ insights.interviews?.inPeriod || 0 }}</span>
          <span class="hic-metric-label">面试人数</span>
        </div>
        <div class="hic-metric">
          <span class="hic-metric-value">{{ insights.decisions?.hire || 0 }}</span>
          <span class="hic-metric-label">录用人数</span>
        </div>
        <div class="hic-metric">
          <span class="hic-metric-value">{{ insights.pipeline?.offer || 0 }}</span>
          <span class="hic-metric-label">Offer 数</span>
        </div>
        <div class="hic-metric">
          <span class="hic-metric-value">{{ insights.interviews?.avgScore || 0 }}</span>
          <span class="hic-metric-label">平均评分</span>
        </div>
      </div>

      <!-- Pipeline Summary -->
      <div class="hic-pipeline">
        <div class="hic-pipeline-bar">
          <div
            v-for="stage in pipelineStages"
            :key="stage.key"
            class="hic-pipeline-segment"
            :style="{ width: stage.width + '%', background: stage.color }"
            :title="`${stage.label}: ${stage.value}`"
          ></div>
        </div>
        <div class="hic-pipeline-legend">
          <div v-for="stage in pipelineStages" :key="stage.key" class="hic-legend-item">
            <span class="hic-legend-dot" :style="{ background: stage.color }"></span>
            <span class="hic-legend-label">{{ stage.label }}</span>
            <span class="hic-legend-value">{{ stage.value }}</span>
          </div>
        </div>
      </div>

      <!-- Match Score -->
      <div class="hic-match" v-if="insights.matches?.total > 0">
        <span class="hic-match-label">候选人平均匹配度</span>
        <div class="hic-match-bar">
          <div class="hic-match-fill" :style="{ width: (insights.matches?.avgScore || 0) + '%' }"></div>
        </div>
        <span class="hic-match-value">{{ insights.matches?.avgScore || 0 }}%</span>
      </div>
    </template>

    <!-- Empty -->
    <div v-else class="hic-empty">
      <p>暂无招聘数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

// ─── State ───
const loading = ref(true)
const range = ref('month')
const insights = ref<any>(null)

const rangeOptions = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本季', value: 'quarter' },
]

// ─── Computed ───
const pipelineStages = computed(() => {
  const p = insights.value?.pipeline
  if (!p) return []
  const total = (p.discovered || 0) + (p.screening || 0) + (p.interview || 0) + (p.offer || 0) + (p.hired || 0) + (p.rejected || 0)
  if (total === 0) return []
  return [
    { key: 'discovered', label: '初筛', value: p.discovered || 0, color: '#9ca3af', width: ((p.discovered || 0) / total) * 100 },
    { key: 'screening', label: '筛选', value: p.screening || 0, color: '#60a5fa', width: ((p.screening || 0) / total) * 100 },
    { key: 'interview', label: '面试', value: p.interview || 0, color: '#a78bfa', width: ((p.interview || 0) / total) * 100 },
    { key: 'offer', label: 'Offer', value: p.offer || 0, color: '#fbbf24', width: ((p.offer || 0) / total) * 100 },
    { key: 'hired', label: '录用', value: p.hired || 0, color: '#4ade80', width: ((p.hired || 0) / total) * 100 },
    { key: 'rejected', label: '拒绝', value: p.rejected || 0, color: '#f87171', width: ((p.rejected || 0) / total) * 100 },
  ].filter(s => s.value > 0)
})

// ─── Data Loading ───
async function loadInsights() {
  loading.value = true
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(`/api/enterprise/hiring-intelligence/insights?range=${range.value}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        insights.value = data.data
      }
    }
  } catch { /* silent */ } finally {
    loading.value = false
  }
}

// ─── Init ───
onMounted(() => {
  loadInsights()
})
</script>

<style scoped>
.hiring-insights-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 20px;
}

.hic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.hic-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.hic-range-toggle {
  display: flex;
  gap: 4px;
}

.hic-range-btn {
  padding: 4px 10px;
  font-size: 0.72rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}

.hic-range-btn.active {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.3);
}

.hic-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.82rem;
}

.hic-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: hic-spin 0.8s linear infinite;
}

@keyframes hic-spin {
  to { transform: rotate(360deg); }
}

/* Metrics */
.hic-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.hic-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
}

.hic-metric-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: #60a5fa;
}

.hic-metric-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

/* Pipeline Bar */
.hic-pipeline {
  margin-bottom: 12px;
}

.hic-pipeline-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}

.hic-pipeline-segment {
  height: 100%;
  transition: width 0.3s ease;
}

.hic-pipeline-segment:first-child {
  border-radius: 4px 0 0 4px;
}

.hic-pipeline-segment:last-child {
  border-radius: 0 4px 4px 0;
}

.hic-pipeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.hic-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
}

.hic-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.hic-legend-label {
  color: rgba(255, 255, 255, 0.5);
}

.hic-legend-value {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

/* Match Score */
.hic-match {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.hic-match-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.hic-match-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  overflow: hidden;
}

.hic-match-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #4ade80);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.hic-match-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: #4ade80;
}

/* Empty */
.hic-empty {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.82rem;
}

@media (max-width: 600px) {
  .hic-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
