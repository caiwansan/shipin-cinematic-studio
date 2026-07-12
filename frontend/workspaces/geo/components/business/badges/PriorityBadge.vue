<template>
  <span
    class="priority-badge"
    :class="`priority-badge--${priority}`"
    :style="{ backgroundColor: color }"
    :data-testid="`priority-badge priority-badge-${priority}`"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PriorityLevel } from '~/workspaces/geo/types/business'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '~/workspaces/geo/types/business'

const props = defineProps<{
  priority: PriorityLevel
}>()

const color = computed(() => PRIORITY_COLORS[props.priority])
const label = computed(() => PRIORITY_LABELS[props.priority])
</script>

<style scoped>
.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  line-height: 1.5;
  white-space: nowrap;
}
</style>
