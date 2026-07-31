<template>
  <select
    class="rec-select"
    :value="modelValue"
    :disabled="disabled"
    v-bind="$attrs"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <slot />
  </select>
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped>
.rec-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: 8px;
  font-size: 13px;
  font-family: var(--font-family);
  cursor: pointer;
  transition: border-color 0.12s;
  outline: none;
  min-width: 120px;
}

.rec-select:focus {
  border-color: var(--color-decision);
  box-shadow: 0 0 0 1px var(--color-decision-glow);
}

.rec-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
