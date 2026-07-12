<template>
  <div
    class="opt-card"
    :class="[`opt-card--status-${task.status}`, `opt-card--selected`]"
  >
    <!-- Selection checkbox -->
    <div class="opt-card__select" @click.stop="$emit('toggleSelect', task.id)">
      <div class="opt-card__checkbox" :class="{ 'opt-card__checkbox--checked': selected }">
        <span v-if="selected">✓</span>
      </div>
    </div>

    <div class="opt-card__main">
      <!-- Header row: title + status + Business Impact badge -->
      <div class="opt-card__header">
        <div class="opt-card__title-row">
          <h3 class="opt-card__title">{{ task.title }}</h3>
          <span class="opt-card__status-badge" :class="`opt-card__status-badge--${task.status}`">
            {{ statusLabel }}
          </span>
          <!-- Business Impact Badge -->
          <BusinessImpactBadge :impact="businessImpactLevel" />
        </div>
        <p class="opt-card__description">{{ task.description }}</p>
      </div>

      <!-- Business Value Summary (Sprint B-1) -->
      <div class="opt-card__biz-summary">
        <div class="opt-card__biz-summary-item">
          <span class="opt-card__biz-summary-label">证据值</span>
          <span class="opt-card__biz-summary-value" :class="`opt-card__biz-confidence--${task.confidence}`">{{ businessScore }}</span>
        </div>
        <div class="opt-card__biz-summary-item">
          <span class="opt-card__biz-summary-label">AI 可见度</span>
          <span class="opt-card__biz-summary-value opt-card__biz-summary-value--pos">+{{ aiVisibilityGain }}</span>
        </div>
        <div class="opt-card__biz-summary-item">
          <span class="opt-card__biz-summary-label">AI 引用</span>
          <span class="opt-card__biz-summary-value opt-card__biz-summary-value--pos">+{{ aiCitationGain }}%</span>
        </div>
        <div class="opt-card__biz-summary-item">
          <span class="opt-card__biz-summary-label">实施时间</span>
          <span class="opt-card__biz-summary-value">{{ implementationTimeLabel }}</span>
        </div>
        <div class="opt-card__biz-summary-item">
          <span class="opt-card__biz-summary-label">难度</span>
          <span class="opt-card__biz-summary-value" :class="`opt-card__biz-difficulty--${task.difficulty}`">{{ difficultyLabel }}</span>
        </div>
      </div>

      <!-- Root Cause -->
      <div class="opt-card__root-cause">
        <span class="opt-card__root-cause-label">🔍 根因：</span>
        <span class="opt-card__root-cause-text">{{ task.rootCause }}</span>
      </div>

      <!-- Technical Expected Impact (二级) -->
      <div class="opt-card__impact">
        <span class="opt-card__section-label">技术预期影响</span>
        <div class="opt-card__impact-list">
          <div class="opt-card__impact-item">
            <span class="opt-card__impact-dim">可发现性</span>
            <span class="opt-card__impact-val">+{{ task.expectedImpact.discoverability }}</span>
          </div>
          <div class="opt-card__impact-item">
            <span class="opt-card__impact-dim">引用</span>
            <span class="opt-card__impact-val">+{{ task.expectedImpact.citation }}</span>
          </div>
          <div class="opt-card__impact-item">
            <span class="opt-card__impact-dim">覆盖度</span>
            <span class="opt-card__impact-val">+{{ task.expectedImpact.coverage }}</span>
          </div>
          <div class="opt-card__impact-item">
            <span class="opt-card__impact-dim">可见度</span>
            <span class="opt-card__impact-val">+{{ task.expectedImpact.visibility }}</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="task.tags && task.tags.length" class="opt-card__tags">
        <span
          v-for="tag in task.tags"
          :key="tag"
          class="opt-card__tag"
          @click.stop="$emit('filterTag', tag)"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Evidence (collapsible) -->
      <div class="opt-card__evidence">
        <button class="opt-card__evidence-toggle" @click.stop="showEvidence = !showEvidence">
          <span>📊</span>
          <span>{{ showEvidence ? '收起证据' : '查看证据 (' + task.evidence.length + ')' }}</span>
          <span class="opt-card__evidence-arrow" :class="{ 'opt-card__evidence-arrow--open': showEvidence }">▼</span>
        </button>
        <div v-if="showEvidence" class="opt-card__evidence-list">
          <div v-for="(ev, index) in task.evidence" :key="index" class="opt-card__evidence-item">
            <div class="opt-card__evidence-source">
              <span class="opt-card__evidence-source-badge" :class="`opt-card__evidence-source--${ev.source}`">
                {{ sourceLabel(ev.source) }}
              </span>
              {{ ev.summary }}
            </div>
            <p v-if="ev.detail" class="opt-card__evidence-detail">{{ ev.detail }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Single-action buttons -->
    <div class="opt-card__actions">
      <button
        v-if="task.status === 'todo'"
        class="opt-card__action-btn opt-card__action-btn--start"
        @click.stop="$emit('startTask', task.id)"
      >
        ▶ 开始
      </button>
      <button
        v-if="task.status === 'in_progress'"
        class="opt-card__action-btn opt-card__action-btn--publish"
        @click.stop="$emit('publishTask', task.id)"
      >
        📤 发布
      </button>
      <button
        v-if="task.status === 'done'"
        class="opt-card__action-btn opt-card__action-btn--verify"
        @click.stop="$emit('verifyTask', task.id)"
      >
        ✅ 验证
      </button>
      <button
        class="opt-card__action-btn opt-card__action-btn--ignore"
        @click.stop="$emit('ignoreTask', task.id)"
      >
        ⏭ 忽略
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { OptimizationTask } from '../services/optimizationService'
import BusinessImpactBadge from './business/BusinessImpactBadge.vue'

const props = defineProps<{
  task: OptimizationTask
  selected: boolean
}>()

defineEmits<{
  toggleSelect: [taskId: string]
  startTask: [taskId: string]
  publishTask: [taskId: string]
  verifyTask: [taskId: string]
  ignoreTask: [taskId: string]
  filterTag: [tag: string]
}>()

const showEvidence = ref(false)

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    todo: '待处理',
    in_progress: '进行中',
    done: '已完成',
  }
  return labels[props.task.status] || props.task.status
})

