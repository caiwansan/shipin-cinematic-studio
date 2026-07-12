<!--
MissionSummaryBadge.vue — "Today's Focus · {total} Missions · {p0} High Priority"

Shows a brief overview of the missions for the day.
Only displays total count and P0 (high priority) count — not full distribution.
-->
<template>
  <div class="msb">
    <span class="msb__label">Today's Focus</span>
    <span class="msb__separator">·</span>
    <span class="msb__total">{{ totalText }}</span>
    <span class="msb__separator">·</span>
    <span class="msb__priority">{{ priorityText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MissionSummary } from '../../types/mission'

const props = defineProps<{
  summary: MissionSummary
}>()

const totalText = computed(() => {
  return `${props.summary.total} ${props.summary.total === 1 ? 'Mission' : 'Missions'}`
})

const priorityText = computed(() => {
  return `${props.summary.p0} High Priority`
})
</script>

<style scoped>
.msb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 100px;
  font-size: 14px;
  font-weight: 500;
  color: #0369a1;
  white-space: nowrap;
}

.msb__label {
  font-weight: 600;
  color: #0284c7;
}

.msb__separator {
  color: #7dd3fc;
}

.msb__total {
  font-weight: 600;
  color: #0369a1;
}

.msb__priority {
  font-weight: 600;
  color: #dc2626;
}
</style>
