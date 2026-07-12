<template>
  <article
    class="geo-card"
    :class="{ 'geo-card--hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="emitViewInsight"
  >
    <!-- Row 1: Category badge + Status + Priority -->
    <div class="geo-card__header">
      <span class="geo-card__category">{{ knowledgeObject.category }}</span>
      <div class="geo-card__header-right">
        <span v-if="knowledgeObject.insight" :class="['geo-card__priority', `priority--${priorityClass(knowledgeObject.insight.recommendation.priority)}`]">
          ● {{ knowledgeObject.insight.recommendation.priority }}
        </span>
        <span :class="['geo-card__status', `geo-card__status--${knowledgeObject.status}`]">
          {{ statusLabel }}
        </span>
      </div>
    </div>

    <!-- Row 2: Content title (truncated 2 lines) -->
    <p class="geo-card__title">{{ knowledgeObject.content }}</p>

    <!-- Row 3: Quality / Review / AI Readiness -->
    <div class="geo-card__metrics">
      <span class="geo-card__metric" :class="`geo-card__metric--quality-${quality}`">
        Quality: {{ quality }}
      </span>
      <span class="geo-card__metric">
        Review: {{ reviewLabel }}
      </span>
      <span class="geo-card__metric" :class="aiReadinessClass">
        {{ aiReadiness }}
      </span>
    </div>

    <!-- Row 4: Next action hint -->
    <p class="geo-card__next">{{ nextActionText }}</p>

    <!-- Row 5: View Insight -->
    <div class="geo-card__action">
      <span class="geo-card__action-link" @click.stop="emitViewInsight">View Insight &rarr;</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KnowledgeObjectVM } from '../../viewmodels/KnowledgeBrowserVM'
import {
  computeQuality,
  reviewLabel,
  aiReadiness,
  nextAction,
} from '../../viewmodels/KnowledgeBrowserVM'

const props = defineProps<{
  knowledgeObject: KnowledgeObjectVM
}>()

const emit = defineEmits<{
  'view-insight': [objectId: string]
}>()

const isHovered = ref(false)

function priorityClass(priority: string): string {
  return priority ? priority.toLowerCase() : 'low'
}

const quality = computed(() => computeQuality(props.knowledgeObject))
const reviewLabel = computed(() => reviewLabel(props.knowledgeObject.status))
const aiReadiness = computed(() => aiReadiness(props.knowledgeObject))
const nextActionText = computed(() => nextAction(props.knowledgeObject))
const statusLabel = computed(() => {
  if (props.knowledgeObject.status === 'verified') return 'Verified'
  if (props.knowledgeObject.status === 'pending') return 'Pending'
  return 'Outdated'
})
const aiReadinessClass = computed(() =>
  aiReadiness.value === 'Ready' ? 'geo-card__metric--ready' : 'geo-card__metric--needs-improvement'
)

function emitViewInsight() {
  emit('view-insight', props.knowledgeObject.id)
}
</script>

<style scoped>
.geo-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: pointer;
}

.geo-card--hovered {
  border-color: #94a3b8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.geo-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.geo-card__category {
  padding: 3px 8px;
  border-radius: 4px;
  background: #eef2ff;
  font-size: 11px;
  color: #4f46e5;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.geo-card__status {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.geo-card__status--verified {
  background: #f0fdf4;
  color: #16a34a;
}

.geo-card__status--pending {
  background: #fefce8;
  color: #ca8a04;
}

.geo-card__status--outdated {
  background: #fef2f2;
  color: #dc2626;
}

.geo-card__title {
  font-size: 14px;
  color: #1a1a2e;
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 42px;
}

.geo-card__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.geo-card__metric {
  font-size: 11px;
  color: #64748b;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.geo-card__metric--quality-A {
  color: #16a34a;
  background: #f0fdf4;
  font-weight: 500;
}

.geo-card__metric--quality-B {
  color: #ca8a04;
  background: #fefce8;
  font-weight: 500;
}

.geo-card__metric--quality-C {
  color: #dc2626;
  background: #fef2f2;
  font-weight: 500;
}

.geo-card__metric--ready {
  color: #16a34a;
  background: #f0fdf4;
}

.geo-card__metric--needs-improvement {
  color: #ca8a04;
  background: #fefce8;
}

.geo-card__next {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
  font-style: italic;
}

.geo-card__action {
  margin-top: 4px;
}

.geo-card__action-link {
  font-size: 12px;
  color: #3b82f6;
  cursor: pointer;
  font-weight: 500;
}

.geo-card__action-link:hover {
  color: #2563eb;
}

.geo-card__header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.geo-card__priority {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.geo-card__priority.priority--high {
  color: #ef4444;
}

.geo-card__priority.priority--medium {
  color: #f59e0b;
}

.geo-card__priority.priority--low {
  color: #64748b;
}
</style>
