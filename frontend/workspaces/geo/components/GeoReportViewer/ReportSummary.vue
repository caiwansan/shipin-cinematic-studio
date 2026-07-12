<template>
  <div class="geo-report-summary">
    <div class="geo-report-summary__grid">
      <div class="geo-report-summary__metric">
        <span class="geo-report-summary__value">{{ report.executiveSummary.currentAdi }}</span>
        <span class="geo-report-summary__label">当前 ADI</span>
      </div>
      <div class="geo-report-summary__metric">
        <span
          class="geo-report-summary__value"
          :class="report.executiveSummary.adiChange >= 0 ? 'text-green-600' : 'text-red-600'"
        >
          {{ report.executiveSummary.adiChange >= 0 ? '+' : '' }}{{ report.executiveSummary.adiChange }}
        </span>
        <span class="geo-report-summary__label">Δ ADI</span>
      </div>
      <div class="geo-report-summary__metric">
        <span class="geo-report-summary__value">{{ report.executiveSummary.completionRate }}%</span>
        <span class="geo-report-summary__label">完成率</span>
      </div>
      <div class="geo-report-summary__metric">
        <span class="geo-report-summary__value">{{ report.executiveSummary.topOpportunities }}</span>
        <span class="geo-report-summary__label">剩余机会</span>
      </div>
      <div class="geo-report-summary__metric">
        <span class="geo-report-summary__value">{{ (report.executiveSummary.confidence * 100).toFixed(0) }}%</span>
        <span class="geo-report-summary__label">信心指数</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Report } from '../types'

defineProps<{
  report: Report
}>()
</script>

<style scoped>
.geo-report-summary {
  background: linear-gradient(135deg, #eef2ff, #ffffff, #f0fdf4);
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  padding: 20px 24px;
}
.geo-report-summary__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}
.geo-report-summary__metric {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.geo-report-summary__value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}
.geo-report-summary__label {
  font-size: 12px;
  color: #6b7280;
}
@media (max-width: 640px) {
  .geo-report-summary__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
