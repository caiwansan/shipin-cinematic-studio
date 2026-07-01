<template>
  <div class="report-embedded-content">
    <!-- Loading State -->
    <div v-if="loading" class="report-embedded-content__state">
      <div class="report-embedded-content__spinner" />
      <span>Generating report...</span>
    </div>

    <!-- No Data -->
    <div v-else-if="!hasReports" class="report-embedded-content__state">
      <p>No report data available. Complete all previous workflow steps first.</p>
    </div>

    <!-- Report Content -->
    <template v-else>
      <!-- Header -->
      <div class="report-embedded-content__card report-embedded-content__card--hero">
        <h2 class="report-embedded-content__title">GEO Optimization Report</h2>
        <p class="report-embedded-content__subtitle">
          {{ projectStore.currentProject?.name || 'Project' }} — {{ generatedDate }}
        </p>
      </div>

      <!-- Summary Stats -->
      <div class="report-embedded-content__card">
        <h4 class="report-embedded-content__card-title">Summary</h4>
        <div class="report-embedded-content__summary-grid">
          <div class="report-embedded-content__summary-item">
            <span class="report-embedded-content__summary-value">{{ projectStore.discoveryReport?.adi || '—' }}</span>
            <span class="report-embedded-content__summary-label">Initial ADI</span>
          </div>
          <div class="report-embedded-content__summary-item">
            <span class="report-embedded-content__summary-value">{{ projectStore.verificationReport?.afterAdi || '—' }}</span>
            <span class="report-embedded-content__summary-label">Final ADI</span>
          </div>
          <div class="report-embedded-content__summary-item">
            <span class="report-embedded-content__summary-value" :class="delta >= 0 ? 'report-embedded-content__value--positive' : 'report-embedded-content__value--negative'">
              {{ delta >= 0 ? '+' : '' }}{{ delta }}
            </span>
            <span class="report-embedded-content__summary-label">ADI Change</span>
          </div>
        </div>
      </div>

      <!-- Discovery Snapshot -->
      <div v-if="projectStore.discoveryReport" class="report-embedded-content__card">
        <h4 class="report-embedded-content__card-title">🔍 Discovery Snapshot</h4>
        <div class="report-embedded-content__snapshot">
          <p><strong>Entity:</strong> {{ projectStore.discoveryReport.entityName }}</p>
          <p><strong>Coverage Score:</strong> {{ projectStore.discoveryReport.coverageScore }}</p>
          <p><strong>Share Score:</strong> {{ projectStore.discoveryReport.shareScore }}</p>
          <p><strong>Position Score:</strong> {{ projectStore.discoveryReport.positionScore }}</p>
        </div>
      </div>

      <!-- Verification Results -->
      <div v-if="projectStore.verificationReport" class="report-embedded-content__card">
        <h4 class="report-embedded-content__card-title">✅ Verification Results</h4>
        <div class="report-embedded-content__comparison">
          <div class="report-embedded-content__score-pair">
            <span class="report-embedded-content__score-label">Before</span>
            <span class="report-embedded-content__score-value report-embedded-content__score-value--before">{{ projectStore.verificationReport.beforeAdi }}</span>
          </div>
          <span class="report-embedded-content__arrow">→</span>
          <div class="report-embedded-content__score-pair">
            <span class="report-embedded-content__score-label">After</span>
            <span class="report-embedded-content__score-value report-embedded-content__score-value--after">{{ projectStore.verificationReport.afterAdi }}</span>
          </div>
          <span class="report-embedded-content__delta" :class="projectStore.verificationReport.deltaAdi >= 0 ? 'report-embedded-content__delta--pos' : 'report-embedded-content__delta--neg'">
            {{ projectStore.verificationReport.deltaAdi >= 0 ? '+' : '' }}{{ projectStore.verificationReport.deltaAdi }}
          </span>
        </div>
      </div>

      <!-- Action Plan -->
      <div v-if="projectStore.actionPlan" class="report-embedded-content__card">
        <h4 class="report-embedded-content__card-title">📋 Action Plan</h4>
        <p>Action plan data is available.</p>
        <div class="report-embedded-content__plan-status">
          <span class="report-embedded-content__status-badge">Status: {{ projectStore.actionPlan.status }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="report-embedded-content__actions">
        <button class="report-embedded-content__btn" @click="confirmReport">
          ✅ Complete & Finish
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'

const props = defineProps<{
  projectId: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', data?: any): void
}>()

const projectStore = useGeoProjectStore()
const loading = ref(false)

const hasReports = computed(() => {
  return !!(projectStore.discoveryReport || projectStore.verificationReport || projectStore.actionPlan)
})

const delta = computed(() => {
  if (projectStore.verificationReport) {
    return projectStore.verificationReport.afterAdi - projectStore.verificationReport.beforeAdi
  }
  return 0
})

const generatedDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

onMounted(() => {
  if (props.projectId && !projectStore.currentProject) {
    loading.value = true
    projectStore.loadProject(props.projectId).finally(() => {
      loading.value = false
    })
  }
})

function confirmReport() {
  emit('complete', {
    projectId: props.projectId,
    reportData: {
      generatedAt: new Date().toISOString(),
      discoveryReport: projectStore.discoveryReport,
      verificationReport: projectStore.verificationReport,
      actionPlan: projectStore.actionPlan,
    },
  })
}
</script>

<style scoped>
.report-embedded-content__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}

.report-embedded-content__spinner {
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

.report-embedded-content__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 12px;
}

.report-embedded-content__card--hero {
  text-align: center;
  padding: 28px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border-color: #bfdbfe;
}

.report-embedded-content__title {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 6px;
}

.report-embedded-content__subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.report-embedded-content__card-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.report-embedded-content__summary-grid {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.report-embedded-content__summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.report-embedded-content__summary-value {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
}

.report-embedded-content__value--positive {
  color: #16a34a;
}

.report-embedded-content__value--negative {
  color: #dc2626;
}

.report-embedded-content__summary-label {
  font-size: 12px;
  color: #9ca3af;
}

.report-embedded-content__snapshot p {
  font-size: 14px;
  color: #374151;
  margin: 0 0 4px;
}

.report-embedded-content__comparison {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
}

.report-embedded-content__score-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.report-embedded-content__score-label {
  font-size: 11px;
  color: #9ca3af;
  text-transform: uppercase;
}

.report-embedded-content__score-value {
  font-size: 24px;
  font-weight: 800;
}

.report-embedded-content__score-value--before { color: #6b7280; }
.report-embedded-content__score-value--after { color: #16a34a; }

.report-embedded-content__arrow {
  font-size: 18px;
  color: #d1d5db;
}

.report-embedded-content__delta {
  font-size: 18px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
}

.report-embedded-content__delta--pos {
  color: #16a34a;
  background: #f0fdf4;
}

.report-embedded-content__delta--neg {
  color: #dc2626;
  background: #fef2f2;
}

.report-embedded-content__plan-status {
  margin-top: 8px;
}

.report-embedded-content__status-badge {
  font-size: 13px;
  font-weight: 500;
  padding: 4px 10px;
  background: #f3f4f6;
  color: #374151;
  border-radius: 6px;
}

.report-embedded-content__actions {
  margin-top: 20px;
  text-align: center;
}

.report-embedded-content__btn {
  padding: 10px 32px;
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.report-embedded-content__btn:hover {
  background: #16a34a;
}
</style>