const difficultyLabel = computed(() => {
  const labels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }
  return labels[props.task.difficulty] || props.task.difficulty
})

const estimatedTimeLabel = computed(() => {
  const labels: Record<string, string> = {
    today: '今天',
    '3_days': '3 天',
    '7_days': '7 天',
    '14_days': '14 天',
  }
  return labels[props.task.estimatedTime] || props.task.estimatedTime
})

// ── Business Value Computed (Sprint B-1) ──

const businessImpactLevel = computed(() => {
  const score = props.task.businessValue.score
  if (score >= 80) return 'very-high'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
})

const businessScore = computed(() => {
  // Product Truth Principle: no fake default — null means empty
  return props.task.businessValue?.score != null ? props.task.businessValue.score + '%' : '—'
})

const aiVisibilityGain = computed(() => {
  return (props.task.expectedImpact.visibility || 0) + (props.task.expectedImpact.discoverability || 0)
})

const aiCitationGain = computed(() => {
  return (props.task.expectedImpact.citation || 0) + Math.round((props.task.expectedImpact.coverage || 0) * 0.3)
})

const implementationTimeLabel = computed(() => {
  const labels: Record<string, string> = {
    today: '1 天',
    '3_days': '3 天',
    '7_days': '7 天',
    '14_days': '14 天',
  }
  return labels[props.task.estimatedTime] || props.task.estimatedTime
})

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    scan: '🔎 扫描',
    knowledge: '📚 知识库',
    timeline: '📈 趋势',
    verification: '✅ 验证',
  }
  return labels[source] || source
}
</script>

<style scoped>
.opt-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  gap: 0;
  overflow: hidden;
  transition: all 0.2s ease;
  font-family: Inter, -apple-system, sans-serif;
}

.opt-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  border-color: #d1d5db;
}

.opt-card--status-done {
  opacity: 0.75;
}

.opt-card--selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

/* Selection column */
.opt-card__select {
  width: 40px;
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.opt-card__checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  transition: all 0.15s;
}

