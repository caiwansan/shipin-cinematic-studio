<template>
  <span
    class="biz-impact-badge"
    :class="`biz-impact-badge--${levelClass}`"
  >
    <span class="biz-impact-badge__dot" />
    <span class="biz-impact-badge__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  impact: 'very-high' | 'high' | 'medium' | 'low' | string
  label?: string
}>()

const levelClass = computed(() => {
  switch (props.impact) {
    case 'very-high': return 'very-high'
    case 'high': return 'high'
    case 'medium': return 'medium'
    case 'low': return 'low'
    default: return 'medium'
  }
})

const label = computed(() => {
  if (props.label) return props.label
  switch (props.impact) {
    case 'very-high': return 'Very High'
    case 'high': return 'High'
    case 'medium': return 'Medium'
    case 'low': return 'Low'
    default: return props.impact
  }
})
</script>

<style scoped>
.biz-impact-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.biz-impact-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

/* Very High */
.biz-impact-badge--very-high {
  background: #fef2f2;
  color: #991b1b;
}
.biz-impact-badge--very-high .biz-impact-badge__dot {
  background: #dc2626;
}

/* High */
.biz-impact-badge--high {
  background: #fff7ed;
  color: #9a3412;
}
.biz-impact-badge--high .biz-impact-badge__dot {
  background: #f97316;
}

/* Medium */
.biz-impact-badge--medium {
  background: #fffbeb;
  color: #92400e;
}
.biz-impact-badge--medium .biz-impact-badge__dot {
  background: #eab308;
}

/* Low */
.biz-impact-badge--low {
  background: #f0fdf4;
  color: #166534;
}
.biz-impact-badge--low .biz-impact-badge__dot {
  background: #22c55e;
}
</style>
