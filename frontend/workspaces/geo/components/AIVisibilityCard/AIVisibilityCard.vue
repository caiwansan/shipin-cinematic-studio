<!--
  AIVisibilityCard.vue — AI 实测可见度卡片

  显示真实 AI 引擎对品牌的引用率，而非自说自话的计数评分。
  包含：
  - 总体 AI 可见度评分
  - 各 AI 引擎引用率
  - 内容质量评分
  - 触发 AI 探测按钮
-->
<template>
  <div class="ai-card">
    <div class="ai-card__header">
      <div class="ai-card__title-group">
        <span class="ai-card__icon">🤖</span>
        <h3 class="ai-card__title">AI 实测可见度</h3>
      </div>
      <span class="ai-card__badge" :class="scoreClass">{{ scoreLevel }}</span>
    </div>

    <!-- 主分数 -->
    <div class="ai-card__score-section">
      <div class="ai-card__score-main">
        <span class="ai-card__score-number">{{ result?.overall ?? '-' }}</span>
        <span class="ai-card__score-unit">/ 100</span>
      </div>
      <p class="ai-card__score-desc">
        {{ scoreDescription }}
      </p>
    </div>

    <!-- 各引擎引用率 -->
    <div v-if="result?.engines?.length" class="ai-card__engines">
      <div v-for="engine in result.engines" :key="engine.engine" class="ai-card__engine">
        <span class="ai-card__engine-name">{{ engine.label }}</span>
        <div class="ai-card__engine-bar-wrap">
          <div
            class="ai-card__engine-bar"
            :style="{ width: (engine.mentionRate * 100) + '%' }"
            :class="barClass(engine.mentionRate)"
          />
        </div>
        <span class="ai-card__engine-pct">{{ Math.round(engine.mentionRate * 100) }}%</span>
      </div>
    </div>

    <!-- 内容质量 -->
    <div v-if="result?.contentQuality != null" class="ai-card__quality">
      <span class="ai-card__quality-label">内容质量</span>
      <span class="ai-card__quality-score" :class="qualityClass(result.contentQuality)">
        {{ result.contentQuality }}/100
      </span>
    </div>

    <!-- 探测时间 -->
    <p v-if="result?.probedAt" class="ai-card__probed-at">
      探测于 {{ formatTime(result.probedAt) }}
    </p>

    <!-- 操作按钮 -->
    <div class="ai-card__actions">
      <button
        class="ai-card__btn ai-card__btn--primary"
        :disabled="loading"
        @click="$emit('probe')"
      >
        <span v-if="loading" class="ai-card__btn-spin" />
        <span v-else>🔍</span>
        {{ loading ? '探测中...' : '实测 AI 可见度' }}
      </button>
      <button
        class="ai-card__btn ai-card__btn--secondary"
        :disabled="loading"
        @click="$emit('closedLoop')"
      >
        ⚡ 一键优化闭环
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AIVisibilityResult } from '../../services/missionService'

const props = defineProps<{
  result: AIVisibilityResult | null
  loading?: boolean
}>()

defineEmits<{
  probe: []
  closedLoop: []
}>()

const scoreLevel = computed(() => {
  const s = props.result?.overall ?? 0
  if (s >= 70) return '高'
  if (s >= 40) return '中'
  return '低'
})

const scoreClass = computed(() => {
  const s = props.result?.overall ?? 0
  if (s >= 70) return 'ai-card__badge--high'
  if (s >= 40) return 'ai-card__badge--medium'
  return 'ai-card__badge--low'
})

const scoreDescription = computed(() => {
  const s = props.result?.overall ?? 0
  if (s >= 70) return 'AI 引擎经常引用您的品牌，可见度优秀'
  if (s >= 40) return 'AI 引擎偶尔引用您的品牌，仍有提升空间'
  if (s > 0) return 'AI 引擎很少引用您的品牌，建议优化知识库'
  return '尚未执行 AI 探测，点击按钮实测品牌可见度'
})

function barClass(rate: number) {
  if (rate >= 0.6) return 'ai-card__engine-bar--high'
  if (rate >= 0.3) return 'ai-card__engine-bar--medium'
  return 'ai-card__engine-bar--low'
}

function qualityClass(score: number) {
  if (score >= 60) return 'ai-card__quality-score--high'
  if (score >= 30) return 'ai-card__quality-score--medium'
  return 'ai-card__quality-score--low'
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
</script>

<style scoped>
.ai-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.ai-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.ai-card__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-card__icon { font-size: 20px; }
.ai-card__title { font-size: 16px; font-weight: 700; margin: 0; }

.ai-card__badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 100px;
}
.ai-card__badge--high { background: #dcfce7; color: #16a34a; }
.ai-card__badge--medium { background: #fef3c7; color: #d97706; }
.ai-card__badge--low { background: #fee2e2; color: #dc2626; }

.ai-card__score-section {
  text-align: center;
  margin-bottom: 16px;
}

.ai-card__score-main {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
}

.ai-card__score-number {
  font-size: 48px;
  font-weight: 800;
  color: #3b82f6;
  line-height: 1;
}

.ai-card__score-unit {
  font-size: 16px;
  color: #9ca3af;
}

.ai-card__score-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 8px 0 0;
}

.ai-card__engines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.ai-card__engine {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-card__engine-name {
  font-size: 13px;
  color: #374151;
  width: 70px;
  flex-shrink: 0;
}

.ai-card__engine-bar-wrap {
  flex: 1;
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.ai-card__engine-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.ai-card__engine-bar--high { background: #22c55e; }
.ai-card__engine-bar--medium { background: #f59e0b; }
.ai-card__engine-bar--low { background: #ef4444; }

.ai-card__engine-pct {
  font-size: 12px;
  color: #6b7280;
  width: 40px;
  text-align: right;
}

.ai-card__quality {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 8px;
}

.ai-card__quality-label { font-size: 13px; color: #6b7280; }
.ai-card__quality-score { font-size: 14px; font-weight: 700; }
.ai-card__quality-score--high { color: #16a34a; }
.ai-card__quality-score--medium { color: #d97706; }
.ai-card__quality-score--low { color: #dc2626; }

.ai-card__probed-at {
  font-size: 12px;
  color: #9ca3af;
  margin: 0 0 12px;
}

.ai-card__actions {
  display: flex;
  gap: 8px;
}

.ai-card__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.ai-card__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-card__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.ai-card__btn--primary:hover:not(:disabled) {
  background: #2563eb;
}

.ai-card__btn--secondary {
  background: #fff;
  color: #374151;
}

.ai-card__btn--secondary:hover:not(:disabled) {
  background: #f9fafb;
}

.ai-card__btn-spin {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
