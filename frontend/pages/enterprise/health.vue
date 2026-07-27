<!-- /enterprise/health.vue — AI新媒体运营部门健康中心 -->
<template>
  <div class="health-page">
    <!-- Header -->
    <div class="health-header">
      <h1 class="health-title">🏥 AI新媒体运营部门健康中心</h1>
      <p class="health-subtitle">5 秒内了解您的 AI 数字部门状态</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>检查中...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadHealth">重试</button>
    </div>

    <!-- Health Dashboard -->
    <div v-else class="health-dashboard">
      <!-- Overall Score -->
      <div class="score-card" :class="health?.overallStatus">
        <div class="score-value">{{ health?.healthScore || 0 }}</div>
        <div class="score-label">健康评分</div>
        <div class="score-status">{{ statusLabel(health?.overallStatus) }}</div>
      </div>

      <!-- Checks Grid -->
      <div class="checks-grid">
        <div
          v-for="check in health?.checks"
          :key="check.key"
          class="check-card"
          :class="check.status"
        >
          <div class="check-icon">{{ statusIcon(check.status) }}</div>
          <div class="check-label">{{ check.label }}</div>
          <div class="check-status">{{ statusLabel(check.status) }}</div>
        </div>
      </div>

      <!-- Subscription Info -->
      <div v-if="health?.subscription" class="info-section">
        <h3>📋 订阅状态</h3>
        <div class="info-row">
          <span>套餐</span>
          <span>{{ health.subscription.planName }}</span>
        </div>
        <div class="info-row">
          <span>状态</span>
          <span :class="health.subscription.status">{{ statusLabel(health.subscription.status) }}</span>
        </div>
        <div class="info-row">
          <span>到期时间</span>
          <span>{{ formatDate(health.subscription.expireAt) }}</span>
        </div>
        <div class="info-row">
          <span>自动续费</span>
          <span>{{ health.subscription.autoRenew ? '✅ 开启' : '❌ 关闭' }}</span>
        </div>
      </div>

      <!-- AI Employees -->
      <div v-if="health?.agents?.length" class="info-section">
        <h3>🤖 AI 员工</h3>
        <div v-for="agent in health.agents" :key="agent.id" class="agent-row">
          <span>{{ agent.name }}</span>
          <span :class="agent.status">{{ statusLabel(agent.status) }}</span>
        </div>
      </div>

      <!-- Next Steps -->
      <div class="next-steps">
        <h3>📌 下一步</h3>
 <div v-for="step in nextSteps" :key="step" class="step-item">{{ step }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const loading = ref(true)
const error = ref('')
const health = ref<any>(null)

onMounted(() => {
  loadHealth()
})

async function loadHealth() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/enterprise/health')
    if (res.status === 401) {
      error.value = '请先登录'
      return
    }
    const data = await res.json()
    if (data.success) {
      health.value = data.data
    } else {
      error.value = data.message || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const nextSteps = computed(() => {
  const steps: string[] = []
  if (!health.value) return steps
  const checks = health.value.checks || []
  
  const orgCheck = checks.find((c: any) => c.key === 'organization')
  if (orgCheck?.status !== 'ready') steps.push('完善企业资料')
  
  const subCheck = checks.find((c: any) => c.key === 'subscription')
  if (subCheck?.status !== 'ready') steps.push('购买企业订阅')
  
  const agentCheck = checks.find((c: any) => c.key === 'agents')
  if (agentCheck?.status !== 'ready') steps.push('创建 AI 员工')
  
  const llmCheck = checks.find((c: any) => c.key === 'llm')
  if (llmCheck?.status !== 'ready') steps.push('配置 LLM API')
  
  const channelCheck = checks.find((c: any) => c.key === 'channels')
  if (channelCheck?.status !== 'ready') steps.push('授权渠道')
  
  const missionCheck = checks.find((c: any) => c.key === 'firstMission')
  if (missionCheck?.status !== 'ready') steps.push('完成首次任务')
  
  if (steps.length === 0) steps.push('✅ 全部完成！AI 数字部门已就绪')
  
  return steps
})

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ready: '正常',
    warning: '待完善',
    error: '异常',
    healthy: '健康',
    critical: '需处理',
    active: '活跃',
    pending: '待处理',
    paused: '已暂停',
    expired: '已过期',
    cancelled: '已取消',
  }
  return labels[status] || status
}

function statusIcon(status: string): string {
  if (status === 'ready' || status === 'healthy' || status === 'active') return '✅'
  if (status === 'warning' || status === 'pending') return '⚠️'
  if (status === 'error' || status === 'critical' || status === 'expired' || status === 'cancelled') return '❌'
  return '⚪'
}

function formatDate(date: string): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.health-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  color: #e0e0e0;
}

.health-header {
  text-align: center;
  margin-bottom: 32px;
}

.health-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
}

.health-subtitle {
  color: #9ca3af;
  font-size: 14px;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #374151;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  padding: 8px 24px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
}

.score-card {
  text-align: center;
  padding: 32px;
  border-radius: 16px;
  margin-bottom: 24px;
}

.score-card.healthy {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.score-card.warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.score-card.critical {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.score-value {
  font-size: 64px;
  font-weight: bold;
  color: #60a5fa;
}

.score-label {
  font-size: 16px;
  color: #9ca3af;
  margin-top: 4px;
}

.score-status {
  font-size: 14px;
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: 20px;
  display: inline-block;
}

.checks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.check-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.check-card.ready {
  border-color: rgba(34, 197, 94, 0.3);
}

.check-card.warning {
  border-color: rgba(245, 158, 11, 0.3);
}

.check-card.error {
  border-color: rgba(239, 68, 68, 0.3);
}

.check-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.check-label {
  font-size: 14px;
  color: #d1d5db;
}

.check-status {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.info-section {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.info-section h3 {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #374151;
  font-size: 14px;
}

.info-row:last-child {
  border-bottom: none;
}

.agent-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.next-steps {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 20px;
}

.next-steps h3 {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
}

.step-item {
  padding: 8px 0;
  font-size: 14px;
  color: #d1d5db;
}
</style>
