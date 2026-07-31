<template>
  <div class="billing-page">
    <RecruitmentWorkspaceNav />
    <RecruitmentPageShell>
      <template #title>📦 套餐订阅</template>
      <template #subtitle>管理企业套餐、查看使用额度和订单记录</template>
      <template #actions>
        <button @click="refresh" class="ceo-btn-secondary" :disabled="loading">🔄 刷新</button>
      </template>

      <button @click="router.push('/workspace/enterprise')" class="back-btn">← 返回 AI 招聘中心</button>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="refresh" class="ceo-btn-primary">重试</button>
    </div>

    <!-- Main Content -->
    <div v-else class="billing-content">
      <!-- Current Plan Card -->
      <div class="card current-plan-card">
        <div class="card-header">
          <h2>当前套餐</h2>
          <span v-if="subscription" :class="['status-badge', subscription.status]">
            {{ statusLabels[subscription.status] || subscription.status }}
          </span>
        </div>
        <div v-if="subscription" class="plan-details">
          <div class="plan-name">{{ subscription.planName }}</div>
          <div class="plan-price">
            <span class="price">¥{{ (subscription.planPrice / 100).toFixed(0) }}</span>
            <span class="cycle">/{{ subscription.billingCycle === 'yearly' ? '年' : '月' }}</span>
          </div>
          <div class="plan-expire">
            到期时间: {{ new Date(subscription.expireAt).toLocaleDateString('zh-CN') }}
            <span v-if="subscription.autoRenew" class="auto-renew">(自动续费)</span>
          </div>
        </div>
        <div v-else class="no-subscription">
          <p>尚未订阅任何套餐</p>
          <button @click="scrollToPlans" class="ceo-btn-primary">查看可用套餐</button>
        </div>
      </div>

      <!-- Usage Stats -->
      <div class="card usage-card">
        <div class="card-header">
          <h2>使用额度</h2>
        </div>
        <div class="usage-grid">
          <div class="usage-item">
            <div class="usage-label">🤖 AI 员工</div>
            <div class="usage-value">{{ usage?.aiEmployeeCount || 0 }} / {{ limits?.maxEmployees || '∞' }}</div>
            <div class="usage-bar" v-if="limits?.maxEmployees">
              <div class="usage-fill" :style="{ width: getUsagePercent('aiEmployee') + '%' }"></div>
            </div>
          </div>
          <div class="usage-item">
            <div class="usage-label">📡 渠道</div>
            <div class="usage-value">{{ usage?.channelCount || 0 }} / {{ limits?.maxChannels || '∞' }}</div>
            <div class="usage-bar" v-if="limits?.maxChannels">
              <div class="usage-fill" :style="{ width: getUsagePercent('channel') + '%' }"></div>
            </div>
          </div>
          <div class="usage-item">
            <div class="usage-label">👥 成员</div>
            <div class="usage-value">{{ usage?.memberCount || 0 }} / {{ limits?.maxMembers || '∞' }}</div>
            <div class="usage-bar" v-if="limits?.maxMembers">
              <div class="usage-fill" :style="{ width: getUsagePercent('member') + '%' }"></div>
            </div>
          </div>
          <div class="usage-item">
            <div class="usage-label">📄 简历</div>
            <div class="usage-value">{{ usage?.resumeCount || 0 }}</div>
          </div>
          <div class="usage-item">
            <div class="usage-label">👤 候选人</div>
            <div class="usage-value">{{ usage?.pipelineCount || 0 }}</div>
          </div>
          <div class="usage-item">
            <div class="usage-label">💼 Offer</div>
            <div class="usage-value">{{ usage?.offerCount || 0 }}</div>
          </div>
        </div>
      </div>

      <!-- Available Plans -->
      <div v-if="availablePlans.length > 0" class="card plans-card" id="plans-section">
        <div class="card-header">
          <h2>可用套餐</h2>
        </div>
        <div class="plans-grid">
          <div
            v-for="plan in availablePlans"
            :key="plan.id"
            :class="['plan-card', { current: subscription && subscription.planId === plan.id }]"
          >
            <div v-if="subscription && subscription.planId === plan.id" class="current-badge">当前套餐</div>
            <div class="plan-card-header">
              <h3>{{ plan.displayName }}</h3>
              <div class="plan-card-price">
                <span class="price">¥{{ (plan.price / 100).toFixed(0) }}</span>
                <span class="cycle">/{{ plan.billingCycle === 'yearly' ? '年' : '月' }}</span>
              </div>
            </div>
            <div class="plan-features">
              <div class="feature-item">🤖 {{ plan.maxEmployees }} AI 员工</div>
              <div class="feature-item">📡 {{ plan.maxChannels }} 渠道</div>
              <div class="feature-item">👥 {{ plan.maxMembers }} 成员</div>
              <div class="feature-item">💾 {{ plan.storageLimit }}GB 存储</div>
              <div v-if="plan.features && Array.isArray(plan.features)" v-for="f in plan.features" :key="f" class="feature-item">✅ {{ f }}</div>
            </div>
            <button
              @click="selectPlan(plan)"
              :class="['ceo-btn-primary', { current: subscription && subscription.planId === plan.id }]"
              :disabled="subscription && subscription.planId === plan.id"
            >
              {{ subscription && subscription.planId === plan.id ? '当前套餐' : '选择此套餐' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Recent Orders -->
      <div v-if="recentOrders.length > 0" class="card orders-card">
        <div class="card-header">
          <h2>订单记录</h2>
        </div>
        <div class="orders-list">
          <div v-for="order in recentOrders" :key="order.id" class="order-item">
            <div class="order-info">
              <span class="order-no">{{ order.orderNo }}</span>
              <span class="order-plan">{{ order.planType || order.type }}</span>
            </div>
            <div class="order-meta">
              <span class="order-amount">¥{{ order.amount.toFixed(2) }}</span>
              <span :class="['order-status', order.status]">{{ orderStatusLabels[order.status] || order.status }}</span>
              <span class="order-time">{{ new Date(order.createdAt).toLocaleDateString('zh-CN') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- No Orders Empty State -->
      <div v-else class="card empty-card">
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>暂无订单记录</p>
        </div>
      </div>
    </div>
    </RecruitmentPageShell>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useEnterpriseContext } from '~/composables/useEnterpriseContext'
import { useIdentityStore } from '~/stores/identity'

const router = useRouter()
const authStore = useAuthStore()
const ctx = useEnterpriseContext()
const identityStore = useIdentityStore()

const loading = ref(true)
const error = ref('')
const subscription = ref<any>(null)
const usage = ref<any>({})
const limits = ref<any>({})
const availablePlans = ref<any[]>([])
const recentOrders = ref<any[]>([])

const statusLabels: Record<string, string> = {
  active: '生效中',
  expired: '已过期',
  cancelled: '已取消',
  trial: '试用中',
  suspended: '已冻结',
}

const orderStatusLabels: Record<string, string> = {
  pending: '待支付',
  completed: '已完成',
  failed: '失败',
  refunded: '已退款',
}

function getEnterpriseId(): string {
  return identityStore.enterpriseId || authStore.organizationId || authStore.tenantId || authStore.userId || ctx.getEnterpriseId() || ''
}

async function loadBillingOverview() {
  loading.value = true
  error.value = ''
  try {
    const token = authStore.getToken()
    const tenantId = getEnterpriseId()
    const res = await fetch(`/api/enterprise/${tenantId}/billing/overview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json()
    if (data.success) {
      subscription.value = data.data.subscription || null
      usage.value = data.data.usage || null
      limits.value = data.data.limits || null
      availablePlans.value = data.data.availablePlans || []
      recentOrders.value = data.data.recentOrders || []
    } else {
      error.value = data.message || '加载失败'
      availablePlans.value = []
      recentOrders.value = []
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function getUsagePercent(type: string): number {
  if (!usage.value || !limits.value) return 0
  const used = type === 'aiEmployee' ? (usage.value.aiEmployeeCount || 0) :
               type === 'channel' ? (usage.value.channelCount || 0) :
               type === 'member' ? (usage.value.memberCount || 0) : 0
  const max = type === 'aiEmployee' ? (limits.value.maxEmployees || 0) :
              type === 'channel' ? (limits.value.maxChannels || 0) :
              type === 'member' ? (limits.value.maxMembers || 0) : 0
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

function refresh() {
  loadBillingOverview()
}

function scrollToPlans() {
  document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })
}

function selectPlan(plan: any) {
  // 跳转到企业订阅中心进行完整的支付流程
  window.location.href = `/enterprise/membership?planId=${plan.id}`
}

onMounted(async () => {
  // Sprint-08: Fetch identity context from backend
  await identityStore.fetchContext()

  if (!getEnterpriseId()) {
    window.location.href = '/workspace/enterprise/onboarding'
    return
  }
  loadBillingOverview()
})
</script>

<style scoped>
.billing-page {
  padding: 0;
}



.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-secondary, #94a3b8);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-primary, #1e293b);
  border-top-color: var(--color-decision, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-danger, #ef4444);
}

.error-icon {
  font-size: 48px;
}

.card {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary, #f1f5f9);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.status-badge.expired { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.status-badge.cancelled { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.status-badge.suspended { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.status-badge.trial { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }

.plan-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, #f1f5f9);
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.plan-price .price {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-decision, #3b82f6);
}

.plan-price .cycle {
  font-size: 14px;
  color: var(--color-text-secondary, #94a3b8);
}

.plan-expire {
  font-size: 13px;
  color: var(--color-text-secondary, #94a3b8);
}

.auto-renew {
  color: #34d399;
}

.no-subscription {
  text-align: center;
  padding: 20px;
  color: var(--color-text-secondary, #94a3b8);
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.usage-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.usage-label {
  font-size: 12px;
  color: var(--color-text-secondary, #94a3b8);
}

.usage-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary, #f1f5f9);
}

.usage-bar {
  height: 4px;
  background: var(--color-border-primary, #1e293b);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}

.usage-fill {
  height: 100%;
  background: var(--color-decision, #3b82f6);
  border-radius: 2px;
  transition: width 0.3s;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.plan-card {
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  background: var(--color-bg-elevated, #111827);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.plan-card:hover {
  border-color: var(--color-decision, #3b82f6);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.plan-card.current {
  border-color: var(--color-decision, #3b82f6);
  background: var(--color-bg-secondary, #0d1328);
}

.current-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  padding: 2px 8px;
  background: var(--color-decision, #3b82f6);
  color: #fff;
  font-size: 11px;
  border-radius: 10px;
}

.plan-card-header {
  text-align: center;
}

.plan-card-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text-primary, #f1f5f9);
}

.plan-card-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
}

.plan-card-price .price {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-decision, #3b82f6);
}

.plan-card-price .cycle {
  font-size: 12px;
  color: var(--color-text-secondary, #94a3b8);
}

.plan-features {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feature-item {
  font-size: 13px;
  color: var(--color-text-primary, #F1F5F9);
}

.plan-card .ceo-btn-primary {
  margin-top: auto;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-secondary, #0d1328);
  border-radius: 8px;
}

.order-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.order-no {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted, #64748b);
}

.order-plan {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #f1f5f9);
}

.order-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #f1f5f9);
}

.order-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.order-status.pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.order-status.completed { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.order-status.failed { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.order-status.refunded { background: var(--color-border-primary, #1e293b); color: var(--color-text-muted, #64748b); }

.order-time {
  font-size: 12px;
  color: var(--color-text-muted, #64748b);
}

.empty-card {
  padding: 40px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted, #64748b);
}

.empty-icon {
  font-size: 48px;
}

/* Buttons */
.ceo-btn-primary {
  padding: 8px 16px;
  background: var(--color-decision, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}

.ceo-btn-primary:hover {
  opacity: 0.9;
}

.ceo-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ceo-btn-primary.current {
  background: var(--color-border-primary, #1e293b);
  color: var(--color-text-muted, #64748b);
  cursor: not-allowed;
}

.ceo-btn-primary.current {
  background: var(--color-border-primary, #1e293b);
  color: var(--color-text-muted, #64748b);
}

.ceo-btn-secondary {
  padding: 8px 16px;
  background: transparent;
  color: var(--color-text-primary, #F1F5F9);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.ceo-btn-secondary:hover {
  background: var(--color-bg-secondary, #0d1328);
}

.ceo-btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.back-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
  transition: all 0.15s;
  margin-right: 8px;
  margin-bottom: 8px;
}
.back-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
</style>
