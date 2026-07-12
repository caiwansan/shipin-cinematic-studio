<template>
  <div class="ai-result" data-testid="ai-result">
    <!-- Summary -->
    <p class="ai-result__summary">{{ result.summary }}</p>

    <!-- Findings -->
    <div v-if="result.findings?.length" class="ai-result__findings">
      <div
        v-for="finding in result.findings"
        :key="finding.id"
        class="ai-result__finding"
      >
        <p class="ai-result__finding-summary">{{ finding.summary }}</p>
        <p v-if="finding.detail" class="ai-result__finding-detail">{{ finding.detail }}</p>
        <p v-if="finding.impact" class="ai-result__finding-impact">{{ finding.impact }}</p>
        <ConfidenceBadge v-if="finding.confidence" :confidence="finding.confidence" />
      </div>
    </div>

    <!-- Impact (hidden in compact) -->
    <p v-if="!compact && result.impact" class="ai-result__impact">{{ result.impact }}</p>

    <!-- Recommendation (hidden in compact) -->
    <div v-if="!compact && result.recommendation" class="ai-result__recommendation">
      <p class="ai-result__recommendation-text">{{ result.recommendation }}</p>
    </div>

    <!-- Confidence (hidden in compact) -->
    <ConfidenceBadge
      v-if="!compact && result.confidence"
      :confidence="result.confidence"
    />
  </div>
</template>

<script setup lang="ts">
import type { AIResultModel } from '~/workspaces/geo/types/ai'
import ConfidenceBadge from './ConfidenceBadge.vue'

interface AIResultProps {
  result: AIResultModel
  compact?: boolean
}

defineProps<AIResultProps>()
</script>

<style scoped>
.ai-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-result__summary {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: #111827;
  margin: 0;
}

.ai-result__findings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-result__finding {
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 3px solid #e5e7eb;
}

.ai-result__finding-summary {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  margin: 0 0 4px;
}

.ai-result__finding-detail {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0 0 4px;
}

.ai-result__finding-impact {
  font-size: 0.8125rem;
  color: #6366f1;
  margin: 0 0 4px;
}

.ai-result__impact {
  font-size: 0.875rem;
  color: #4b5563;
  padding: 8px 0;
  border-top: 1px solid #e5e7eb;
  margin: 0;
}

.ai-result__recommendation {
  padding: 10px 12px;
  background: #f0fdf4;
  border-radius: 6px;
  border: 1px solid #bbf7d0;
}

.ai-result__recommendation-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #166534;
  margin: 0;
}
</style>
