<!-- AiTeamDisplay.vue — AI 招聘团队首页展示卡 -->
<!-- 产品化：AI 员工卡，不是 Agent 列表 -->
<!-- 职责：首页核心区展示 AI 团队状态，轻量级 -->
<template>
  <div class="ai-team">
    <div class="ai-team-header">
      <h2 class="ai-team-title">🤖 AI 招聘团队</h2>
      <span class="ai-team-hint">你的 AI 招聘员工已就绪</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="ai-team-loading">
      <div class="ai-team-spinner"></div>
      <span>加载 AI 员工状态...</span>
    </div>

    <!-- 无 AI 员工 -->
    <div v-else-if="agents.length === 0" class="ai-team-empty">
      <div class="ai-team-empty-icon">🕒</div>
      <p>AI 招聘主管待命中</p>
      <span class="ai-team-empty-hint">创建岗位后 AI 团队自动开始工作</span>
      <button class="ai-team-create-btn" @click="$emit('create-job')">
        📝 创建首个岗位
      </button>
    </div>

    <!-- AI 员工卡片列表 -->
    <div v-else class="ai-team-grid">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="ai-member-card"
        :class="{ 'ai-member-card--active': agent.status === 'active' }"
      >
        <div class="ai-member-avatar">
          {{ getAgentIcon(agent.type) }}
          <span
            class="ai-member-dot"
            :class="{
              'ai-member-dot--online': agent.status === 'active',
              'ai-member-dot--offline': agent.status !== 'active',
            }"
          ></span>
        </div>
        <div class="ai-member-body">
          <div class="ai-member-name">{{ agent.name }}</div>
          <div class="ai-member-role">{{ getRoleLabel(agent.type) }}</div>
          <div class="ai-member-status">
            <span v-if="agent.status === 'active'" class="ai-member-badge ai-member-badge--work">
              🟢 工作中
            </span>
            <span v-else class="ai-member-badge ai-member-badge--idle">
              ⏸ 待命中
            </span>
          </div>
        </div>
        <div class="ai-member-stats">
          <div class="ai-member-stat">
            <span class="ai-member-stat-value">{{ agent.stats?.completedToday || agent.totalTasks || 0 }}</span>
            <span class="ai-member-stat-label">今日完成</span>
          </div>
          <div class="ai-member-stat">
            <span class="ai-member-stat-value">{{ agent.stats?.discovered || '—' }}</span>
            <span class="ai-member-stat-label">发现</span>
          </div>
        </div>
        <button
          v-if="agent.status === 'active'"
          class="ai-member-report-btn"
          @click="$emit('view-agent', agent.id)"
        >
          查看报告 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  agents: Array<{
    id: string
    name: string
    type: string
    status: string
    totalTasks?: number
    stats?: { completedToday?: number; discovered?: number; pending?: number }
  }>
  loading: boolean
}>()

defineEmits<{
  (e: 'create-job'): void
  (e: 'view-agent', agentId: string): void
}>()

function getAgentIcon(type: string): string {
  const icons: Record<string, string> = {
    recruiter: '🤖',
    recruiter_director: '🤖',
    talent_scout: '🔍',
    talent_researcher: '🔍',
    interviewer: '🎤',
    screener: '📋',
    coordinator: '📅',
    campaign: '📢',
    analyst: '📊',
  }
  return icons[type] || '🤖'
}

function getRoleLabel(type: string): string {
  const labels: Record<string, string> = {
    recruiter: '招聘经理',
    recruiter_director: '招聘总监',
    talent_scout: '猎聘顾问',
    talent_researcher: '人才研究员',
    interviewer: '面试官',
    screener: '简历筛选',
    coordinator: '招聘协调员',
    campaign: '招聘活动经理',
    analyst: '招聘分析师',
  }
  return labels[type] || 'AI 员工'
}
</script>

<style scoped>
.ai-team {
  background: var(--rec-bg-secondary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-lg);
  padding: var(--rec-space-6);
}

.ai-team-header {
  margin-bottom: var(--rec-space-5);
}

.ai-team-title {
  font-size: var(--rec-text-lg);
  font-weight: 700;
  color: var(--rec-text-primary);
  margin: 0;
}

.ai-team-hint {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
  margin-top: var(--rec-space-1);
}

.ai-team-loading {
  display: flex;
  align-items: center;
  gap: var(--rec-space-3);
  padding: var(--rec-space-8);
  justify-content: center;
  color: var(--rec-text-muted);
  font-size: var(--rec-text-sm);
}

.ai-team-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--rec-border-primary);
  border-top-color: var(--rec-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-team-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--rec-space-8);
  text-align: center;
}

.ai-team-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--rec-space-3);
}

.ai-team-empty p {
  font-size: var(--rec-text-md);
  color: var(--rec-text-primary);
  margin: 0 0 4px;
  font-weight: 500;
}

.ai-team-empty-hint {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
}

.ai-team-create-btn {
  margin-top: var(--rec-space-4);
  padding: 10px 24px;
  font-size: var(--rec-text-md);
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: var(--rec-radius-md);
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.ai-team-create-btn:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
  transform: translateY(-1px);
}

.ai-team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--rec-space-4);
}

.ai-member-card {
  display: flex;
  flex-direction: column;
  padding: var(--rec-space-5);
  background: var(--rec-bg-primary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-md);
  transition: border-color 0.15s, box-shadow 0.15s;
  position: relative;
}

.ai-member-card:hover {
  border-color: rgba(96, 165, 250, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.ai-member-card--active {
  border-color: rgba(96, 165, 250, 0.2);
}

.ai-member-avatar {
  font-size: 2rem;
  position: relative;
  display: inline-block;
  margin-bottom: var(--rec-space-3);
  width: fit-content;
}

.ai-member-dot {
  position: absolute;
  bottom: 0;
  right: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--rec-bg-primary);
}

.ai-member-dot--online {
  background: #22c55e;
}

.ai-member-dot--offline {
  background: #6b7280;
}

.ai-member-body {
  margin-bottom: var(--rec-space-3);
}

.ai-member-name {
  font-size: var(--rec-text-md);
  font-weight: 600;
  color: var(--rec-text-primary);
}

.ai-member-role {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
  margin-top: 2px;
}

.ai-member-status {
  margin-top: var(--rec-space-2);
}

.ai-member-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: var(--rec-text-xs);
  font-weight: 500;
}

.ai-member-badge--work {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.ai-member-badge--idle {
  background: rgba(107, 114, 128, 0.1);
  color: #9ca3af;
}

.ai-member-stats {
  display: flex;
  gap: var(--rec-space-4);
  padding: var(--rec-space-3) 0;
  border-top: 1px solid var(--rec-border-secondary);
  margin-top: auto;
}

.ai-member-stat {
  display: flex;
  flex-direction: column;
}

.ai-member-stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--rec-brand);
}

.ai-member-stat-label {
  font-size: var(--rec-text-xs);
  color: var(--rec-text-muted);
}

.ai-member-report-btn {
  margin-top: var(--rec-space-2);
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-sm);
  color: var(--rec-text-secondary);
  font-size: var(--rec-text-xs);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.ai-member-report-btn:hover {
  background: rgba(96, 165, 250, 0.08);
  color: var(--rec-brand);
  border-color: rgba(96, 165, 250, 0.3);
}
</style>
