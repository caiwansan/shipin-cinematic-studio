<template>
  <div class="execution-module">
    <!-- Stats -->
    <section class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ pendingApprovalActions.length }}</span>
        <span class="stat-label">待审批</span>
      </div>
      <div class="stat-item">
        <span class="stat-value text-blue">{{ activeActions.length }}</span>
        <span class="stat-label">执行中</span>
      </div>
      <div class="stat-item">
        <span class="stat-value text-green">{{ completedCount }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-item">
        <span class="stat-value text-red">{{ rejectedCount }}</span>
        <span class="stat-label">已终止</span>
      </div>
    </section>

    <!-- Pending Approval -->
    <section v-if="pendingApprovalActions.length > 0" class="section">
      <h2 class="section-title">待审批任务</h2>
      <div class="action-list">
        <ActionCard
          v-for="action in pendingApprovalActions"
          :key="action.data.id"
          :action="action"
          @approve="handleApprove(action.data.id)"
          @reject="handleReject(action.data.id)"
        />
      </div>
    </section>

    <!-- Running -->
    <section v-if="activeActions.length > 0" class="section">
      <h2 class="section-title">执行中</h2>
      <div class="action-list">
        <ActionCard
          v-for="action in activeActions"
          :key="action.data.id"
          :action="action"
        />
      </div>
    </section>

    <!-- Empty -->
    <EmptyState
      v-if="pendingApprovalActions.length === 0 && activeActions.length === 0"
      icon="🚀"
      title="暂无执行任务"
      description="批准 AI 经营建议后，执行任务将在此跟踪。"
      helper-text="任务执行状态实时更新"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { EnterpriseDataEnvelope, ActionProgress } from '~/types/enterprise-envelope'
import ActionCard from '~/components/enterprise-ui/cards/ActionCard.vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'

const pendingApprovalActions = ref<EnterpriseDataEnvelope<ActionProgress>[]>([])
const activeActions = ref<EnterpriseDataEnvelope<ActionProgress>[]>([])
const completedCount = ref(0)
const rejectedCount = ref(0)

async function handleApprove(id: string) {
  console.log('批准任务:', id)
}

async function handleReject(id: string) {
  console.log('拒绝任务:', id)
}

async function loadData() {
  // TODO: 接入 EnterpriseAction API
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.execution-module {
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

.stat-value.text-blue { color: var(--color-intelligence); }
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

.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
