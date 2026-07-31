<template>
  <span class="rec-badge" :class="[variant, { 'rec-badge--pill': pill }]">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  pill?: boolean
}>(), {
  variant: 'default',
  pill: false,
})
</script>

<style scoped>
.rec-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

.rec-badge--pill {
  border-radius: 20px;
}

/* ── Variants ── */
.rec-badge.default {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.rec-badge.success {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-execution);
}

.rec-badge.warning {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
}

.rec-badge.danger {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger);
}

.rec-badge.info {
  background: var(--color-decision-glow);
  color: var(--color-decision);
}

.rec-badge.neutral {
  background: rgba(100, 116, 139, 0.12);
  color: var(--color-text-muted);
}
</style>
