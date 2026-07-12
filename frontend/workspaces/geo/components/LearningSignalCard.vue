<!--
  LearningSignalCard.vue — Sprint 4-4: Growth Signal 结构化

  Renders a single signal category (AI Cognition / Content / External Reference)
  with its positive signals and explain support.

  Reuses:
    - GeoExplainButton for Explain Model trigger
    - SIGNAL_CATEGORY_LABELS, SIGNAL_CATEGORY_ICONS from types
-->
<template>
  <div class="signal-card" :class="`signal-card--${category}`">
    <div class="signal-card__header">
      <span class="signal-card__icon">{{ icon }}</span>
      <div class="signal-card__header-info">
        <span class="signal-card__category">{{ label }}</span>
        <span class="signal-card__count">{{ signals.length }} 个信号</span>
      </div>
    </div>

    <div v-if="signals.length === 0" class="signal-card__empty">
      <p class="signal-card__empty-text">暂未检测到 {{ label }}</p>
    </div>

    <div v-else class="signal-card__list">
      <div
        v-for="signal in signals"
        :key="signal.id"
        class="signal-card__item"
      >
        <div class="signal-card__item-header">
          <span class="signal-card__item-title">{{ signal.title }}</span>
          <span
            class="signal-card__magnitude"
            :class="`signal-card__magnitude--${signal.direction}`"
          >
            {{ signal.magnitude }}%
          </span>
        </div>
        <p class="signal-card__item-summary">{{ signal.summary }}</p>
        <div class="signal-card__item-meta">
          <span v-if="signal.previousValue !== undefined" class="signal-card__item-change">
            {{ signal.previousValue }} → {{ signal.currentValue }}
          </span>
        </div>
        <!-- Explain Support — reuse ExplainModel -->
        <button
          v-if="signal.explain"
          class="signal-card__explain-btn"
          @click="toggleExplain(signal.id)"
          :aria-expanded="expandedSignalId === signal.id"
        >
          {{ expandedSignalId === signal.id ? '收起解释' : '为什么这个信号重要？' }}
          <span
            class="signal-card__explain-arrow"
            :class="{ 'signal-card__explain-arrow--open': expandedSignalId === signal.id }"
          >▾</span>
        </button>
        <div v-if="expandedSignalId === signal.id" class="signal-card__explain-content">
          <div class="signal-card__explain-row">
            <span class="signal-card__explain-label">发生了什么</span>
            <p class="signal-card__explain-text">{{ signal.explain.what }}</p>
          </div>
          <div class="signal-card__explain-row">
            <span class="signal-card__explain-label">为什么</span>
            <p class="signal-card__explain-text">{{ signal.explain.why }}</p>
          </div>
          <div v-if="signal.explain.whyNow" class="signal-card__explain-row">
            <span class="signal-card__explain-label">为什么现在</span>
            <p class="signal-card__explain-text">{{ signal.explain.whyNow }}</p>
          </div>
          <div class="signal-card__explain-row">
            <span class="signal-card__explain-label">对品牌的影响</span>
            <p class="signal-card__explain-text">{{ signal.explain.impact }}</p>
          </div>
          <div class="signal-card__explain-row">
            <span class="signal-card__explain-label">建议</span>
            <p class="signal-card__explain-text signal-card__explain-text--recommendation">
              {{ signal.explain.recommendation }}
            </p>
          </div>
          <div v-if="signal.explain.evidence.length > 0" class="signal-card__explain-evidence">
            <span class="signal-card__explain-label">证据</span>
            <div v-for="ev in signal.explain.evidence" :key="ev.id" class="signal-card__evidence-item">
              <span class="signal-card__evidence-type">{{ ev.type }}</span>
              <span class="signal-card__evidence-summary">{{ ev.summary }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ref, computed } from 'vue'
import type { LearningSignal, SignalCategory } from '../types/learning/learning-signal'
import { SIGNAL_CATEGORY_LABELS, SIGNAL_CATEGORY_ICONS } from '../types/learning/learning-signal'

export default {
  name: 'LearningSignalCard',
  props: {
    signals: {
      type: Array as () => LearningSignal[],
      default: () => [],
    },
    category: {
      type: String as () => SignalCategory,
      default: 'ai_cognition' as SignalCategory,
    },
  },
  setup(props) {
    const expandedSignalId = ref<string | null>(null)
    const icon = computed(() => SIGNAL_CATEGORY_ICONS[props.category] || '🧠')
    const label = computed(() => SIGNAL_CATEGORY_LABELS[props.category] || '未知')

    function toggleExplain(signalId: string) {
      expandedSignalId.value = expandedSignalId.value === signalId ? null : signalId
    }

    return { expandedSignalId, icon, label, toggleExplain }
  },
}
</script>

<style scoped>
.signal-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  transition: border-color 0.15s;
}

.signal-card:hover {
  border-color: #d1d5db;
}

.signal-card--ai_cognition {
  border-left: 3px solid #8b5cf6;
}

.signal-card--content {
  border-left: 3px solid #3b82f6;
}

.signal-card--external_reference {
  border-left: 3px solid #f59e0b;
}

/* ===== Header ===== */
.signal-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.signal-card__icon {
  font-size: 20px;
  line-height: 1;
}

.signal-card__header-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.signal-card__category {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.signal-card__count {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

/* ===== Empty ===== */
.signal-card__empty {
  padding: 8px 0;
}

.signal-card__empty-text {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  font-style: italic;
}

/* ===== Items ===== */
.signal-card__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.signal-card__item {
  padding: 8px 0;
  border-top: 1px solid #f3f4f6;
}

.signal-card__item:first-child {
  border-top: none;
  padding-top: 0;
}

.signal-card__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.signal-card__item-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.signal-card__magnitude {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.signal-card__magnitude--positive {
  background: #dcfce7;
  color: #166534;
}

.signal-card__magnitude--negative {
  background: #fef2f2;
  color: #991b1b;
}

.signal-card__magnitude--neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.signal-card__item-summary {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 4px;
  line-height: 1.4;
}

.signal-card__item-meta {
  font-size: 11px;
  color: #9ca3af;
}

.signal-card__item-change {
  font-family: monospace;
}

/* ===== Explain Button ===== */
.signal-card__explain-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 3px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #f9fafb;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.signal-card__explain-btn:hover {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.signal-card__explain-arrow {
  font-size: 8px;
  transition: transform 0.15s;
}

.signal-card__explain-arrow--open {
  transform: rotate(180deg);
}

/* ===== Explain Content ===== */
.signal-card__explain-content {
  margin-top: 8px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #f3f4f6;
  animation: fadeInSlideDown 0.25s ease;
}

@keyframes fadeInSlideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.signal-card__explain-row {
  margin-bottom: 8px;
}

.signal-card__explain-row:last-child {
  margin-bottom: 0;
}

.signal-card__explain-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.signal-card__explain-text {
  font-size: 13px;
  color: #374151;
  margin: 0;
  line-height: 1.5;
}

.signal-card__explain-text--recommendation {
  font-weight: 500;
  color: #1e40af;
}

/* ===== Evidence ===== */
.signal-card__explain-evidence {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e5e7eb;
}

.signal-card__evidence-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.signal-card__evidence-type {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: #e5e7eb;
  color: #6b7280;
  text-transform: uppercase;
}

.signal-card__evidence-summary {
  font-size: 12px;
  color: #6b7280;
}
</style>
