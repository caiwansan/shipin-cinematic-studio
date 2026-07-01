<template>
  <div class="verification-embedded-content">
    <!-- Input Section -->
    <div class="verification-embedded-content__input-bar">
      <div class="verification-embedded-content__input-group">
        <input
          v-model="entityName"
          type="text"
          class="verification-embedded-content__input"
          placeholder="Enter entity name to verify"
          @keyup.enter="runVerification"
          :disabled="loading"
        />
        <button
          class="verification-embedded-content__btn"
          :disabled="loading || !entityName.trim()"
          @click="runVerification"
        >
          <span v-if="loading" class="verification-embedded-content__spinner" />
          <span v-else>✅ Verify</span>
        </button>
      </div>
      <p v-if="error" class="verification-embedded-content__error">{{ error }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="verification-embedded-content__state">
      <div class="verification-embedded-content__spinner-lg" />
      <span>Running verification...</span>
    </div>

    <!-- Results -->
    <template v-if="report && !loading">
      <div class="verification-embedded-content__card">
        <h4 class="verification-embedded-content__card-title">ADI Comparison</h4>
        <div class="verification-embedded-content__comparison">
          <div class="verification-embedded-content__score">
            <span class="verification-embedded-content__score-label">Before</span>
            <span class="verification-embedded-content__score-value verification-embedded-content__score-value--before">{{ report.beforeAdi }}</span>
          </div>
          <div class="verification-embedded-content__arrow">→</div>
          <div class="verification-embedded-content__score">
            <span class="verification-embedded-content__score-label">After</span>
            <span class="verification-embedded-content__score-value verification-embedded-content__score-value--after">{{ report.afterAdi }}</span>
          </div>
          <div class="verification-embedded-content__delta" :class="report.deltaAdi >= 0 ? 'delta--positive' : 'delta--negative'">
            {{ report.deltaAdi >= 0 ? '+' : '' }}{{ report.deltaAdi }}
          </div>
        </div>
      </div>

      <!-- Completion Rate -->
      <div v-if="report.completionRate !== undefined" class="verification-embedded-content__card">
        <h4 class="verification-embedded-content__card-title">Action Completion</h4>
        <div class="verification-embedded-content__progress">
          <div class="verification-embedded-content__progress-bar">
            <div
              class="verification-embedded-content__progress-fill"
              :style="{ width: report.completionRate + '%' }"
              :class="completionColor"
            />
          </div>
          <span class="verification-embedded-content__progress-text">{{ report.completionRate.toFixed(0) }}%</span>
        </div>
      </div>

      <div class="verification-embedded-content__actions">
        <button class="verification-embedded-content__btn verification-embedded-content__btn--primary" @click="confirmVerification">
          ✅ Confirm & Continue
        </button>
      </div>
    </template>

    <!-- Empty -->
    <div v-if="!report && !loading" class="verification-embedded-content__state verification-embedded-content__state--empty">
      <p>Enter an entity name and run verification to see results.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { fetchEntityVerification } from '../services/verificationService'
import type { VerificationReport } from '../services/verificationService'

const props = defineProps<{
  projectId: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', data?: any): void
}>()

const entityName = ref('')
const report = ref<VerificationReport | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const completionColor = computed(() => {
  if (!report.value) return ''
  const rate = report.value.completionRate
  if (rate > 80) return 'fill--high'
  if (rate > 60) return 'fill--medium'
  return 'fill--low'
})

async function runVerification() {
  if (!entityName.value.trim() || loading.value) return

  loading.value = true
  error.value = null
  report.value = null

  try {
    const result = await fetchEntityVerification(entityName.value.trim())
    report.value = result
  } catch (err: any) {
    error.value = err instanceof Error ? err.message : 'Verification failed'
  } finally {
    loading.value = false
  }
}

function confirmVerification() {
  emit('complete', {
    entityName: entityName.value,
    beforeAdi: report.value?.beforeAdi || 0,
    afterAdi: report.value?.afterAdi || 0,
    deltaAdi: report.value?.deltaAdi || 0,
    reportData: report.value || {},
  })
}
</script>

<style scoped>
.verification-embedded-content__input-bar {
  margin-bottom: 16px;
}

.verification-embedded-content__input-group {
  display: flex;
  gap: 8px;
}

.verification-embedded-content__input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.verification-embedded-content__input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
}

.verification-embedded-content__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #059669;
  color: #fff;
  transition: background 0.15s;
  white-space: nowrap;
}

.verification-embedded-content__btn:hover:not(:disabled) {
  background: #047857;
}

.verification-embedded-content__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.verification-embedded-content__btn--primary {
  background: #22c55e;
}

.verification-embedded-content__btn--primary:hover:not(:disabled) {
  background: #16a34a;
}

.verification-embedded-content__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.verification-embedded-content__spinner-lg {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #059669;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.verification-embedded-content__state {
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

.verification-embedded-content__state--empty {
  margin-top: 16px;
}

.verification-embedded-content__error {
  margin-top: 8px;
  font-size: 13px;
  color: #dc2626;
}

.verification-embedded-content__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}

.verification-embedded-content__card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.verification-embedded-content__comparison {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
}

.verification-embedded-content__score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.verification-embedded-content__score-label {
  font-size: 11px;
  color: #9ca3af;
  text-transform: uppercase;
  font-weight: 500;
}

.verification-embedded-content__score-value {
  font-size: 28px;
  font-weight: 800;
}

.verification-embedded-content__score-value--before {
  color: #6b7280;
}

.verification-embedded-content__score-value--after {
  color: #16a34a;
}

.verification-embedded-content__arrow {
  font-size: 20px;
  color: #d1d5db;
}

.verification-embedded-content__delta {
  font-size: 20px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 8px;
}

.delta--positive {
  color: #16a34a;
  background: #f0fdf4;
}

.delta--negative {
  color: #dc2626;
  background: #fef2f2;
}

.verification-embedded-content__progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.verification-embedded-content__progress-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.verification-embedded-content__progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s;
}

.fill--high { background: #16a34a; }
.fill--medium { background: #d97706; }
.fill--low { background: #ef4444; }

.verification-embedded-content__progress-text {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.verification-embedded-content__actions {
  margin-top: 16px;
  text-align: center;
}
</style>
