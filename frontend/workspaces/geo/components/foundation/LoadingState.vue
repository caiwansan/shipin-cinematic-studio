<template>
  <div v-if="variant === 'skeleton'" class="foundation-loading foundation-loading--skeleton">
    <div class="foundation-loading__skeleton-row" v-for="i in 3" :key="i">
      <div
        class="foundation-loading__skeleton-bar"
        :style="{ width: i === 3 ? '60%' : i === 2 ? '85%' : '100%' }"
      ></div>
    </div>
  </div>

  <div v-else-if="variant === 'progress'" class="foundation-loading foundation-loading--progress">
    <div class="foundation-loading__progress-header">
      <span v-if="text" class="foundation-loading__text">{{ text }}</span>
      <span class="foundation-loading__percentage">{{ clampedProgress }}%</span>
    </div>
    <div class="foundation-loading__progress-track">
      <div
        class="foundation-loading__progress-fill"
        :style="{ width: `${clampedProgress}%` }"
      ></div>
    </div>
    <p v-if="description" class="foundation-loading__description">{{ description }}</p>
  </div>

  <div v-else class="foundation-loading foundation-loading--spinner">
    <div class="foundation-loading__spinner"></div>
    <p v-if="text" class="foundation-loading__text">{{ text }}</p>
    <p v-if="description" class="foundation-loading__description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  variant?: 'skeleton' | 'spinner' | 'progress'
  progress?: number
  description?: string
}>(), {
  variant: 'spinner',
  progress: 0,
})

const clampedProgress = computed(() =>
  Math.max(0, Math.min(100, props.progress ?? 0))
)
</script>

<style scoped>
.foundation-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  width: 100%;
}

/* ─── Skeleton ─── */
.foundation-loading--skeleton {
  align-items: stretch;
  gap: 12px;
  padding: 24px;
}

.foundation-loading__skeleton-row {
  height: 16px;
  border-radius: 6px;
}

.foundation-loading__skeleton-bar {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: foundation-shimmer 1.5s ease-in-out infinite;
}

@keyframes foundation-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Spinner ─── */
.foundation-loading--spinner {
  gap: 16px;
}

.foundation-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: foundation-spin 0.8s linear infinite;
}

@keyframes foundation-spin {
  to { transform: rotate(360deg); }
}

/* ─── Progress ─── */
.foundation-loading--progress {
  gap: 12px;
  align-items: stretch;
  max-width: 400px;
  margin: 0 auto;
}

.foundation-loading__progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.foundation-loading__progress-track {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.foundation-loading__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* ─── Shared text ─── */
.foundation-loading__text {
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  margin: 0;
  text-align: center;
}

.foundation-loading__description {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  text-align: center;
}

.foundation-loading__percentage {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
  white-space: nowrap;
}
</style>
