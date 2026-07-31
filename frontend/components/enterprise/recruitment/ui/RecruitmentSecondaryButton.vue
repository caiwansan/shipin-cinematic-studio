<template>
  <button
    class="rec-btn-secondary"
    :disabled="disabled"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  disabled?: boolean
}>(), {
  disabled: false,
})
</script>

<style scoped>
.rec-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-family);
  background: transparent;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  line-height: 1;
}

.rec-btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: var(--color-text-disabled);
  color: var(--color-text-primary);
}

.rec-btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
