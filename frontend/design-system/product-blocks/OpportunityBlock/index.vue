<template>
  <div :class="['opportunity-block', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="opportunity-block__title">{{ title }}</h3>
    <div class="opportunity-block__card">
      <div class="opportunity-block__content">
        <h4 class="opportunity-block__opportunity-title">{{ opportunityTitle }}</h4>
        <div class="opportunity-block__impact">
          <span class="opportunity-block__impact-label">Expected impact:</span>
          <span class="opportunity-block__impact-value">+{{ expectedImpact }} Brand Health</span>
        </div>
      </div>
      <button
        class="opportunity-block__cta"
        @click="$emit('takeAction')"
      >
        {{ ctaLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  opportunityTitle?: string
  expectedImpact?: number
  ctaLabel?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Next opportunity',
  opportunityTitle: '',
  expectedImpact: 0,
  ctaLabel: 'View in Recommendations',
})

defineEmits<{
  takeAction: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.opportunity-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.opportunity-block__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.opportunity-block__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  padding: var(--space-5, 24px);
  border-radius: var(--radius-lg, 12px);
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid #bbf7d0;
}

.opportunity-block__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.opportunity-block__opportunity-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.opportunity-block__impact {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.opportunity-block__impact-label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.opportunity-block__impact-value {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
}

.opportunity-block__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3, 12px) var(--space-5, 24px);
  border: none;
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-health, #22c55e);
  color: #ffffff;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
  align-self: flex-start;
}

.opportunity-block__cta:hover {
  background-color: #16a34a;
  transform: translateY(-1px);
}
</style>
