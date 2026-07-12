<template>
  <div class="geo-explain-section" :class="`geo-explain-section--${section.type}`">
    <h4 class="geo-explain-section__title">{{ section.title }}</h4>

    <!-- evidence: 证据列表 -->
    <template v-if="section.type === 'evidence'">
      <div class="geo-explain-section__items geo-explain-section__items--evidence">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__evidence-item"
        >
          <div class="geo-explain-section__evidence-header">
            <span class="geo-explain-section__evidence-label">{{ item.label }}</span>
            <span
              v-if="item.status"
              class="geo-explain-section__status-dot"
              :class="`geo-explain-section__status-dot--${item.status}`"
            />
          </div>
          <span class="geo-explain-section__evidence-value">{{ formatValue(item.value) }}</span>
          <span v-if="item.source" class="geo-explain-section__evidence-source">{{ item.source }}</span>
          <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
        </div>
      </div>
    </template>

    <!-- threshold: 阈值详情 -->
    <template v-else-if="section.type === 'threshold'">
      <div class="geo-explain-section__items">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__threshold-item"
        >
          <div class="geo-explain-section__threshold-header">
            <span class="geo-explain-section__threshold-label">{{ item.label }}</span>
            <span
              v-if="item.status"
              class="geo-explain-section__threshold-badge"
              :class="`geo-explain-section__threshold-badge--${item.status}`"
            >{{ statusLabel(item.status) }}</span>
          </div>
          <span class="geo-explain-section__threshold-value">{{ formatValue(item.value) }}</span>
          <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
        </div>
      </div>
    </template>

    <!-- impact: 影响预测 -->
    <template v-else-if="section.type === 'impact'">
      <div class="geo-explain-section__impact-list">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__impact-item"
        >
          <div class="geo-explain-section__impact-header">
            <span class="geo-explain-section__impact-label">{{ item.label }}</span>
            <span class="geo-explain-section__impact-gain">{{ formatValue(item.value) }}</span>
          </div>
          <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
        </div>
      </div>
    </template>

    <!-- rule: 规则匹配 -->
    <template v-else-if="section.type === 'rule'">
      <div class="geo-explain-section__rule-list">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__rule-item"
          :class="item.status ? `geo-explain-section__rule-item--${item.status}` : ''"
        >
          <span class="geo-explain-section__rule-label">{{ item.label }}</span>
          <span class="geo-explain-section__rule-value">{{ formatValue(item.value) }}</span>
          <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
        </div>
      </div>
    </template>

    <!-- reasoning: 推理链 -->
    <template v-else-if="section.type === 'reasoning'">
      <ul class="geo-explain-section__reasoning-list">
        <li
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__reasoning-item"
          :class="item.status ? `geo-explain-section__reasoning-item--${item.status}` : ''"
        >
          <span class="geo-explain-section__reasoning-dot" />
          <div class="geo-explain-section__reasoning-content">
            <span class="geo-explain-section__reasoning-label">{{ item.label }}</span>
            <span class="geo-explain-section__reasoning-value">{{ formatValue(item.value) }}</span>
            <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
          </div>
        </li>
      </ul>
    </template>

    <!-- recommendation: 行动项 -->
    <template v-else-if="section.type === 'recommendation'">
      <div class="geo-explain-section__rec-list">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__rec-item"
          :class="item.status ? `geo-explain-section__rec-item--${item.status}` : ''"
        >
          <div class="geo-explain-section__rec-header">
            <span class="geo-explain-section__rec-dot" />
            <span class="geo-explain-section__rec-label">{{ item.label }}</span>
            <span v-if="item.value" class="geo-explain-section__rec-priority">{{ formatValue(item.value) }}</span>
          </div>
          <span v-if="item.detail" class="geo-explain-section__rec-detail">{{ item.detail }}</span>
        </div>
      </div>
    </template>

    <!-- metric: 指标展示 -->
    <template v-else-if="section.type === 'metric'">
      <div class="geo-explain-section__metric-list">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__metric-item"
        >
          <span class="geo-explain-section__metric-label">{{ item.label }}</span>
          <span
            class="geo-explain-section__metric-value"
            :class="item.status ? `geo-explain-section__metric-value--${item.status}` : ''"
          >{{ formatValue(item.value) }}</span>
          <span v-if="item.source" class="geo-explain-section__metric-source">{{ item.source }}</span>
          <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
        </div>
      </div>
    </template>

    <!-- timeline: 时间线 -->
    <template v-else-if="section.type === 'timeline'">
      <div class="geo-explain-section__timeline">
        <div
          v-for="item in section.items"
          :key="item.id"
          class="geo-explain-section__timeline-item"
        >
          <div class="geo-explain-section__timeline-marker" />
          <div class="geo-explain-section__timeline-content">
            <span class="geo-explain-section__timeline-label">{{ item.label }}</span>
            <span class="geo-explain-section__timeline-value">{{ formatValue(item.value) }}</span>
            <p v-if="item.detail" class="geo-explain-section__detail">{{ item.detail }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ExplainSection } from '../../types/explain-document'

const props = defineProps<{
  section: ExplainSection
}>()

function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    positive: '正常',
    negative: '异常',
    neutral: '中性',
    action_required: '需处理',
  }
  return labels[status] || status
}
</script>

<style scoped>
.geo-explain-section {
  padding: 12px 20px;
  border-bottom: 1px solid #f3f4f6;
}

.geo-explain-section:last-child {
  border-bottom: none;
}

