<template>
  <span
    v-if="confidence.level !== 'unavailable'"
    class="confidence-badge"
    :class="`confidence-badge--${confidence.level}`"
    data-testid="confidence-badge"
  >
    <span class="confidence-badge__dot" />
    <span v-if="showLabel" class="confidence-badge__label">{{ confidence.label }}</span>
  </span>
</template>

<script setup lang="ts">
import type { Confidence } from '~/workspaces/geo/types/ai'

interface ConfidenceBadgeProps {
  confidence: Confidence
  showLabel?: boolean
}

const props = withDefaults(defineProps<ConfidenceBadgeProps>(), {
  showLabel: true,
})
</script>

<style scoped>
.confidence-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  line-height: 1;
  white-space: nowrap;
}

.confidence-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.confidence-badge__label {
  font-weight: 500;
}

/* Levels */
.confidence-badge--high {
  color: #22c55e;
}
.confidence-badge--high .confidence-badge__dot {
  background-color: #22c55e;
}

.confidence-badge--medium {
  color: #eab308;
}
.confidence-badge--medium .confidence-badge__dot {
  background-color: #eab308;
}

.confidence-badge--low {
  color: #9ca3af;
}
.confidence-badge--low .confidence-badge__dot {
  background-color: #9ca3af;
}
</style>
