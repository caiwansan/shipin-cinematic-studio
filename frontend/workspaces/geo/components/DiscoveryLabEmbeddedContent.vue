<template>
  <div class="discovery-embedded-content">
    <!-- Search Section -->
    <div class="discovery-embedded-content__search">
      <div class="discovery-embedded-content__input-group">
        <input
          v-model="entityInput"
          type="text"
          class="discovery-embedded-content__input"
          placeholder="Enter entity name (e.g. 昆仑镜AI, Tesla)"
          @keyup.enter="search"
          :disabled="loading"
        />
        <button
          class="discovery-embedded-content__btn"
          :disabled="loading || !entityInput.trim()"
          @click="search"
        >
          <span v-if="loading" class="discovery-embedded-content__spinner" />
          <span v-else>🔍 Discover</span>
        </button>
      </div>
      <p v-if="error" class="discovery-embedded-content__error">{{ error }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="discovery-embedded-content__state">
      <div class="discovery-embedded-content__spinner-lg" />
      <p>Discovering "{{ entityInput }}"...</p>
    </div>

    <!-- Empty -->
    <div v-if="!store.hasData && !loading && !discoveryComplete" class="discovery-embedded-content__state discovery-embedded-content__state--empty">
      <p>Enter an entity name to start discovery.</p>
    </div>

    <!-- Results -->
    <template v-if="store.hasData && store.report">
      <!-- ADI Score -->
      <div class="discovery-embedded-content__card">
        <div class="discovery-embedded-content__score-row">
          <div class="discovery-embedded-content__score-ring">
            <svg viewBox="0 0 100 100" class="discovery-embedded-content__score-svg">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" stroke-width="7" />
              <circle
                cx="50" cy="50" r="44"
                fill="none"
                :stroke="adiColor"
                stroke-width="7"
                stroke-linecap="round"
                :stroke-dasharray="`${scorePercent * 2.76} 276`"
                transform="rotate(-90 50 50)"
                class="discovery-embedded-content__score-arc"
              />
            </svg>
            <span class="discovery-embedded-content__score-value">{{ store.report.adi }}</span>
          </div>
          <div class="discovery-embedded-content__score-info">
            <h3 class="discovery-embedded-content__entity">{{ store.report.entityName }}</h3>
            <span class="discovery-embedded-content__score-label">{{ adiLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Opportunities Summary -->
      <div class="discovery-embedded-content__card">
        <h4 class="discovery-embedded-content__card-title">Opportunities</h4>
        <div class="discovery-embedded-content__opp-counts">
          <div class="discovery-embedded-content__opp-stat">
            <span class="discovery-embedded-content__opp-num discovery-embedded-content__opp-num--high">{{ store.highPriorityOpportunities.length }}</span>
            <span class="discovery-embedded-content__opp-label">High Priority</span>
          </div>
          <div class="discovery-embedded-content__opp-stat">
            <span class="discovery-embedded-content__opp-num discovery-embedded-content__opp-num--medium">{{ store.mediumPriorityOpportunities.length }}</span>
            <span class="discovery-embedded-content__opp-label">Medium Priority</span>
          </div>
          <div class="discovery-embedded-content__opp-stat">
            <span class="discovery-embedded-content__opp-num discovery-embedded-content__opp-num--low">{{ store.lowPriorityOpportunities.length }}</span>
            <span class="discovery-embedded-content__opp-label">Low Priority</span>
          </div>
        </div>
      </div>

      <div v-if="!discoveryComplete" class="discovery-embedded-content__actions">
        <button class="discovery-embedded-content__btn discovery-embedded-content__btn--primary" @click="confirmDiscovery">
          ✅ Confirm & Continue
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDiscoveryStore } from '../stores/useDiscoveryStore'

const props = defineProps<{
  projectId: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', data?: any): void
}>()

const store = useDiscoveryStore()
const entityInput = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const discoveryComplete = ref(false)

const scorePercent = computed(() => {
  if (!store.report) return 0
  return Math.min(store.report.adi, 100)
})

const adiColor = computed(() => {
  const score = store.report?.adi ?? 0
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
})

const adiLabel = computed(() => {
  const score = store.report?.adi ?? 0
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Moderate'
  return 'Critical'
})

async function search() {
  if (!entityInput.value.trim() || loading.value) return

  loading.value = true
  error.value = null
  discoveryComplete.value = false

  try {
    await store.evaluateEntity(entityInput.value.trim())
    if (!store.hasData) {
      error.value = 'No results found for this entity.'
    }
  } catch (err: any) {
    error.value = err?.message || 'Discovery failed'
  } finally {
    loading.value = false
  }
}

function confirmDiscovery() {
  discoveryComplete.value = true
  emit('complete', {
    entityName: store.report?.entityName || entityInput.value,
    adi: store.report?.adi || 0,
    coverageScore: store.report?.dimensions?.coverage || 0,
    shareScore: store.report?.dimensions?.share || 0,
    positionScore: store.report?.dimensions?.position || 0,
    reportData: store.report || {},
  })
}
</script>

<style scoped>
.discovery-embedded-content__search {
  margin-bottom: 16px;
}

.discovery-embedded-content__input-group {
  display: flex;
  gap: 8px;
}

.discovery-embedded-content__input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.discovery-embedded-content__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.discovery-embedded-content__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #3b82f6;
  color: #fff;
  transition: background 0.15s;
  white-space: nowrap;
}

.discovery-embedded-content__btn:hover:not(:disabled) {
  background: #2563eb;
}

.discovery-embedded-content__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.discovery-embedded-content__btn--primary {
  background: #22c55e;
}

.discovery-embedded-content__btn--primary:hover:not(:disabled) {
  background: #16a34a;
}

.discovery-embedded-content__spinner {
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

.discovery-embedded-content__spinner-lg {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin: 0 auto 12px;
}

.discovery-embedded-content__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
  text-align: center;
}

.discovery-embedded-content__state--empty {
  margin-top: 16px;
}

.discovery-embedded-content__error {
  margin-top: 8px;
  font-size: 13px;
  color: #dc2626;
}

.discovery-embedded-content__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}

.discovery-embedded-content__card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.discovery-embedded-content__score-row {
  display: flex;
  gap: 16px;
  align-items: center;
}

.discovery-embedded-content__score-ring {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.discovery-embedded-content__score-svg {
  width: 100%;
  height: 100%;
}

.discovery-embedded-content__score-arc {
  transition: stroke-dasharray 0.4s;
}

.discovery-embedded-content__score-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}

.discovery-embedded-content__score-info {
  flex: 1;
}

.discovery-embedded-content__entity {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.discovery-embedded-content__score-label {
  font-size: 12px;
  color: #6b7280;
}

.discovery-embedded-content__opp-counts {
  display: flex;
  gap: 16px;
}

.discovery-embedded-content__opp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.discovery-embedded-content__opp-num {
  font-size: 22px;
  font-weight: 700;
}

.discovery-embedded-content__opp-num--high { color: #dc2626; }
.discovery-embedded-content__opp-num--medium { color: #d97706; }
.discovery-embedded-content__opp-num--low { color: #6b7280; }

.discovery-embedded-content__opp-label {
  font-size: 11px;
  color: #9ca3af;
}

.discovery-embedded-content__actions {
  margin-top: 16px;
  text-align: center;
}
</style>
