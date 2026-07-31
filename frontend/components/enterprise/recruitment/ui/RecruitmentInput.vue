<template>
  <input
    class="rec-input"
    :class="{ 'rec-input--textarea': isTextarea }"
    :placeholder="placeholder"
    :disabled="disabled"
    v-bind="$attrs"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  isTextarea?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped>
.rec-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: 8px;
  font-size: 13px;
  font-family: var(--font-family);
  transition: border-color 0.12s;
  outline: none;
  box-sizing: border-box;
}

.rec-input::placeholder {
  color: var(--color-text-muted);
}

.rec-input:focus {
  border-color: var(--color-decision);
  box-shadow: 0 0 0 1px var(--color-decision-glow);
}

.rec-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
