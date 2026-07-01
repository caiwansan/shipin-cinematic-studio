<template>
  <div class="geo-explain-card">
    <!-- Block 1: Title + Close -->
    <div class="geo-explain-card__header">
      <h3 class="geo-explain-card__title">
        <span class="geo-explain-card__title-icon">💡</span>
        {{ explain?.title || '解释' }}
      </h3>
      <button class="geo-explain-card__close-btn" @click="$emit('close')" title="关闭">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="geo-explain-card__loading">
      <div class="geo-explain-card__spinner" />
      <span>正在生成解释...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="geo-explain-card__error">
      <span class="geo-explain-card__error-icon">⚠️</span>
      <span>{{ error }}</span>
    </div>

    <!-- Data State -->
    <template v-else-if="explain">
      <!-- Block 2: Summary -->
      <div class="geo-explain-card__block geo-explain-card__summary">
        <p>{{ explain.summary }}</p>
      </div>

      <!-- Block 3: Score + Confidence -->
      <div class="geo-explain-card__block geo-explain-card__score-row">
        <div v-if="explain.score !== undefined" class="geo-explain-card__score-item">
          <span class="geo-explain-card__score-label">Score</span>
          <span class="geo-explain-card__score-value" :class="scoreColorClass(explain.score)">{{ explain.score }}</span>
        </div>
        <div class="geo-explain-card__score-item">
          <span class="geo-explain-card__score-label">Confidence</span>
          <span class="geo-explain-card__score-value" :class="confidenceColorClass(explain.confidence)">{{ explain.confidence }}%</span>
        </div>
      </div>

      <!-- Block 4: Reasons (Top 3) -->
      <div v-if="explain.reasons.length > 0" class="geo-explain-card__block">
        <h4 class="geo-explain-card__block-title">主要原因</h4>
        <ul class="geo-explain-card__reasons">
          <li
            v-for="(reason, idx) in explain.reasons.slice(0, 3)"
            :key="idx"
            class="geo-explain-card__reason"
            :class="`geo-explain-card__reason--${reason.severity}`"
          >
            <span class="geo-explain-card__reason-dot" />
            <span>{{ reason.label }}</span>
          </li>
        </ul>
      </div>

      <!-- Block 5: Evidence Sources -->
      <div v-if="explain.evidence.length > 0" class="geo-explain-card__block">
        <h4 class="geo-explain-card__block-title">数据来源</h4>
        <div class="geo-explain-card__evidence-list">
          <div
            v-for="(ev, idx) in explain.evidence"
            :key="idx"
            class="geo-explain-card__evidence-item"
          >
            <span class="geo-explain-card__evidence-source">{{ ev.source }}</span>
            <span class="geo-explain-card__evidence-detail">{{ ev.detail }}</span>
          </div>
        </div>
      </div>

      <!-- Block 6: Recommendations -->
      <div v-if="explain.recommendations.length > 0" class="geo-explain-card__block">
        <h4 class="geo-explain-card__block-title">推荐操作</h4>
        <div class="geo-explain-card__rec-list">
          <div
            v-for="(rec, idx) in explain.recommendations.slice(0, 4)"
            :key="idx"
            class="geo-explain-card__rec-item"
            :class="`geo-explain-card__rec--${rec.priority}`"
          >
            <div class="geo-explain-card__rec-header">
              <span class="geo-explain-card__rec-priority-dot" />
              <span class="geo-explain-card__rec-action">{{ rec.action }}</span>
            </div>
            <span class="geo-explain-card__rec-impact">{{ rec.impact }}</span>
          </div>
        </div>
      </div>

      <!-- Block 7: Learn More Tips -->
      <div v-if="explain.suggestions.length > 0" class="geo-explain-card__block geo-explain-card__learn-more">
        <h4 class="geo-explain-card__block-title">了解更多</h4>
        <ul class="geo-explain-card__suggestions">
          <li v-for="(s, idx) in explain.suggestions" :key="idx">{{ s }}</li>
        </ul>
      </div>

      <!-- Footer: updatedAt & citations -->
      <div class="geo-explain-card__footer">
        <span class="geo-explain-card__updated">{{ formatDate(explain.updatedAt) }}</span>
        <span v-if="explain.citations.length > 0" class="geo-explain-card__citations-count">
          {{ explain.citations.length }} 条引用
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ExplainResult } from '../../types/explain'

