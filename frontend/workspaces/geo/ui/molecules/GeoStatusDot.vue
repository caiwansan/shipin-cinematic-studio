<template>
  <div
    :class="[
      'geo-status-dot',
      {
        'geo-status-dot--with-label': label !== undefined,
      },
      className,
    ]"
    :data-testid="dataTestId"
  >
    <span
      class="geo-status-dot__indicator"
      :class="`geo-status-dot__indicator--${status}`"
    />
    <span v-if="label !== undefined" class="geo-status-dot__label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'checking' | 'unknown'
type ChipVariant = 'pending' | 'completed' | 'skipped' | 'later' | 'connected' | 'not-set-up'

const props = withDefaults(defineProps<{
  /** Status type for the dot indicator */
  status?: StatusType | ChipVariant
  /** Optional label text */
  label?: string
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  status: 'unknown',
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.geo-status-dot {
  display: inline-flex;
  align-items: center;
  gap: var(--geo-space-xs, 4px);
  font-family: var(--geo-font, inherit);
  font-size: var(--geo-font-size-xs, 11px);
  font-weight: 500;
  line-height: 1;
}

.geo-status-dot--with-label {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
}

/* Dot indicator */
.geo-status-dot__indicator {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.geo-status-dot__label {
  line-height: 1;
}

/* Status variants */
.geo-status-dot__indicator--success,
.geo-status-dot__indicator--completed,
.geo-status-dot__indicator--connected {
  background-color: var(--geo-success, #059669);
}
.geo-status-dot--with-label.geo-status-dot__indicator--success,
.geo-status-dot--with-label.geo-status-dot__indicator--completed,
.geo-status-dot--with-label.geo-status-dot__indicator--connected {
  background-color: var(--geo-success-bg, #f0fdf4);
  color: var(--geo-success, #059669);
  border-color: currentColor;
}
.geo-status-dot--with-label.geo-status-dot__indicator--success .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--completed .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--connected .geo-status-dot__indicator {
  background-color: currentColor;
}

.geo-status-dot__indicator--warning,
.geo-status-dot__indicator--pending,
.geo-status-dot__indicator--checking {
  background-color: var(--geo-warning, #d97706);
}
.geo-status-dot--with-label.geo-status-dot__indicator--warning,
.geo-status-dot--with-label.geo-status-dot__indicator--pending,
.geo-status-dot--with-label.geo-status-dot__indicator--checking {
  background-color: var(--geo-warning-bg, #fffbeb);
  color: var(--geo-warning, #d97706);
  border-color: currentColor;
}
.geo-status-dot--with-label.geo-status-dot__indicator--warning .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--pending .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--checking .geo-status-dot__indicator {
  background-color: currentColor;
}

.geo-status-dot__indicator--error,
.geo-status-dot__indicator--not-set-up {
  background-color: var(--geo-error, #dc2626);
}
.geo-status-dot--with-label.geo-status-dot__indicator--error,
.geo-status-dot--with-label.geo-status-dot__indicator--not-set-up {
  background-color: var(--geo-error-bg, #fef2f2);
  color: var(--geo-error, #dc2626);
  border-color: currentColor;
}
.geo-status-dot--with-label.geo-status-dot__indicator--error .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--not-set-up .geo-status-dot__indicator {
  background-color: currentColor;
}

.geo-status-dot__indicator--info {
  background-color: var(--geo-info, #3b82f6);
}
.geo-status-dot--with-label.geo-status-dot__indicator--info {
  background-color: var(--geo-info-bg, #eff6ff);
  color: var(--geo-info, #3b82f6);
  border-color: currentColor;
}
.geo-status-dot--with-label.geo-status-dot__indicator--info .geo-status-dot__indicator {
  background-color: currentColor;
}

.geo-status-dot__indicator--unknown,
.geo-status-dot__indicator--later,
.geo-status-dot__indicator--skipped {
  background-color: var(--geo-text-disabled, #9ca3af);
}
.geo-status-dot--with-label.geo-status-dot__indicator--unknown,
.geo-status-dot--with-label.geo-status-dot__indicator--later,
.geo-status-dot--with-label.geo-status-dot__indicator--skipped {
  background-color: var(--geo-bg-secondary, #f9fafb);
  color: var(--geo-text-tertiary, #6b7280);
  border-color: var(--geo-border, #e5e7eb);
}
.geo-status-dot--with-label.geo-status-dot__indicator--unknown .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--later .geo-status-dot__indicator,
.geo-status-dot--with-label.geo-status-dot__indicator--skipped .geo-status-dot__indicator {
  background-color: currentColor;
}
</style>
