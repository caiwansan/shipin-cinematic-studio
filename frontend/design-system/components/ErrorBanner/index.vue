<template>
  <div :class="['ds-error-banner', classOverride]" :style="styleOverride" :data-testid="dataTestId" role="alert" aria-live="assertive">
    <div class="ds-error-banner__icon">
      <span class="ds-error-banner__icon-mark">!</span>
    </div>
    <div class="ds-error-banner__content">
      <p v-if="title" class="ds-error-banner__title">{{ title }}</p>
      <p v-if="message" class="ds-error-banner__message">{{ message }}</p>
      <div v-if="$slots.default" class="ds-error-banner__actions">
        <slot />
      </div>
    </div>
    <button
      v-if="dismissible"
      class="ds-error-banner__dismiss"
      @click="$emit('dismiss')"
      aria-label="Dismiss error"
      type="button"
    >
      &times;
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  message?: string
  dismissible?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  dismissible: false,
})

defineEmits<{
  dismiss: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-error-banner {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: #fef2f2;
  border: 1px solid #fecaca;
}

.ds-error-banner__icon {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}

.ds-error-banner__icon-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-error, #ef4444);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
}

.ds-error-banner__content {
  flex: 1;
  min-width: 0;
}

.ds-error-banner__title {
  margin: 0 0 var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  color: #991b1b;
}

.ds-error-banner__message {
  margin: 0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: #b91c1c;
  line-height: 1.5;
}

.ds-error-banner__actions {
  margin-top: var(--space-2, 8px);
  display: flex;
  gap: var(--space-2, 8px);
}

.ds-error-banner__dismiss {
  display: flex;
  align-items: flex-start;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-error, #ef4444);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
  transition: opacity var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-error-banner__dismiss:hover {
  opacity: 1;
}
</style>
