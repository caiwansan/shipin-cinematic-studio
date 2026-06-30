<template>
  <div :class="['ds-search-box', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div class="ds-search-box__container" :class="{ 'ds-search-box__container--focused': isFocused }">
      <span class="ds-search-box__icon" aria-hidden="true">🔍</span>
      <input
        ref="inputRef"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="ds-search-box__input"
        @input="onInput"
        @focus="isFocused = true"
        @blur="isFocused = false"
        @keydown.enter="$emit('search', modelValue)"
        :aria-label="placeholder || 'Search'"
      />
      <button
        v-if="modelValue && clearable"
        class="ds-search-box__clear"
        @click="clear"
        aria-label="Clear search"
        type="button"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  modelValue: '',
  placeholder: 'Search...',
  disabled: false,
  clearable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  clear: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
const isFocused = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function clear() {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}
</script>

<style scoped>
.ds-search-box {
  width: 100%;
}

.ds-search-box__container {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface, #ffffff);
  transition: border-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-search-box__container--focused {
  border-color: var(--color-info, #3b82f6);
  box-shadow: 0 0 0 1px var(--color-info, #3b82f6);
}

.ds-search-box__icon {
  display: flex;
  align-items: center;
  padding-left: var(--space-3, 12px);
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 16px;
}

.ds-search-box__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: var(--space-2, 8px) var(--space-2, 8px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-primary, #111111);
  min-height: 40px;
}

.ds-search-box__input::placeholder {
  color: var(--color-text-tertiary, #9ca3af);
}

.ds-search-box__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ds-search-box__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: var(--space-1, 4px);
  border: none;
  background: none;
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 18px;
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  transition: color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-search-box__clear:hover {
  color: var(--color-text-primary, #111111);
}
</style>
