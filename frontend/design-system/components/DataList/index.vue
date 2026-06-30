<template>
  <div :class="['ds-data-list', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div v-if="$slots.header || title" class="ds-data-list__header">
      <slot name="header">
        <h3 v-if="title" class="ds-data-list__title">{{ title }}</h3>
      </slot>
    </div>
    <div v-if="columns && columns.length > 0" class="ds-data-list__table">
      <div class="ds-data-list__thead">
        <div class="ds-data-list__tr">
          <div
            v-for="col in columns"
            :key="col.key"
            class="ds-data-list__th"
            :style="col.width ? { width: col.width } : undefined"
          >
            {{ col.label }}
          </div>
        </div>
      </div>
      <div v-if="items && items.length > 0" class="ds-data-list__tbody">
        <div
          v-for="(item, rowIndex) in items"
          :key="rowIndex"
          :class="['ds-data-list__tr', { 'ds-data-list__tr--clickable': !!$attrs.onRowClick }]"
          @click="$emit('rowClick', item)"
        >
          <div
            v-for="col in columns"
            :key="col.key"
            class="ds-data-list__td"
          >
            <slot :name="`cell-${col.key}`" :item="item" :value="item[col.key]" :row-index="rowIndex">
              {{ formatCellValue(item[col.key]) }}
            </slot>
          </div>
        </div>
      </div>
      <div v-else class="ds-data-list__empty">
        <p>{{ emptyText }}</p>
      </div>
    </div>
    <div v-else-if="items && items.length > 0" class="ds-data-list__list">
      <div
        v-for="(item, index) in items"
        :key="index"
        :class="['ds-data-list__list-item', { 'ds-data-list__list-item--clickable': !!$attrs.onRowClick }]"
        @click="$emit('rowClick', item)"
      >
        <slot name="item" :item="item" :index="index">
          <div class="ds-data-list__list-item-content">
            <div v-for="(value, key) in item" :key="String(key)" class="ds-data-list__list-item-field">
              <span class="ds-data-list__list-item-label">{{ key }}</span>
              <span class="ds-data-list__list-item-value">{{ formatCellValue(value) }}</span>
            </div>
          </div>
        </slot>
      </div>
    </div>
    <div v-else class="ds-data-list__empty">
      <p>{{ emptyText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ColumnDef {
  key: string
  label: string
  width?: string
  formatter?: (value: unknown) => string
}

const props = withDefaults(defineProps<{
  title?: string
  columns?: ColumnDef[]
  items?: Record<string, unknown>[]
  emptyText?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  items: () => [],
  columns: () => [],
  emptyText: 'No data available.',
})

const emit = defineEmits<{
  rowClick: [item: Record<string, unknown>]
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped>
.ds-data-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  background-color: var(--color-surface, #ffffff);
}

.ds-data-list__header {
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.ds-data-list__title {
  margin: 0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
}

.ds-data-list__table {
  overflow-x: auto;
}

.ds-data-list__thead {
  background-color: var(--color-surface-dim, #f9fafb);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.ds-data-list__tr {
  display: flex;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.ds-data-list__tr:last-child {
  border-bottom: none;
}

.ds-data-list__tr--clickable {
  cursor: pointer;
  transition: background-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-data-list__tr--clickable:hover {
  background-color: var(--color-surface-dim, #f9fafb);
}

.ds-data-list__th {
  flex: 1;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  white-space: nowrap;
}

.ds-data-list__td {
  flex: 1;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-primary, #111111);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-data-list__empty {
  padding: var(--space-8, 64px) var(--space-4, 16px);
  text-align: center;
}

.ds-data-list__empty p {
  margin: 0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-tertiary, #9ca3af);
}

/* List view */
.ds-data-list__list {
  display: flex;
  flex-direction: column;
}

.ds-data-list__list-item {
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.ds-data-list__list-item:last-child {
  border-bottom: none;
}

.ds-data-list__list-item--clickable {
  cursor: pointer;
  transition: background-color var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-data-list__list-item--clickable:hover {
  background-color: var(--color-surface-dim, #f9fafb);
}

.ds-data-list__list-item-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
}

.ds-data-list__list-item-field {
  display: flex;
  gap: var(--space-2, 8px);
}

.ds-data-list__list-item-label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
  color: var(--color-text-tertiary, #9ca3af);
  min-width: 80px;
}

.ds-data-list__list-item-value {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-primary, #111111);
}
</style>