defineProps<{
  explain: ExplainResult | null
  loading: boolean
  error: string | null
}>()

defineEmits<{
  close: []
}>()

function scoreColorClass(score: number): string {
  if (score >= 80) return 'geo-explain-card__score--high'
  if (score >= 60) return 'geo-explain-card__score--medium'
  if (score >= 40) return 'geo-explain-card__score--low'
  return 'geo-explain-card__score--critical'
}

function confidenceColorClass(confidence: number): string {
  if (confidence >= 70) return 'geo-explain-card__score--high'
  if (confidence >= 40) return 'geo-explain-card__score--medium'
  return 'geo-explain-card__score--low'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.geo-explain-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  font-family: Inter, -apple-system, sans-serif;
  color: #111827;
}

/* ===== Header ===== */
.geo-explain-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.geo-explain-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: #111827;
}

.geo-explain-card__title-icon {
  font-size: 18px;
}

.geo-explain-card__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.geo-explain-card__close-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

/* ===== Blocks ===== */
.geo-explain-card__block {
  padding: 12px 20px;
  border-bottom: 1px solid #f9fafb;
}

.geo-explain-card__block:last-of-type {
  border-bottom: none;
}

.geo-explain-card__block-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
}

/* ===== Summary ===== */
.geo-explain-card__summary p {
  font-size: 14px;
  line-height: 1.6;
  color: #374151;
  margin: 0;
}

/* ===== Score Row ===== */
.geo-explain-card__score-row {
  display: flex;
  gap: 24px;
  padding-top: 16px;
  padding-bottom: 16px;
}

.geo-explain-card__score-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-explain-card__score-label {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.geo-explain-card__score-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.geo-explain-card__score--high {
  color: #16a34a;
}

.geo-explain-card__score--medium {
  color: #3b82f6;
}

.geo-explain-card__score--low {
  color: #f59e0b;
}

.geo-explain-card__score--critical {
  color: #ef4444;
}

/* ===== Reasons ===== */
.geo-explain-card__reasons {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-explain-card__reason {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
}

.geo-explain-card__reason-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.geo-explain-card__reason--high .geo-explain-card__reason-dot {
  background: #ef4444;
}

.geo-explain-card__reason--medium .geo-explain-card__reason-dot {
  background: #f59e0b;
}

.geo-explain-card__reason--low .geo-explain-card__reason-dot {
  background: #22c55e;
}

/* ===== Evidence ===== */
.geo-explain-card__evidence-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-explain-card__evidence-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
}

.geo-explain-card__evidence-source {
  font-weight: 600;
  color: #374151;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.geo-explain-card__evidence-detail {
  color: #6b7280;
  line-height: 1.4;
}

/* ===== Recommendations ===== */
.geo-explain-card__rec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-explain-card__rec-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid;
  font-size: 13px;
}

.geo-explain-card__rec--high {
  background: #fef2f2;
  border-color: #ef4444;
}

.geo-explain-card__rec--medium {
  background: #fffbeb;
  border-color: #f59e0b;
}

.geo-explain-card__rec--low {
  background: #f0fdf4;
  border-color: #22c55e;
}

.geo-explain-card__rec-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.geo-explain-card__rec-priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
  background: currentColor;
}

.geo-explain-card__rec-action {
  font-weight: 500;
  color: #374151;
  line-height: 1.4;
}

.geo-explain-card__rec-impact {
  font-size: 12px;
  color: #6b7280;
  margin-left: 18px;
}

/* ===== Suggestions ===== */
.geo-explain-card__suggestions {
  list-style: disc;
  padding: 0 0 0 18px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-explain-card__suggestions li {
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
}

/* ===== Footer ===== */
.geo-explain-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-top: 1px solid #f3f4f6;
  font-size: 11px;
  color: #9ca3af;
  margin-top: auto;
  flex-shrink: 0;
}

/* ===== Loading ===== */
.geo-explain-card__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 20px;
  color: #6b7280;
  font-size: 14px;
}

.geo-explain-card__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: geo-explain-spin 0.6s linear infinite;
}

@keyframes geo-explain-spin {
  to { transform: rotate(360deg); }
}

/* ===== Error ===== */
.geo-explain-card__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 20px;
  color: #ef4444;
  font-size: 14px;
}

.geo-explain-card__error-icon {
  font-size: 18px;
  flex-shrink: 0;
}
</style>