.geo-explain-section__title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
}

.geo-explain-section__detail {
  font-size: 12px;
  color: #9ca3af;
  margin: 4px 0 0;
  line-height: 1.5;
}

/* Status dot */
.geo-explain-section__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.geo-explain-section__status-dot--positive { background: #22c55e; }
.geo-explain-section__status-dot--negative { background: #ef4444; }
.geo-explain-section__status-dot--neutral { background: #9ca3af; }
.geo-explain-section__status-dot--action_required { background: #f59e0b; }

/* ===== Evidence ===== */
.geo-explain-section__evidence-item {
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 6px;
}

.geo-explain-section__evidence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.geo-explain-section__evidence-label {
  font-weight: 600;
  color: #374151;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.geo-explain-section__evidence-value {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
  display: block;
}

.geo-explain-section__evidence-source {
  font-size: 11px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 3px;
  margin-top: 2px;
  display: inline-block;
}

/* ===== Reasoning ===== */
.geo-explain-section__reasoning-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-explain-section__reasoning-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
}

.geo-explain-section__reasoning-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
  background: #9ca3af;
}

.geo-explain-section__reasoning-item--positive .geo-explain-section__reasoning-dot { background: #22c55e; }
.geo-explain-section__reasoning-item--negative .geo-explain-section__reasoning-dot { background: #ef4444; }
.geo-explain-section__reasoning-item--action_required .geo-explain-section__reasoning-dot { background: #f59e0b; }

.geo-explain-section__reasoning-content {
  display: flex;
  flex-direction: column;
}

.geo-explain-section__reasoning-label {
  font-weight: 500;
}

.geo-explain-section__reasoning-value {
  color: #6b7280;
  font-size: 12px;
}

/* ===== Recommendation ===== */
.geo-explain-section__rec-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-explain-section__rec-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 6px;
  border-left: 3px solid #e5e7eb;
  font-size: 13px;
}

.geo-explain-section__rec-item--action_required {
  background: #fffbeb;
  border-color: #f59e0b;
}

.geo-explain-section__rec-item--positive {
  background: #f0fdf4;
  border-color: #22c55e;
}

.geo-explain-section__rec-item--negative {
  background: #fef2f2;
  border-color: #ef4444;
}

.geo-explain-section__rec-item--neutral {
  background: #f9fafb;
  border-color: #d1d5db;
}

.geo-explain-section__rec-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.geo-explain-section__rec-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: currentColor;
}

.geo-explain-section__rec-label {
  font-weight: 500;
  color: #374151;
  flex: 1;
}

.geo-explain-section__rec-priority {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  padding: 1px 6px;
  background: #f3f4f6;
  border-radius: 4px;
}

.geo-explain-section__rec-detail {
  font-size: 12px;
  color: #6b7280;
  margin-left: 18px;
}

/* ===== Impact ===== */
.geo-explain-section__impact-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.geo-explain-section__impact-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  flex: 1;
  min-width: 120px;
}

.geo-explain-section__impact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.geo-explain-section__impact-label {
  font-size: 12px;
  color: #374151;
}

.geo-explain-section__impact-gain {
  font-size: 14px;
  font-weight: 700;
  color: #16a34a;
}

/* ===== Metric ===== */
.geo-explain-section__metric-list {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.geo-explain-section__metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 100px;
}

.geo-explain-section__metric-label {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.geo-explain-section__metric-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: #111827;
}

.geo-explain-section__metric-value--positive { color: #16a34a; }
.geo-explain-section__metric-value--negative { color: #ef4444; }
.geo-explain-section__metric-value--action_required { color: #f59e0b; }

.geo-explain-section__metric-source {
  font-size: 10px;
  color: #9ca3af;
}

/* ===== Threshold ===== */
.geo-explain-section__threshold-item {
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 6px;
}

.geo-explain-section__threshold-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.geo-explain-section__threshold-label {
  font-weight: 600;
  font-size: 12px;
  color: #374151;
}

.geo-explain-section__threshold-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.geo-explain-section__threshold-badge--positive {
  background: #f0fdf4;
  color: #16a34a;
}

.geo-explain-section__threshold-badge--negative {
  background: #fef2f2;
  color: #ef4444;
}

.geo-explain-section__threshold-badge--action_required {
  background: #fffbeb;
  color: #d97706;
}

.geo-explain-section__threshold-value {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

/* ===== Rule ===== */
.geo-explain-section__rule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-explain-section__rule-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 3px solid #e5e7eb;
}

.geo-explain-section__rule-item--positive { border-color: #22c55e; }
.geo-explain-section__rule-item--negative { border-color: #ef4444; }
.geo-explain-section__rule-item--action_required { border-color: #f59e0b; }

.geo-explain-section__rule-label {
  font-weight: 500;
  font-size: 13px;
  color: #374151;
}

.geo-explain-section__rule-value {
  font-size: 12px;
  color: #6b7280;
}

/* ===== Timeline ===== */
.geo-explain-section__timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

.geo-explain-section__timeline-item {
  display: flex;
  gap: 12px;
  padding-bottom: 12px;
  position: relative;
}

.geo-explain-section__timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 10px;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.geo-explain-section__timeline-marker {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3b82f6;
  flex-shrink: 0;
  margin-top: 3px;
  z-index: 1;
}

.geo-explain-section__timeline-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-explain-section__timeline-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.geo-explain-section__timeline-value {
  font-size: 12px;
  color: #6b7280;
}
</style>
