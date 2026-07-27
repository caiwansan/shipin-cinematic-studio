<!-- EmployeeIdentity.vue — AI 员工身份区 -->
<!-- 头像 + 名称 + 状态 + Trust Score + 工作统计 -->
<template>
  <section class="employee-identity">
    <!-- 顶部: 头像 + 基本信息 -->
    <div class="identity-header">
      <div class="identity-avatar-wrap">
        <div class="identity-avatar" :style="avatarStyle">
          {{ avatarEmoji }}
        </div>
        <div class="identity-status-dot" :class="statusClass" />
      </div>

      <div class="identity-info">
        <h1 class="identity-name">{{ name }}</h1>
        <div class="identity-role">{{ displayRole }}</div>
        <div v-if="bio" class="identity-bio">{{ bio }}</div>
        <div class="identity-meta">
          <span class="identity-badge" :class="statusClass">
            {{ statusText }}
          </span>
          <span v-if="workingHours" class="identity-hours">
            🕐 {{ workingHours }}
          </span>
        </div>
      </div>
    </div>

    <!-- Trust Score 卡片 -->
    <div class="trust-card">
      <div class="trust-header">
        <span class="trust-icon">🛡️</span>
        <span class="trust-title">可信度</span>
      </div>
      <div class="trust-score">
        <div class="trust-score-value" :class="trustScoreClass">{{ trustScore }}%</div>
        <div class="trust-score-bar">
          <div class="trust-score-fill" :style="{ width: trustScore + '%' }" :class="trustScoreClass" />
        </div>
      </div>
      <div class="trust-stats">
        <div class="trust-stat">
          <span class="trust-stat-value">{{ consecutiveDays }}</span>
          <span class="trust-stat-label">连续工作天数</span>
        </div>
        <div class="trust-stat-divider" />
        <div class="trust-stat">
          <span class="trust-stat-value">{{ totalExecutions }}</span>
          <span class="trust-stat-label">30天执行</span>
        </div>
        <div class="trust-stat-divider" />
        <div class="trust-stat">
          <span class="trust-stat-value">{{ humanCorrections }}</span>
          <span class="trust-stat-label">人工纠正</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// ─── Props ───────────────────────────────────────────────
const props = defineProps<{
  name: string
  avatarUrl: string | null
  bio: string | null
  role: string
  agentType: string
  status: string
  runtimeStatus: string
  trustScore: number
  consecutiveDays: number
  totalExecutions: number
  humanCorrections: number
  lastActiveAt: string | null
  workingHours: string | null
}>()

// ─── Computed ────────────────────────────────────────────
const avatarEmoji = computed(() => {
  const map: Record<string, string> = {
    growth_director: '🧠',
    market_analyst: '📊',
    content_manager: '✍️',
    customer_ops: '🤝',
    sales_assistant: '💼',
    sales: '💰',
    marketing: '📢',
    support: '🎧',
    analyst: '📈',
    content: '📝',
    customer_success: '🌟',
  }
  return map[props.agentType] || '🤖'
})

const avatarStyle = computed(() => {
  if (props.avatarUrl) {
    return { backgroundImage: `url(${props.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: avatarGradient.value }
})

const avatarGradient = computed(() => {
  const map: Record<string, string> = {
    growth_director: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
    content_manager: 'linear-gradient(135deg, #06B6D4, #3B82F6)',
    market_analyst: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
    customer_ops: 'linear-gradient(135deg, #10B981, #06B6D4)',
    sales_assistant: 'linear-gradient(135deg, #F59E0B, #EF4444)',
  }
  return map[props.agentType] || 'linear-gradient(135deg, #3B82F6, #8B5CF6)'
})

const statusClass = computed(() => {
  const s = props.runtimeStatus || props.status
  if (s === 'active' || s === 'running') return 'status-active'
  if (s === 'paused') return 'status-paused'
  return 'status-idle'
})

const statusText = computed(() => {
  const s = props.runtimeStatus || props.status
  if (s === 'active' || s === 'running') return '运行中'
  if (s === 'paused') return '已暂停'
  return '离线'
})

const displayRole = computed(() => {
  const map: Record<string, string> = {
    growth_director: '增长总监',
    market_analyst: '市场分析师',
    content_manager: '内容增长专员',
    customer_ops: '客户运营专员',
    sales_assistant: '销售参谋专员',
    sales: '销售 AI',
    marketing: '营销 AI',
    support: '客服 AI',
    analyst: '分析 AI',
    content: '内容 AI',
    customer_success: '客户成功',
  }
  return map[props.role] || props.role
})

const trustScoreClass = computed(() => {
  if (props.trustScore >= 90) return 'score-excellent'
  if (props.trustScore >= 70) return 'score-good'
  return 'score-warning'
})
</script>

<style scoped>
.employee-identity {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Header ─── */
.identity-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.identity-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.identity-avatar {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.identity-status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid #0D1328;
}

.status-active { background: #22C55E; box-shadow: 0 0 6px #22C55E50; }
.status-paused { background: #F59E0B; }
.status-idle { background: #6B7280; }

.identity-info {
  flex: 1;
  min-width: 0;
}

.identity-name {
  font-size: 20px;
  font-weight: 700;
  color: #f0f0f0;
  margin: 0 0 4px;
}

.identity-role {
  font-size: 13px;
  color: #3B82F6;
  margin-bottom: 6px;
}

.identity-bio {
  font-size: 12px;
  color: #9CA3AF;
  line-height: 1.5;
  margin-bottom: 8px;
}

.identity-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.identity-badge {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}

.identity-badge.status-active {
  background: rgba(34, 197, 94, 0.1);
  color: #22C55E;
}

.identity-badge.status-paused {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
}

.identity-badge.status-idle {
  background: rgba(107, 114, 128, 0.1);
  color: #6B7280;
}

.identity-hours {
  font-size: 11px;
  color: #6B7280;
}

/* ─── Trust Card ─── */
.trust-card {
  background: linear-gradient(135deg, #0a1628 0%, #0f2a4a 100%);
  border: 1px solid rgba(30, 120, 200, 0.2);
  border-radius: 12px;
  padding: 16px;
}

.trust-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.trust-icon {
  font-size: 14px;
}

.trust-title {
  font-size: 12px;
  color: #8899B8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.trust-score {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.trust-score-value {
  font-size: 28px;
  font-weight: 800;
}

.trust-score-value.score-excellent { color: #22C55E; }
.trust-score-value.score-good { color: #F59E0B; }
.trust-score-value.score-warning { color: #EF4444; }

.trust-score-bar {
  flex: 1;
  height: 6px;
  background: #1A2240;
  border-radius: 3px;
  overflow: hidden;
}

.trust-score-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s;
}

.trust-score-fill.score-excellent { background: linear-gradient(90deg, #22C55E, #10B981); }
.trust-score-fill.score-good { background: linear-gradient(90deg, #F59E0B, #EAB308); }
.trust-score-fill.score-warning { background: linear-gradient(90deg, #EF4444, #F87171); }

.trust-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.trust-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.trust-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #e8e8e8;
}

.trust-stat-label {
  font-size: 10px;
  color: #5A6A8A;
}

.trust-stat-divider {
  width: 1px;
  height: 24px;
  background: #1A2240;
}

/* ─── Responsive ─── */
@media (max-width: 640px) {
  .identity-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .identity-meta {
    justify-content: center;
  }

  .trust-stats {
    gap: 12px;
  }
}
</style>
