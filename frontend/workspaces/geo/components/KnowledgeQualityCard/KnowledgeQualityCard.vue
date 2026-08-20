<!--
  KnowledgeQualityCard.vue — 知识内容质量检测卡片

  显示知识条目的内容质量分析：
  - 知识数量 vs 合格数量
  - 内容长度、具体性、去重率、可追溯性
  - 主要问题列表
-->
<template>
  <div class="kq-card">
    <div class="kq-card__header">
      <div class="kq-card__title-group">
        <span class="kq-card__icon">📝</span>
        <h3 class="kq-card__title">知识内容质量</h3>
      </div>
      <span class="kq-card__score" :class="qualityClass">
        {{ report?.overallScore ?? '-' }}/100
      </span>
    </div>

    <!-- 数量概览 -->
    <div class="kq-card__stats">
      <div class="kq-card__stat">
        <span class="kq-card__stat-value">{{ report?.totalKnowledge ?? 0 }}</span>
        <span class="kq-card__stat-label">知识总数</span>
      </div>
      <div class="kq-card__stat">
        <span class="kq-card__stat-value kq-card__stat-value--good">
          {{ report?.qualifiedKnowledge ?? 0 }}
        </span>
        <span class="kq-card__stat-label">合格知识</span>
      </div>
    </div>

    <!-- 问题列表 -->
    <div v-if="report?.topIssues?.length" class="kq-card__issues">
      <p class="kq-card__issues-title">⚠️ 内容问题 ({{ report.topIssues.length }})</p>
      <div
        v-for="(issue, idx) in report.topIssues"
        :key="idx"
        class="kq-card__issue"
        :class="'kq-card__issue--' + issue.type"
      >
        <span class="kq-card__issue-icon">{{ issueIcon(issue.type) }}</span>
        <span class="kq-card__issue-text">{{ issue.message }}</span>
      </div>
    </div>

    <p v-else class="kq-card__no-issues">
      ✅ 暂无内容质量问题
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeQualityResult } from '../../services/missionService'

const props = defineProps<{
  report: KnowledgeQualityResult | null
}>()

const qualityClass = computed(() => {
  const s = props.report?.overallScore ?? 0
  if (s >= 60) return 'kq-card__score--high'
  if (s >= 30) return 'kq-card__score--medium'
  return 'kq-card__score--low'
})

function issueIcon(type: string) {
  switch (type) {
    case 'too_short': return '📏'
    case 'no_specifics': return '🔢'
    case 'duplicate': return '🔁'
    case 'no_source': return '🔗'
    default: return '⚠️'
  }
}
</script>

<style scoped>
.kq-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.kq-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.kq-card__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kq-card__icon { font-size: 20px; }
.kq-card__title { font-size: 16px; font-weight: 700; margin: 0; }

.kq-card__score {
  font-size: 18px;
  font-weight: 800;
}
.kq-card__score--high { color: #16a34a; }
.kq-card__score--medium { color: #d97706; }
.kq-card__score--low { color: #dc2626; }

.kq-card__stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.kq-card__stat {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.kq-card__stat-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  color: #3b82f6;
}

.kq-card__stat-value--good {
  color: #16a34a;
}

.kq-card__stat-label {
  font-size: 12px;
  color: #6b7280;
}

.kq-card__issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kq-card__issues-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.kq-card__issue {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.kq-card__issue--too_short { background: #fef3c7; border-color: #fde68a; }
.kq-card__issue--no_specifics { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
.kq-card__issue--duplicate { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.kq-card__issue--no_source { background: #f5f3ff; border-color: #ddd6fe; color: #5b21b6; }

.kq-card__issue-icon { flex-shrink: 0; }
.kq-card__issue-text { flex: 1; line-height: 1.4; }

.kq-card__no-issues {
  font-size: 13px;
  color: #16a34a;
  text-align: center;
  padding: 12px;
  margin: 0;
  background: #f0fdf4;
  border-radius: 8px;
}
</style>
