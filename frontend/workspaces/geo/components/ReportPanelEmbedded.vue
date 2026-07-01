<template>
  <div class="report-embedded">
    <!-- Loading State -->
    <div v-if="loading" class="report-embedded__state">
      <div class="report-embedded__spinner" />
      <span>Generating report...</span>
    </div>

    <!-- No Data -->
    <div v-else-if="!report" class="report-embedded__state">
      <p>No report data available. Complete all previous workflow steps first.</p>
      <button
        class="report-embedded__btn"
        @click="loadReport"
      >
        🔄 Try Again
      </button>
    </div>

    <!-- Report Mini View -->
    <template v-else>
      <!-- Executive Summary Mini -->
      <div class="report-embedded__card report-embedded__card--hero">
        <h2 class="report-embedded__title">GEO Optimization Report</h2>
        <p class="report-embedded__subtitle">{{ report.projectName }} — {{ formattedDate }}</p>
        <div class="report-embedded__summary-grid">
          <div class="report-embedded__summary-item">
            <span class="report-embedded__summary-value">{{ report.executiveSummary.currentAdi }}</span>
            <span class="report-embedded__summary-label">Current ADI</span>
          </div>
          <div class="report-embedded__summary-item">
            <span
              class="report-embedded__summary-value"
              :class="report.executiveSummary.adiChange >= 0 ? 'text-emerald-600' : 'text-red-600'"
            >
              {{ report.executiveSummary.adiChange >= 0 ? '+' : '' }}{{ report.executiveSummary.adiChange }}
            </span>
            <span class="report-embedded__summary-label">ADI Change</span>
          </div>
          <div class="report-embedded__summary-item">
            <span class="report-embedded__summary-value">{{ report.executiveSummary.completionRate }}%</span>
            <span class="report-embedded__summary-label">完成率</span>
          </div>
          <div class="report-embedded__summary-item">
            <span class="report-embedded__summary-value" :class="healthClass">{{ healthLabel }}</span>
            <span class="report-embedded__summary-label">健康度</span>
          </div>
        </div>
      </div>

      <!-- Section Summary Cards -->
      <div class="report-embedded__card">
        <div class="report-embedded__section-summary">
          <div class="report-embedded__section-row">
            <span class="report-embedded__section-icon">🔍</span>
            <span class="report-embedded__section-label">Findings</span>
            <span class="report-embedded__section-desc">{{ report.findings.entityName }} · {{ report.findings.totalScenarios }} scenarios</span>
          </div>
          <div class="report-embedded__section-row">
            <span class="report-embedded__section-icon">💡</span>
            <span class="report-embedded__section-label">Opportunities</span>
            <span class="report-embedded__section-desc">{{ report.opportunities.high }} High · {{ report.opportunities.medium }} Med · {{ report.opportunities.low }} Low</span>
          </div>
          <div class="report-embedded__section-row">
            <span class="report-embedded__section-icon">📋</span>
            <span class="report-embedded__section-label">Actions</span>
            <span class="report-embedded__section-desc">{{ report.actions.completed }}/{{ report.actions.total }} completed</span>
          </div>
          <div class="report-embedded__section-row" v-if="report.verification">
            <span class="report-embedded__section-icon">✅</span>
            <span class="report-embedded__section-label">Verification</span>
            <span class="report-embedded__section-desc">{{ report.verification.beforeAdi }} → {{ report.verification.afterAdi }} ({{ report.verification.improvementRate }}%)</span>
          </div>
          <div class="report-embedded__section-row">
            <span class="report-embedded__section-icon">🎯</span>
            <span class="report-embedded__section-label">Next Steps</span>
            <span class="report-embedded__section-desc">{{ report.nextRecommendations.length }} recommendations</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="report-embedded__actions">
        <NuxtLink
          :to="`/workspace/geo/report/${projectId}`"
          class="report-embedded__btn report-embedded__btn--view"
        >
          📄 View Full Report
        </NuxtLink>
        <button
          class="report-embedded__btn report-embedded__btn--complete"
          @click="confirmReport"
        >
          ✅ Complete & Finish
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { geoApi } from '../services/api'
import type { DeliverableReport } from '../types/report'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'data-loaded', data?: any): void
}>()

const projectStore = useGeoProjectStore()
const report = ref<DeliverableReport | null>(null)
const loading = ref(false)

const formattedDate = computed(() => {
  if (!report.value) return ''
  const d = new Date(report.value.generatedAt)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const healthLabel = computed(() => {
  if (!report.value) return ''
  const m: Record<string, string> = { good: 'Good', fair: 'Fair', poor: 'Poor' }
  return m[report.value.executiveSummary.overallHealth] || ''
})

const healthClass = computed(() => {
  if (!report.value) return ''
  const h = report.value.executiveSummary.overallHealth
  return h === 'good' ? 'text-emerald-600' : h === 'fair' ? 'text-amber-600' : 'text-red-600'
})

onMounted(async () => {
  // Load project info
  if (props.projectId && !projectStore.currentProject) {
    await projectStore.loadProject(props.projectId)
  }
  await loadReport()
})

async function loadReport() {
  loading.value = true
  try {
    const raw = await geoApi<{ success: boolean; data: DeliverableReport }>(
      `report/${props.projectId}`,
      { method: 'GET' }
    )
    report.value = raw.data
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
}

function confirmReport() {
  emit('data-loaded', {
    projectId: props.projectId,
    reportData: report.value,
  })
}
</script>

<style scoped>
.report-embedded__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}

.report-embedded__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.report-embedded__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 12px;
}

.report-embedded__card--hero {
  text-align: center;
  padding: 28px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border-color: #bfdbfe;
}

.report-embedded__title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 6px;
}

.report-embedded__subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px;
}

.report-embedded__summary-grid {
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
}

.report-embedded__summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.report-embedded__summary-value {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
}

.report-embedded__summary-label {
  font-size: 12px;
  color: #9ca3af;
}

.text-emerald-600 { color: #059669; }
.text-amber-600 { color: #d97706; }
.text-red-600 { color: #dc2626; }

/* Section Summary */
.report-embedded__section-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-embedded__section-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
}

.report-embedded__section-row:last-child {
  border-bottom: none;
}

.report-embedded__section-icon {
  font-size: 16px;
  width: 28px;
  text-align: center;
}

.report-embedded__section-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  width: 110px;
  flex-shrink: 0;
}

.report-embedded__section-desc {
  font-size: 13px;
  color: #6b7280;
}

/* Actions */
.report-embedded__actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.report-embedded__btn {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
}

.report-embedded__btn--view {
  background: #3b82f6;
  color: #fff;
}

.report-embedded__btn--view:hover {
  background: #2563eb;
}

.report-embedded__btn--complete {
  background: #22c55e;
  color: #fff;
}

.report-embedded__btn--complete:hover {
  background: #16a34a;
}
</style>
