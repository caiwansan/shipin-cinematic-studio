<!-- Sprint 08: 招聘决策卡片组件 -->
<!-- 位置：/components/enterprise/recruitment/HiringDecisionCard.vue -->
<!-- 职责：展示候选人决策摘要 — 匹配度、优势、风险、AI 建议 + 快速操作 -->
<template>
  <div class="hiring-decision-card" :class="cardClass">
    <!-- Header -->
    <div class="hdc-header">
      <div class="hdc-candidate-info">
        <span class="hdc-avatar">{{ initial }}</span>
        <div>
          <h3 class="hdc-name">{{ candidate.candidateName || '候选人' }}</h3>
          <span class="hdc-job">{{ candidate.jobTitle || '' }}</span>
        </div>
      </div>
      <div class="hdc-score">
        <span class="hdc-score-num" :style="{ color: scoreColor }">{{ matchScore }}</span>
        <span class="hdc-score-label">匹配度</span>
      </div>
    </div>

    <!-- Match Breakdown (mini) -->
    <div v-if="hasBreakdown" class="hdc-bars">
      <div class="hdc-bar-row">
        <span class="hdc-bar-label">技能</span>
        <div class="hdc-bar-track">
          <div class="hdc-bar-fill" :style="{ width: breakdown.skills + '%', background: '#60a5fa' }"></div>
        </div>
      </div>
      <div class="hdc-bar-row">
        <span class="hdc-bar-label">经验</span>
        <div class="hdc-bar-track">
          <div class="hdc-bar-fill" :style="{ width: breakdown.experience + '%', background: '#a78bfa' }"></div>
        </div>
      </div>
      <div class="hdc-bar-row">
        <span class="hdc-bar-label">教育</span>
        <div class="hdc-bar-track">
          <div class="hdc-bar-fill" :style="{ width: breakdown.education + '%', background: '#34d399' }"></div>
        </div>
      </div>
    </div>

    <!-- Strengths -->
    <div v-if="strengths.length > 0" class="hdc-section">
      <span class="hdc-section-label">✅ 核心优势</span>
      <div class="hdc-tag-list">
        <span v-for="s in strengths.slice(0, 3)" :key="s" class="hdc-tag hdc-tag--success">{{ s }}</span>
      </div>
    </div>

    <!-- Risks -->
    <div v-if="risks.length > 0" class="hdc-section">
      <span class="hdc-section-label">⚠️ 风险点</span>
      <div class="hdc-tag-list">
        <span v-for="r in risks.slice(0, 3)" :key="r" class="hdc-tag hdc-tag--warning">{{ r }}</span>
      </div>
    </div>

    <!-- AI Recommendation -->
    <div v-if="recommendation" class="hdc-recommendation">
      <span class="hdc-rec-icon">🤖</span>
      <span class="hdc-rec-text">{{ recommendation }}</span>
    </div>

    <!-- Actions -->
    <div class="hdc-actions">
      <button class="hdc-action hdc-action--offer" @click="$emit('advance-to-offer', candidate)">
        📨 推荐 Offer
      </button>
      <button class="hdc-action hdc-action--interview" @click="$emit('schedule-interview', candidate)">
        🎤 安排面试
      </button>
      <button class="hdc-action hdc-action--reject" @click="$emit('reject', candidate)">
        ❌ 建议拒绝
      </button>
    </div>

    <!-- Detail Link -->
    <div class="hdc-footer">
      <button class="hdc-detail-link" @click="$emit('view-detail', candidate)">
        查看详情 →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// ─── Props ───
const props = defineProps<{
  candidate: any
  matchData?: any
  strengths?: string[]
  risks?: string[]
  recommendation?: string
}>()

// ─── Emits ───
defineEmits<{
  'advance-to-offer': [candidate: any]
  'schedule-interview': [candidate: any]
  'reject': [candidate: any]
  'view-detail': [candidate: any]
}>()

// ─── Computed ───
const initial = computed(() => {
  const name = props.candidate?.candidateName || ''
  return name.charAt(0) || '?'
})

const matchScore = computed(() => {
  if (props.matchData?.matchScore) return props.matchData.matchScore
  if (props.candidate?.screeningScore) return props.candidate.screeningScore
  return null
})

const scoreColor = computed(() => {
  const score = matchScore.value || 0
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#fbbf24'
  return '#f87171'
})

const breakdown = computed(() => {
  const mb = props.matchData?.matchBreakdown
  if (!mb) return null
  return {
    skills: mb.skills ?? 0,
    experience: mb.experience ?? 0,
    education: mb.education ?? 0,
  }
})

const hasBreakdown = computed(() => !!breakdown.value)

const strengths = computed(() => {
  if (props.strengths?.length) return props.strengths
  if (props.matchData?.strengthMatch) return props.matchData.strengthMatch
  if (props.matchData?.reasons) return props.matchData.reasons
  return []
})

const risks = computed(() => {
  if (props.risks?.length) return props.risks
  if (props.matchData?.risks) return props.matchData.risks
  if (props.matchData?.riskFlags) return props.matchData.riskFlags
  return []
})

const recommendation = computed(() => {
  if (props.recommendation) return props.recommendation
  if (props.matchData?.recommendation) return props.matchData.recommendation
  if (props.matchData?.recommendReason) return props.matchData.recommendReason
  return ''
})

const cardClass = computed(() => {
  const score = matchScore.value || 0
  if (score >= 80) return 'hdc-card--strong'
  if (score >= 60) return 'hdc-card--medium'
  return 'hdc-card--weak'
})
</script>

<style scoped>
.hiring-decision-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.15s;
}

.hiring-decision-card:hover {
  border-color: rgba(96, 165, 250, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.hdc-card--strong {
  border-left: 3px solid #4ade80;
}

.hdc-card--medium {
  border-left: 3px solid #fbbf24;
}

.hdc-card--weak {
  border-left: 3px solid #f87171;
}

/* Header */
.hdc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.hdc-candidate-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hdc-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  flex-shrink: 0;
}

.hdc-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.hdc-job {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}

.hdc-score {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hdc-score-num {
  font-size: 1.2rem;
  font-weight: 700;
}

.hdc-score-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.35);
}

/* Mini Bars */
.hdc-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.hdc-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hdc-bar-label {
  width: 32px;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: right;
}

.hdc-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 2px;
  overflow: hidden;
}

.hdc-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Sections */
.hdc-section {
  margin-bottom: 8px;
}

.hdc-section-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 4px;
}

.hdc-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.hdc-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 500;
}

.hdc-tag--success {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
}

.hdc-tag--warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

/* Recommendation */
.hdc-recommendation {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px;
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.1);
  border-radius: 6px;
  margin-bottom: 12px;
}

.hdc-rec-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.hdc-rec-text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

/* Actions */
.hdc-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.hdc-action {
  flex: 1;
  padding: 6px 8px;
  font-size: 0.72rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  text-align: center;
}

.hdc-action--offer {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.25);
}

.hdc-action--offer:hover {
  background: rgba(74, 222, 128, 0.2);
}

.hdc-action--interview {
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.25);
}

.hdc-action--interview:hover {
  background: rgba(96, 165, 250, 0.2);
}

.hdc-action--reject {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.25);
}

.hdc-action--reject:hover {
  background: rgba(248, 113, 113, 0.2);
}

/* Footer */
.hdc-footer {
  text-align: center;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.hdc-detail-link {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}

.hdc-detail-link:hover {
  color: #60a5fa;
}
</style>
