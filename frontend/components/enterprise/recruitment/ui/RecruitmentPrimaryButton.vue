<template>
  <button
    class="rec-btn-primary"
    :class="{ 'rec-btn-loading': loading }"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="rec-btn-spinner"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
}>(), {
  loading: false,
  disabled: false,
})
</script>

<style scoped>
.rec-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-family);
  background: linear-gradient(135deg, var(--color-decision), var(--color-decision-soft));
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
  white-space: nowrap;
  line-height: 1;
}

.rec-btn-primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px var(--color-decision-glow);
  transform: translateY(-1px);
}

.rec-btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.rec-btn-primary:disabled {
  background: var(--color-bg-hover);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

/* ── Loading ── */
.rec-btn-loading {
  pointer-events: none;
  opacity: 0.8;
}

.rec-btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: rec-spin 0.6s linear infinite;
}

@keyframes rec-spin {
  to { transform: rotate(360deg); }
}
</style>
