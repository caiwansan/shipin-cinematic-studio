<template>
  <div class="decisions-module">
    <!-- Stats -->
    <section class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ decisions.length }}</span>
        <span class="stat-label">待确认建议</span>
      </div>
      <div class="stat-item">
        <span class="stat-value text-green">{{ acceptedCount }}</span>
        <span class="stat-label">已批准</span>
      </div>
      <div class="stat-item">
        <span class="stat-value text-red">{{ rejectedCount }}</span>
        <span class="stat-label">已拒绝</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ avgConfidence }}%</span>
        <span class="stat-label">平均置信度</span>
      </div>
    </section>

    <!-- Decision Queue -->
    <section class="section">
      <h2 class="section-title">AI 经营建议</h2>
      <div v-if="decisions.length > 0" class="decision-list">
        <DecisionCard
          v-for="rec in decisions"
          :key="rec.id"
          :decision="{
            source: rec.source || 'WeCom',
            freshness: rec.createdAt,
            confidence: rec.priorityScore || 85,
            data: {
              title: rec.title,
              rationale: rec.rationale,
              priorityLevel: `P${rec.priority}`,
              decisionStatus: rec.decisionStatus,
            }
          }"
          @accept="handleAccept(rec.id)"
          @reject="handleReject(rec.id)"
        />
      </div>
      <EmptyState
        v-else
        icon="💡"
        title="暂无待处理建议"
        description="AI 引擎持续分析企业经营数据，发现需要决策的事项后将在此呈现。"
        helper-text="建议基于 EnterpriseRecommendation 引擎生成"
      />
    </section>

    <!-- Decision Impact -->
    <section class="section">
      <h2 class="section-title">决策影响预测</h2>
      <EmptyState
        icon="📊"
        title="暂无历史决策数据"
        description="您的决策将帮助企业持续优化经营策略。"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DecisionCard from '~/components/enterprise-ui/cards/DecisionCard.vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'

interface Decision {
  id: string
  title: string
  rationale: string
  priority: number
  priorityScore?: number
  decisionStatus: string
  source?: string
  createdAt?: string
}

const decisions = ref<Decision[]>([])

const acceptedCount = computed(() => decisions.value.filter(d => d.decisionStatus === 'approved').length)
const rejectedCount = computed(() => decisions.value.filter(d => d.decisionStatus === 'rejected').length)
const avgConfidence = computed(() => {
  if (decisions.value.length === 0) return 0
  const sum = decisions.value.reduce((acc, d) => acc + (d.priorityScore || 85), 0)
  return Math.round(sum / decisions.value.length)
})

async function handleAccept(id: string) {
  console.log('批准建议:', id)
}

async function handleReject(id: string) {
  console.log('拒绝建议:', id)
}

async function loadData() {
  // TODO: 接入 EnterpriseRecommendation API
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.decisions-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.stat-item {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-intelligence);
}

.stat-value.text-green { color: #10b981; }
.stat-value.text-red { color: var(--color-danger); }

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-lg);
  color: var(--color-text-primary);
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
