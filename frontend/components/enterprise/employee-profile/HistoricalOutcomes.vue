<!-- HistoricalOutcomes.vue — 历史成果列表 -->
<template>
  <section class="historical-outcomes">
    <h2 class="section-title">
      <span class="section-icon">🏆</span>
      历史成果
      <span class="section-period">近90天 · 共 {{ total }} 项</span>
    </h2>

    <div v-if="outcomes.length > 0" class="outcomes-list">
      <div v-for="item in displayedOutcomes" :key="item.id" class="outcome-item">
        <div class="outcome-icon">{{ outcomeEmoji(item.type) }}</div>
        <div class="outcome-content">
          <div class="outcome-type">{{ outcomeTypeText(item.type) }}</div>
          <div v-if="item.description" class="outcome-desc">{{ item.description }}</div>
          <div class="outcome-meta">
            <span class="outcome-date">{{ formatDate(item.createdAt) }}</span>
            <span v-if="item.impactValue" class="outcome-impact">{{ item.impactValue }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Show more -->
    <button
      v-if="outcomes.length > 5 && !showAll"
      @click="showAll = true"
      class="outcomes-more-btn"
    >
      展开全部 ({{ outcomes.length }})
    </button>

    <div v-if="outcomes.length === 0" class="outcomes-empty">
      <span class="empty-icon">🏆</span>
      <span class="empty-text">近90天暂无成果记录</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface HistoricalOutcome {
  id: string
  type: string
  description: string
  createdAt: string
  impactValue: string | null
  impactType: string | null
}

const props = defineProps<{
  total: number
  outcomes: HistoricalOutcome[]
}>()

const showAll = ref(false)

const displayedOutcomes = computed(() => {
  return showAll.value ? props.outcomes : props.outcomes.slice(0, 5)
})

function outcomeEmoji(type: string): string {
  const map: Record<string, string> = {
    REVENUE: '💰',
    COST_SAVED: '✂️',
    LEAD_GENERATED: '👥',
    CONTENT_CREATED: '✍️',
    CUSTOMER_RETENTION: '❤️',
    PROCESS_IMPROVEMENT: '⚡',
    INSIGHT_DISCOVERED: '💡',
  }
  return map[type] || '✅'
}

function outcomeTypeText(type: string): string {
  const map: Record<string, string> = {
    REVENUE: '收入增长',
    COST_SAVED: '成本节约',
    LEAD_GENERATED: '线索获取',
    CONTENT_CREATED: '内容创作',
    CUSTOMER_RETENTION: '客户留存',
    PROCESS_IMPROVEMENT: '流程优化',
    INSIGHT_DISCOVERED: '洞察发现',
  }
  return map[type] || type
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<style scoped>
.historical-outcomes {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #e8e8e8;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon { font-size: 16px; }

.section-period {
  margin-left: auto;
  font-size: 10px;
  color: #5A6A8A;
  font-weight: 400;
}

/* Outcomes List */
.outcomes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.outcome-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(59, 130, 246, 0.03);
  border: 1px solid rgba(59, 130, 246, 0.08);
  border-radius: 10px;
  transition: background 0.15s;
}

.outcome-item:hover {
  background: rgba(59, 130, 246, 0.06);
}

.outcome-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0A1020;
  border-radius: 8px;
}

.outcome-content {
  flex: 1;
  min-width: 0;
}

.outcome-type {
  font-size: 13px;
  font-weight: 600;
  color: #D1D5DB;
  margin-bottom: 2px;
}

.outcome-desc {
  font-size: 11px;
  color: #9CA3AF;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outcome-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.outcome-date {
  font-size: 10px;
  color: #3A4A6A;
}

.outcome-impact {
  font-size: 11px;
  color: #22C55E;
  font-weight: 600;
}

/* More button */
.outcomes-more-btn {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  background: transparent;
  border: 1px dashed #1A2240;
  border-radius: 8px;
  color: #3B82F6;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.outcomes-more-btn:hover {
  background: rgba(59, 130, 246, 0.05);
  border-color: #3B82F6;
}

/* Empty */
.outcomes-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  color: #5A6A8A;
  font-size: 12px;
}

.empty-icon { font-size: 16px; }
</style>