.opt-card__checkbox--checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

/* Main content */
.opt-card__main {
  flex: 1;
  padding: 16px 16px 16px 0;
  min-width: 0;
}

.opt-card__header {
  margin-bottom: 10px;
}

.opt-card__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.opt-card__title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: #111827;
}

.opt-card__status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.opt-card__status-badge--todo {
  background: #f3f4f6;
  color: #6b7280;
}

.opt-card__status-badge--in_progress {
  background: #dbeafe;
  color: #2563eb;
}

.opt-card__status-badge--done {
  background: #d1fae5;
  color: #059669;
}

.opt-card__description {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

/* Business Value Summary (Sprint B-1) */
.opt-card__biz-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #eff6ff 100%);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
}

.opt-card__biz-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 80px;
}

.opt-card__biz-summary-label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.opt-card__biz-summary-value {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.opt-card__biz-summary-value--pos {
  color: #059669;
}

.opt-card__biz-confidence--high { color: #16a34a; }
.opt-card__biz-confidence--medium { color: #d97706; }
.opt-card__biz-confidence--low { color: #dc2626; }

.opt-card__biz-difficulty--easy { color: #16a34a; }
.opt-card__biz-difficulty--medium { color: #d97706; }
.opt-card__biz-difficulty--hard { color: #dc2626; }

/* Root Cause */
.opt-card__root-cause {
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.opt-card__root-cause-label {
  font-weight: 600;
  color: #92400e;
  margin-right: 4px;
}

.opt-card__root-cause-text {
  color: #78350f;
}

/* Impact */
.opt-card__impact {
  margin-bottom: 10px;
}

.opt-card__section-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.opt-card__impact-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.opt-card__impact-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  font-size: 12px;
}

.opt-card__impact-dim {
  color: #374151;
  font-weight: 500;
}

.opt-card__impact-val {
  font-weight: 700;
  color: #16a34a;
}

/* Meta row */
.opt-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 10px;
}

.opt-card__meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.opt-card__meta-label {
  color: #9ca3af;
}

.opt-card__meta-value {
  font-weight: 600;
  color: #374151;
}

.opt-card__difficulty--easy { color: #16a34a; }
.opt-card__difficulty--medium { color: #d97706; }
.opt-card__difficulty--hard { color: #dc2626; }

.opt-card__confidence--high .opt-card__meta-value { color: #16a34a; }
.opt-card__confidence--medium .opt-card__meta-value { color: #d97706; }
.opt-card__confidence--low .opt-card__meta-value { color: #dc2626; }

/* Tags */
.opt-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.opt-card__tag {
  display: inline-block;
  padding: 2px 8px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.opt-card__tag:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
  color: #374151;
}

/* Evidence */
.opt-card__evidence {
  margin-bottom: 0;
}

.opt-card__evidence-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.opt-card__evidence-toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.opt-card__evidence-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.opt-card__evidence-arrow--open {
  transform: rotate(180deg);
}

.opt-card__evidence-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.opt-card__evidence-item {
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.opt-card__evidence-source {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #475569;
}

.opt-card__evidence-source-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  background: #e2e8f0;
  color: #475569;
}

.opt-card__evidence-detail {
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 11px;
}

/* Actions */
.opt-card__actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
  padding: 16px 16px 16px 0;
  flex-shrink: 0;
}

.opt-card__action-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid;
  font-family: inherit;
  text-align: center;
}

.opt-card__action-btn--start {
  background: #dbeafe;
  color: #2563eb;
  border-color: #93c5fd;
}

.opt-card__action-btn--start:hover {
  background: #bfdbfe;
}

.opt-card__action-btn--publish {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}

.opt-card__action-btn--publish:hover {
  background: #fde68a;
}

.opt-card__action-btn--verify {
  background: #d1fae5;
  color: #059669;
  border-color: #6ee7b7;
}

.opt-card__action-btn--verify:hover {
  background: #a7f3d0;
}

.opt-card__action-btn--ignore {
  background: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}

.opt-card__action-btn--ignore:hover {
  background: #e5e7eb;
}
</style>
