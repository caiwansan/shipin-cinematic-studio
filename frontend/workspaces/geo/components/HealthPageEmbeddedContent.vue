<template>
  <div class="health-embedded-content">
    <!-- Loading -->
    <div v-if="loading" class="health-embedded-content__state">
      <div class="health-embedded-content__spinner" />
      <span>Loading assessment data...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="health-embedded-content__state health-embedded-content__state--error">
      <p>{{ error }}</p>
      <button class="health-embedded-content__btn" @click="loadData">Retry</button>
    </div>

    <!-- No Data -->
    <div v-else-if="!healthData" class="health-embedded-content__state">
      <p>No assessment data available for this project.</p>
      <button class="health-embedded-content__btn" @click="loadData">Check Now</button>
    </div>

    <!-- Assessment Data -->
    <template v-else>
      <!-- Score Card -->
      <div class="health-embedded-content__card">
        <div class="health-embedded-content__score-row">
          <div class="health-embedded-content__score-ring">
            <svg viewBox="0 0 120 120" class="health-embedded-content__score-svg">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8" />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                :stroke="scoreColor"
                stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="`${(healthData.score / 100) * 339} 339`"
                transform="rotate(-90 60 60)"
                class="health-embedded-content__score-arc"
              />
            </svg>
            <div class="health-embedded-content__score-value">
              <span class="health-embedded-content__score-number">{{ healthData.score }}</span>
              <span class="health-embedded-content__score-label">ADI</span>
            </div>
          </div>
          <div class="health-embedded-content__score-info">
            <h3 class="health-embedded-content__entity-name">{{ healthData.brand?.name || projectId }}</h3>
            <p class="health-embedded-content__score-desc">
              {{ scoreLabel }} — {{ trendLabel }}
            </p>
            <div class="health-embedded-content__score-meta">
              <span v-if="healthData.brand?.industry">Industry: {{ healthData.brand.industry }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Dimensions -->
      <div class="health-embedded-content__card">
        <h4 class="health-embedded-content__card-title">ADI Dimensions</h4>
        <div class="health-embedded-content__dims">
          <div v-for="dim in healthData.dimensions" :key="dim.id" class="health-embedded-content__dim">
            <div class="health-embedded-content__dim-header">
              <span class="health-embedded-content__dim-label">{{ dim.label }}</span>
              <span class="health-embedded-content__dim-score" :style="{ color: dimScoreColor(dim.score) }">{{ dim.score }}</span>
            </div>
            <div class="health-embedded-content__dim-bar">
              <div
                class="health-embedded-content__dim-fill"
                :style="{ width: (dim.score / (dim.maxScore || 100)) * 100 + '%', backgroundColor: dimScoreColor(dim.score) }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Explanation -->
      <div v-if="healthData.explanation" class="health-embedded-content__card">
        <h4 class="health-embedded-content__card-title">Summary</h4>
        <p class="health-embedded-content__summary">{{ healthData.explanation.summary }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchHealth, type BrandHealthData } from '../services/healthService'

const props = defineProps<{
  projectId: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', data?: any): void
}>()

const healthData = ref<BrandHealthData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const scoreColor = computed(() => {
  if (!healthData.value) return '#9ca3af'
  const score = healthData.value.score
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
})

const scoreLabel = computed(() => {
  if (!healthData.value) return ''
  const score = healthData.value.score
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Needs Improvement'
  return 'Critical'
})

const trendLabel = computed(() => {
  if (!healthData.value) return ''
  const trend = healthData.value.trend
  if (trend === 'improving') return '📈 Improving'
  if (trend === 'declining') return '📉 Declining'
  return '📊 Stable'
})

function dimScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  return '#f59e0b'
}

onMounted(() => {
  loadData()
})

async function loadData() {
  if (!props.projectId) return

  loading.value = true
  error.value = null

  try {
    const data = await fetchHealth(props.projectId)
    healthData.value = data
    emit('complete', data)
  } catch (err: any) {
    error.value = err?.message || 'Failed to load assessment data'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.health-embedded-content__state {
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
  text-align: center;
}

.health-embedded-content__state--error {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

.health-embedded-content__spinner {
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

.health-embedded-content__btn {
  padding: 6px 16px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.health-embedded-content__btn:hover {
  background: #2563eb;
}

.health-embedded-content__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}

.health-embedded-content__card-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.health-embedded-content__score-row {
  display: flex;
  gap: 24px;
  align-items: center;
}

.health-embedded-content__score-ring {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.health-embedded-content__score-svg {
  width: 100%;
  height: 100%;
}

.health-embedded-content__score-arc {
  transition: stroke-dasharray 0.6s ease-out;
}

.health-embedded-content__score-value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.health-embedded-content__score-number {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.health-embedded-content__score-label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.health-embedded-content__score-info {
  flex: 1;
}

.health-embedded-content__entity-name {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.health-embedded-content__score-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 8px;
}

.health-embedded-content__score-meta {
  font-size: 12px;
  color: #9ca3af;
}

.health-embedded-content__dims {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.health-embedded-content__dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.health-embedded-content__dim-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.health-embedded-content__dim-score {
  font-size: 13px;
  font-weight: 700;
}

.health-embedded-content__dim-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.health-embedded-content__dim-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
}

.health-embedded-content__summary {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}
</style>
