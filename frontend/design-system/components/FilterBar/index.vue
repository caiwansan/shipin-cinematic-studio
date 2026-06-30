<template>
  <div :class="['ds-filter-bar', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div class="ds-filter-bar__filters">
      <div
        v-for="filter in filters"
        :key="filter.key"
        class="ds-filter-bar__item"
      >
        <select
          v-if="filter.type === 'select'"
          :value="activeFilters[filter.key]"
          class="ds-filter-bar__select"
          :aria-label="filter.label"
          @change="onFilterChange(filter.key, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ filter.label }}</option>
          <option
            v-for="option in filter.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <label
          v-else-if="filter.type === 'checkbox'"
          class="ds-filter-bar__checkbox"
        >
          <input
            type="checkbox"
            :checked="!!activeFilters[filter.key]"
            :aria-label="filter.label"
            @change="onFilterChange(filter.key, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ filter.label }}</span>
        </label>
      </div>
    </div>
    <div v-if="hasActiveFilters" class="ds-filter-bar__actions">
      <button class="ds-filter-bar__clear" @click="clearAll" type="button">
        Clear filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'

interface FilterOption {
  label: string
  value: string
}

interface FilterItem {
  key: string
  label: string
  type: 'select' | 'checkbox'
  options?: FilterOption[]
}

const props = withDefaults(defineProps<{
  filters?: FilterItem[]
  modelValue?: Record<string, string | boolean>
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  filters: () => [],
  modelValue: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string | boolean>]
  change: [key: string, value: string | boolean]
  clear: []
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const activeFilters = reactive<Record<string, string | boolean>>({ ...props.modelValue })

const hasActiveFilters = computed(() => {
  return Object.values(activeFilters).some(v => v !== '' && v !== false)
})

function onFilterChange(key: string, value: string | boolean) {
  activeFilters[key] = value
  emit('update:modelValue', { ...activeFilters })
  emit('change', key, value)
}

function clearAll() {
  for (const key of Object.keys(activeFilters)) {
    activeFilters[key] = ''
  }
  emit('update:modelValue', {})
  emit('clear')
}
</script>

<style scoped>
.ds-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  flex-wrap: wrap;
}

.ds-filter-bar__filters {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
  flex: 1;
}

.ds-filter-bar__select {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface, #ffffff);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-primary, #111111);
  min-height: 36px;
  cursor: pointer;
  transition: border-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-filter-bar__select:focus {
  border-color: var(--color-info, #3b82f6);
  outline: none;
}

.ds-filter-bar__checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  user-select: none;
}

.ds-filter-bar__checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.ds-filter-bar__actions {
  flex-shrink: 0;
}

.ds-filter-bar__clear {
  border: none;
  background: none;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-info, #3b82f6);
  cursor: pointer;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-sm, 4px);
  transition: background-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-filter-bar__clear:hover {
  background-color: #eff6ff;
}
</style>
