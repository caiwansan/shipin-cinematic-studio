<template>
  <div
    :class="['ds-input-wrapper', `ds-input-wrapper--${inputType}`, classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
  >
    <label
      v-if="label"
      :for="inputId"
      class="ds-input__label"
    >
      {{ label }}
    </label>
    <div class="ds-input__container" :class="{ 'ds-input__container--focused': isFocused }">
      <span v-if="prefixIcon" class="ds-input__prefix" v-html="prefixIcon" />
      <input
        v-if="inputType === 'text' || inputType === 'password' || inputType === 'email' || inputType === 'number' || inputType === 'search'"
        :id="inputId"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        class="ds-input"
        :class="{ 'ds-input--has-prefix': !!prefixIcon, 'ds-input--has-suffix': !!suffixIcon }"
        v-bind="$attrs"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <textarea
        v-else-if="inputType === 'textarea'"
        :id="inputId"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :rows="rows"
        class="ds-input ds-input--textarea"
        v-bind="$attrs"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <select
        v-else-if="inputType === 'select'"
        :id="inputId"
        :value="modelValue"
        :disabled="disabled"
        class="ds-input ds-input--select"
        v-bind="$attrs"
        @change="onSelectChange"
        @focus="onFocus"
        @blur="onBlur"
      >
        <option v-if="placeholder" value="" disabled selected>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <span v-if="suffixIcon" class="ds-input__suffix" v-html="suffixIcon" />
    </div>
    <p v-if="hint" class="ds-input__hint">{{ hint }}</p>
    <p v-if="error" class="ds-input__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type InputType = 'text' | 'textarea' | 'select' | 'password' | 'email' | 'number' | 'search'

interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string | number
  inputType?: InputType
  label?: string
  placeholder?: string
  hint?: string
  error?: string
  disabled?: boolean
  readonly?: boolean
  rows?: number
  options?: SelectOption[]
  prefixIcon?: string
  suffixIcon?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  modelValue: '',
  inputType: 'text',
  disabled: false,
  readonly: false,
  rows: 3,
  options: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const inputId = computed(() => `ds-input-${Math.random().toString(36).slice(2, 9)}`)
const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const isFocused = ref(false)

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

function onSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}

function onFocus(event: FocusEvent) {
  isFocused.value = true
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
  isFocused.value = false
  emit('blur', event)
}
</script>

<style scoped>
.ds-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  width: 100%;
}

.ds-input__label {
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.ds-input__container {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface, #ffffff);
  transition: border-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-input__container--focused {
  border-color: var(--color-info, #3b82f6);
  box-shadow: 0 0 0 1px var(--color-info, #3b82f6);
}

.ds-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-primary, #111111);
  min-height: 40px;
}

.ds-input::placeholder {
  color: var(--color-text-tertiary, #9ca3af);
}

.ds-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--color-surface-dim, #f9fafb);
}

.ds-input--textarea {
  resize: vertical;
  min-height: 80px;
}

.ds-input--select {
  appearance: none;
  cursor: pointer;
  padding-right: var(--space-6, 32px);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.ds-input__prefix,
.ds-input__suffix {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2, 8px);
  color: var(--color-text-secondary, #6b7280);
}

.ds-input__hint {
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
  margin: 0;
}

.ds-input__error {
  font-size: var(--text-caption-size, 12px);
  color: var(--color-error, #ef4444);
  margin: 0;
}
</style>
