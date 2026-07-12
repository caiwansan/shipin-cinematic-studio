<template>
  <div
    :class="['geo-loading-state', className]"
    :data-testid="dataTestId"
    role="status"
    aria-live="polite"
  >
    <!-- Simple spinner mode -->
    <template v-if="mode === 'spinner'">
      <div class="geo-loading-state__spinner" />
      <p v-if="title" class="geo-loading-state__title">{{ title }}</p>
      <p v-if="description" class="geo-loading-state__description">{{ description }}</p>
    </template>

    <!-- Step-based loading mode (merges GeoLoading + DS LoadingState) -->
    <template v-else-if="mode === 'steps'">
      <div class="geo-loading-state__spinner" />
      <p v-if="title" class="geo-loading-state__title">{{ title }}</p>
      <div v-if="steps.length > 0" class="geo-loading-state__steps">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :class="[
            'geo-loading-state__step',
            {
              'geo-loading-state__step--active': stepStatus(index) === 'active',
              'geo-loading-state__step--complete': stepStatus(index) === 'complete',
            }
          ]"
        >
          <span class="geo-loading-state__step-icon">
            <span v-if="stepStatus(index) === 'complete'">✓</span>
            <span v-else-if="stepStatus(index) === 'active'" class="geo-loading-state__step-dot" />
            <span v-else class="geo-loading-state__step-number">{{ index + 1 }}</span>
          </span>
          <span class="geo-loading-state__step-label">{{ step.label }}</span>
        </div>
      </div>
    </template>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface LoadingStep {
  label: string
  icon?: string
}

type LoadingMode = 'spinner' | 'steps'

const props = withDefaults(defineProps<{
  /** Loading mode: simple spinner or step-based */
  mode?: LoadingMode
  /** Loading title */
  title?: string
  /** Loading description (spinner mode) */
  description?: string
  /** Steps for step-based loading */
  steps?: LoadingStep[]
  /** Current step index (step-based mode) */
  currentStep?: number
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  mode: 'spinner',
  steps: () => [],
  currentStep: 0,
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)

function stepStatus(index: number): 'pending' | 'active' | 'complete' {
  if (index < props.currentStep) return 'complete'
  if (index === props.currentStep) return 'active'
  return 'pending'
}
</script>

<style scoped>
.geo-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--geo-space-2xl, 24px) var(--geo-space-lg, 16px);
  text-align: center;
}

.geo-loading-state__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--geo-border, #e5e7eb);
  border-top-color: var(--geo-primary, #3b82f6);
  border-radius: 9999px;
  animation: geo-loading-spin 0.8s linear infinite;
  margin-bottom: var(--geo-space-lg, 16px);
}

@keyframes geo-loading-spin {
  to { transform: rotate(360deg); }
}

.geo-loading-state__title {
  margin: 0 0 var(--geo-space-sm, 8px);
  font-family: var(--geo-font, inherit);
  font-size: var(--geo-font-size-lg, 14px);
  font-weight: 600;
  color: var(--geo-text, #111827);
}

.geo-loading-state__description {
  margin: 0 0 var(--geo-space-sm, 8px);
  font-family: var(--geo-font, inherit);
  font-size: var(--geo-font-size-base, 13px);
  color: var(--geo-text-tertiary, #6b7280);
}

.geo-loading-state__steps {
  display: flex;
  flex-direction: column;
  gap: var(--geo-space-md, 12px);
  width: 100%;
  max-width: 320px;
}

.geo-loading-state__step {
  display: flex;
  align-items: center;
  gap: var(--geo-space-md, 12px);
  font-family: var(--geo-font, inherit);
  font-size: var(--geo-font-size-base, 13px);
  color: var(--geo-text-disabled, #9ca3af);
}

.geo-loading-state__step--active {
  color: var(--geo-text, #111827);
  font-weight: 500;
}

.geo-loading-state__step--complete {
  color: var(--geo-success, #059669);
}

.geo-loading-state__step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.geo-loading-state__step-dot {
  width: 8px;
  height: 8px;
  background-color: var(--geo-primary, #3b82f6);
  border-radius: 9999px;
  animation: geo-loading-pulse 1.2s ease-in-out infinite;
}

@keyframes geo-loading-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.geo-loading-state__step-number {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--geo-bg-secondary, #f9fafb);
  font-size: var(--geo-font-size-xs, 11px);
  font-weight: 500;
}
</style>
