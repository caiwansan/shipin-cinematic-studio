<template>
  <div class="enterprise-membership-page">
    <!-- Header -->
    <div class="membership-header">
      <div class="header-bg"></div>
      <div class="header-content">
        <button @click="goBack" class="back-btn">← 返回</button>
        <h1 class="page-title">企业订阅中心</h1>
        <p class="page-subtitle">选择适合您企业的 AI 数字员工套餐，按需升级</p>
        <div class="byok-notice">
          💡 模型费用自理：使用您自己的 LLM API Key，昆仑镜不收取模型调用费
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载套餐中...</p>
    </div>

    <!-- 错误 -->
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <!-- 套餐列表 -->
    <div v-else class="plans-section">
      <!-- 当前订阅状态 -->
      <div v-if="currentSub?.hasSubscription" class="current-sub-card">
        <div class="sub-card-header">
          <span class="sub-label">当前订阅</span>
          <span class="sub-status" :class="currentSub.status">{{ getStatusLabel(currentSub.status) }}</span>
        </div>
        <div class="sub-card-body">
          <div class="sub-plan-name">{{ currentSub.planName }}</div>
          <div class="sub-meta">
            到期：{{ formatDate(currentSub.expireAt) }}（剩余 {{ currentSub.daysLeft }} 天）
          </div>
          <div class="sub-entitlement" v-if="currentSub.entitlement">
            🤖 {{ currentSub.entitlement.maxAgents }} AI 员工 &middot; 📡 {{ currentSub.entitlement.maxChannels }} 渠道 &middot; 👥 {{ currentSub.entitlement.maxMembers }} 成员
          </div>
        </div>
        <div v-if="currentSub.status === 'active'" class="sub-card-footer">
          <button class="btn-cancel" @click="handleCancel">取消订阅</button>
        </div>
      </div>

      <!-- 套餐选择 -->
      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card"
          :class="{
            'plan-card--featured': plan.name === 'pro' || plan.name === 'professional',
            'plan-card--selected': selectedPlan?.id === plan.id,
          }"
        >
          <!-- 标识 -->
          <div v-if="plan.name === 'pro' || plan.name === 'professional'" class="plan-badge">推荐</div>
          <div v-if="currentSub?.planId === plan.id && currentSub?.status === 'active'" class="plan-badge plan-badge--current">当前方案</div>

          <div class="plan-info">
            <h3 class="plan-name">{{ plan.displayName }}</h3>
            <p v-if="plan.description" class="plan-desc">{{ plan.description }}</p>
          </div>

          <!-- 价格：月付 -->
          <div class="plan-price-block">
            <div class="plan-price">
              <span class="price-symbol">¥</span>
              <span class="price-value">{{ formatPrice(plan.price) }}</span>
              <span class="price-cycle">/月</span>
            </div>
            <!-- 年付价格 -->
            <div v-if="plan.yearlyPrice" class="plan-price-yearly">
              <span class="price-symbol">¥</span>
              <span class="price-value">{{ formatPrice(plan.yearlyPrice) }}</span>
              <span class="price-cycle">/年</span>
              <span v-if="plan.yearlyPrice < plan.price * 12" class="price-discount">
                （省 {{ formatPrice(plan.price * 12 - plan.yearlyPrice) }}）
              </span>
            </div>
            <div v-if="plan.originalPrice > plan.price" class="plan-original">
              原价 ¥{{ formatPrice(plan.originalPrice) }}/月
            </div>
          </div>

          <!-- 功能特性 -->
          <div class="plan-features">
            <div class="feature-item">
              <span class="feature-icon">🤖</span>
              <span class="feature-text">
                <strong>{{ plan.maxEmployees === 0 ? '不限' : plan.maxEmployees + ' 个' }}</strong> AI 员工
              </span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📡</span>
              <span class="feature-text">
                <strong>{{ plan.maxChannels === 0 ? '不限' : plan.maxChannels + ' 个' }}</strong> 业务渠道
              </span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">👥</span>
              <span class="feature-text">
                <strong>{{ plan.maxMembers === 0 ? '不限' : plan.maxMembers + ' 人' }}</strong> 企业成员
              </span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">💾</span>
              <span class="feature-text">
                <strong>{{ plan.storageLimit }} GB</strong> 存储空间
              </span>
            </div>
            <div v-if="plan.requireOwnLLMKey" class="feature-item">
              <span class="feature-icon">🔑</span>
              <span class="feature-text"><strong>BYOK</strong> 自带模型 API Key</span>
            </div>
            <div v-if="parsedFeatures(plan.features).length > 0" class="feature-extra-list">
              <div v-for="feat in parsedFeatures(plan.features)" :key="feat" class="feature-extra">
                ✓ {{ feat }}
              </div>
            </div>
          </div>

          <!-- 购买按钮 -->
          <button
            class="plan-btn"
            :class="currentSub?.planId === plan.id && currentSub?.status === 'active' ? 'plan-btn--current' : 'plan-btn--buy'"
            :disabled="(currentSub?.planId === plan.id && currentSub?.status === 'active') || processing"
            @click="handleSelectPlan(plan)"
          >
            {{ currentSub?.planId === plan.id && currentSub?.status === 'active' ? '当前方案' : processing ? '处理中...' : '立即开通' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 无套餐 -->
    <div v-if="!loading && plans.length === 0 && !error" class="empty-state">
      <p>暂无可用套餐，请联系管理员配置</p>
    </div>

    <!-- 周期选择弹窗 -->
    <Transition name="modal-fade">
      <div v-if="showCyclePicker" class="modal-overlay" @click.self="showCyclePicker = false">
        <div class="modal-dialog">
          <h3 class="modal-title">选择购买周期</h3>
          <div class="modal-body">
            <div class="plan-summary">
              <div class="plan-summary-name">{{ payPlan?.displayName }}</div>
            </div>
            <div class="cycle-options">
              <div
                class="cycle-card"
                :class="{ selected: selectedCycle === 'monthly' }"
                @click="selectedCycle = 'monthly'"
              >
                <div class="cycle-name">月付</div>
                <div class="cycle-price">
                  <span class="cycle-price-num">¥{{ payPlan ? formatPrice(payPlan.price) : '0' }}</span>
                  <span class="cycle-price-period">/月</span>
                </div>
              </div>
              <div
                class="cycle-card"
                :class="{ selected: selectedCycle === 'yearly' }"
                @click="selectedCycle = 'yearly'"
              >
                <div class="cycle-name">年付</div>
                <div class="cycle-price">
                  <span class="cycle-price-num">¥{{ payPlan ? formatPrice(payPlan.yearlyPrice || payPlan.price * 12) : '0' }}</span>
                  <span class="cycle-price-period">/年</span>
                </div>
                <div v-if="payPlan && payPlan.yearlyPrice && payPlan.yearlyPrice < payPlan.price * 12" class="cycle-discount">
                  省 {{ formatPrice(payPlan.price * 12 - payPlan.yearlyPrice) }}
                </div>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="modal-btn modal-btn--cancel" @click="showCyclePicker = false">取消</button>
            <button class="modal-btn modal-btn--confirm" @click="confirmCycle">确认购买</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 支付弹窗：选择支付方式 -->
    <Transition name="modal-fade">
      <div v-if="showPaySelect && !showPayQr" class="modal-overlay" @click.self="cancelPay">
        <div class="modal-dialog">
          <h3 class="modal-title">选择支付方式</h3>
          <div class="modal-body">
            <div class="pay-plan-name">{{ payInfo.planName }}</div>
            <div class="pay-amount">¥{{ payInfo.amount }}</div>

            <div class="pay-method-list">
              <div
                v-for="m in payInfo.methods"
                :key="m.id"
                class="pay-method-item"
                @click="handleGeneratePayment(m)"
              >
                <span class="pay-method-icon">{{ m.channel === 'alipay' ? '💳' : '💚' }}</span>
                <span class="pay-method-name">{{ m.name }}</span>
                <span class="pay-method-arrow">›</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="modal-btn modal-btn--cancel" @click="cancelPay">取消</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 支付弹窗：扫码支付 -->
    <Transition name="modal-fade">
      <div v-if="showPayQr" class="modal-overlay" @click.self="closePayQr">
        <div class="modal-dialog modal-dialog--qr">
          <h3 class="modal-title">{{ payInfo.paymentType === 'wxpay_qr' ? '微信扫码支付' : '支付宝扫码支付' }}</h3>
          <div class="modal-body">
            <div class="pay-amount">¥{{ payInfo.amount }}</div>

            <!-- 二维码 -->
            <div class="qr-area">
              <div v-if="payQrCode" class="qr-wrapper">
                <img v-if="payQrBase64" :src="payQrBase64" class="qr-img" :alt="payInfo.paymentType === 'wxpay_qr' ? '微信付款码' : '支付宝付款码'" />
                <img v-else :src="`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payQrCode)}`" class="qr-img" :alt="payInfo.paymentType === 'wxpay_qr' ? '微信付款码' : '支付宝付款码'" />
              </div>
              <div v-else class="qr-loading">正在生成付款码...</div>
            </div>

            <div class="pay-tip">{{ payInfo.paymentType === 'wxpay_qr' ? '请使用微信扫码完成支付' : '请使用支付宝扫码完成支付' }}</div>

            <!-- 支付状态 -->
            <div v-if="payStatus === 'pending'" class="pay-status pay-status--pending">
              ⏳ 等待扫码支付...
            </div>
            <div v-if="payStatus === 'paid'" class="pay-status pay-status--paid">
              ✅ 支付成功！正在激活订阅...
            </div>
            <div v-if="payStatus === 'failed'" class="pay-status pay-status--failed">
              ❌ {{ payError }}
            </div>
          </div>
          <div class="modal-actions">
            <button class="modal-btn modal-btn--cancel" @click="closePayQr" :disabled="isPolling">取消</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast 消息 -->
    <div v-if="toastMsg" class="toast" :class="toastType === 'error' ? 'toast--err' : 'toast--ok'">
      {{ toastMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { getAuthToken } from '~/utils/auth/token'

definePageMeta({ middleware: 'auth' })
const router = useRouter()

function goBack() {
  router.back()
}

// ─── State ───
const plans = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const processing = ref(false)
const currentSub = ref<any>(null)

const toastMsg = ref('')
const toastType = ref<'ok' | 'error'>('ok')

// 套餐选择 → 周期选择
const showCyclePicker = ref(false)
const payPlan = ref<any>(null)
const selectedCycle = ref('monthly')
const selectedPlan = ref<any>(null)

// 支付方式选择
const showPaySelect = ref(false)
const payInfo = reactive({
  orderId: '',
  orderNo: '',
  amount: 0,
  planName: '',
  methods: [] as any[],
  paymentType: '',
})

// 扫码支付
const showPayQr = ref(false)
const payQrCode = ref('')
const payQrBase64 = ref('')
const payStatus = ref<'pending' | 'paid' | 'failed'>('pending')
const payError = ref('')
const isPolling = ref(false)
let pollTimer: any = null

// ─── Helper ───
function getToken(): string | null {
  return getAuthToken() || null
}

function formatPrice(price: number): string {
  return (price / 100).toFixed(price % 100 === 0 ? 0 : 2)
}

function formatDate(date: string | Date): string {
  if (!date) return '-'
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: '已激活',
    pending: '待支付',
    expired: '已过期',
    cancelled: '已取消',
    trial: '试用中',
    suspended: '已暂停',
  }
  return map[status] || status
}

function parsedFeatures(features: any): string[] {
  if (!features) return []
  if (typeof features === 'string') {
    try { return JSON.parse(features) } catch { return [] }
  }
  return Array.isArray(features) ? features : []
}

function showToast(msg: string, type: 'ok' | 'error' = 'ok') {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => { toastMsg.value = '' }, 5000)
}

// ─── Data Fetching ───
async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    // 获取套餐列表
    const plansRes = await fetch('/api/enterprise/subscription/available-plans', { headers })
    if (plansRes.ok) {
      const data = await plansRes.json()
      const raw = data?.data || data
      plans.value = Array.isArray(raw) ? raw : []
    } else {
      throw new Error('获取套餐失败')
    }

    // 获取当前订阅
    const subRes = await fetch('/api/enterprise/subscription/current', { headers })
    if (subRes.ok) {
      const data = await subRes.json()
      currentSub.value = data?.data || null
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  }
  loading.value = false
}

// ─── Plan Selection ───
function handleSelectPlan(plan: any) {
  if (currentSub.value?.planId === plan.id && currentSub.value?.status === 'active') return
  
  // 显示周期选择弹窗
  payPlan.value = plan
  selectedCycle.value = 'monthly'
  showCyclePicker.value = true
}

async function confirmCycle() {
  if (!payPlan.value) return
  showCyclePicker.value = false
  processing.value = true
  
  try {
    const token = getToken()
    if (!token) {
      showToast('❌ 请先登录', 'error')
      return
    }

    const res = await fetch('/api/enterprise/subscription/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        planId: payPlan.value.id,
        cycle: selectedCycle.value,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      showToast(`❌ ${data?.message || data?.error || '创建订单失败'}`, 'error')
      return
    }

    const orderData = data?.data || data
    selectedPlan.value = payPlan.value

    if (orderData.needPay !== false && orderData.methods?.length > 0) {
      // 显示支付方式选择
      payInfo.orderId = orderData.orderId
      payInfo.orderNo = orderData.orderNo || ''
      payInfo.amount = orderData.amount
      payInfo.planName = orderData.planName
      payInfo.methods = orderData.methods
      showPaySelect.value = true
    } else {
      showToast('✅ 订单已创建，请选择支付方式')
    }
  } catch (e: any) {
    showToast(`❌ 网络错误: ${e.message}`, 'error')
  }
  processing.value = false
}

// ─── Payment ───
async function handleGeneratePayment(method: any) {
  showPaySelect.value = false
  showPayQr.value = true
  payStatus.value = 'pending'
  payError.value = ''
  payQrCode.value = ''
  payQrBase64.value = ''

  try {
    const token = getToken()
    const res = await fetch('/api/enterprise/subscription/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId: payInfo.orderId,
        channel: method.channel,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      payStatus.value = 'failed'
      payError.value = data?.message || data?.error || '创建支付失败'
      return
    }

    const payData = data?.data || data
    payInfo.paymentType = payData.paymentType

    if (payData.qrCode) {
      // 支付宝当面付
      payQrCode.value = payData.qrCode
      startPolling(payInfo.orderId)
    } else if (payData.codeUrl) {
      // 微信 NATIVE
      payQrCode.value = payData.codeUrl
      startPolling(payInfo.orderId)
    } else if (payData.payUrl) {
      // 支付链接 → 转为二维码
      payQrCode.value = payData.payUrl
      try {
        const QRCode = (await import('qrcode')).default
        const qrDataUrl = await QRCode.toDataURL(payData.payUrl, { width: 280, margin: 2 })
        payQrBase64.value = qrDataUrl
      } catch {
        // qrcode 加载失败时用 qrserver fallback
      }
      startPolling(payInfo.orderId)
    } else {
      payStatus.value = 'failed'
      payError.value = payData?.message || '生成付款凭据失败'
    }
  } catch (e: any) {
    payStatus.value = 'failed'
    payError.value = '网络错误，请重试'
  }
}

// ─── Polling ───
function startPolling(orderId: string) {
  isPolling.value = true
  let pollCount = 0

  const poll = async () => {
    if (pollCount >= 120) {
      isPolling.value = false
      payStatus.value = 'failed'
      payError.value = '支付超时，请重新下单'
      return
    }
    pollCount++

    try {
      const token = getToken()
      const res = await fetch(`/api/enterprise/subscription/payment-status/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await res.json()
      const statusData = body?.data || body

      if (statusData.isPaid) {
        isPolling.value = false
        payStatus.value = 'paid'
        
        // 支付成功后激活订阅
        try {
          const actRes = await fetch('/api/enterprise/subscription/activate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId }),
          })
          const actData = await actRes.json()
          if (actData?.success || actData?.data) {
            // 激活成功
          }
        } catch {
          // 激活失败不影响主流程
        }

        setTimeout(() => {
          closePayQr()
          showToast('✅ 订阅已激活！')
          setTimeout(() => {
            // 刷新页面数据
            fetchData()
          }, 1000)
        }, 1000)
        return
      }
    } catch {
      // 忽略轮询错误
    }

    if (isPolling.value) {
      pollTimer = setTimeout(poll, 5000)
    }
  }

  pollTimer = setTimeout(poll, 5000)
}

function closePayQr() {
  showPayQr.value = false
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  isPolling.value = false
}

function cancelPay() {
  showPaySelect.value = false
  selectedPlan.value = null
}

// ─── Cancel Subscription ───
async function handleCancel() {
  if (!confirm('确定要取消订阅吗？取消后当前周期结束后将不再续费。')) return
  
  try {
    const token = getToken()
    const res = await fetch('/api/enterprise/subscription/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json()
    if (data?.success) {
      showToast('✅ 订阅已取消')
      setTimeout(() => fetchData(), 1500)
    } else {
      showToast(`❌ ${data?.message || '取消失败'}`, 'error')
    }
  } catch (e: any) {
    showToast(`❌ 网络错误: ${e.message}`, 'error')
  }
}

// ─── Lifecycle ───
onMounted(fetchData)

onUnmounted(() => {
  if (pollTimer) {
    clearTimeout(pollTimer)
  }
})
</script>

<style scoped>
.enterprise-membership-page {
  min-height: 100vh;
  background: #0b0e1a;
  color: #e4e4e7;
  padding-bottom: 60px;
}

/* Header */
.membership-header {
  position: relative;
  padding: 60px 20px 40px;
  text-align: center;
  overflow: hidden;
}
.header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(59,130,246,0.06) 0%, transparent 100%);
  pointer-events: none;
}
.header-content {
  position: relative;
  z-index: 1;
}
.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 8px;
  background: linear-gradient(135deg, #60a5fa, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.page-subtitle {
  font-size: 0.85rem;
  color: #71717a;
  margin: 0 0 12px;
}
.byok-notice {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 20px;
  font-size: 0.75rem;
  color: #86efac;
}

/* Loading / Error / Empty */
.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  font-size: 0.85rem;
  color: #71717a;
}
.error-state { color: #ef4444; }
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #374151;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Current Subscription Card */
.current-sub-card {
  max-width: 1060px;
  margin: 0 auto 32px;
  padding: 20px 24px;
  background: rgba(59, 130, 246, 0.04);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 14px;
}
.sub-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.sub-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
}
.sub-status {
  font-size: 0.7rem;
  padding: 2px 10px;
  border-radius: 6px;
  font-weight: 600;
}
.sub-status.active { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.sub-status.pending { background: rgba(234,179,8,0.1); color: #eab308; border: 1px solid rgba(234,179,8,0.2); }
.sub-status.expired { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
.sub-status.cancelled { background: rgba(107,114,128,0.1); color: #9ca3af; border: 1px solid rgba(107,114,128,0.2); }
.sub-plan-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f4f4f5;
}
.sub-meta {
  font-size: 0.78rem;
  color: #71717a;
  margin-top: 4px;
}
.sub-entitlement {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-top: 8px;
}
.sub-card-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.btn-cancel {
  padding: 6px 16px;
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  background: transparent;
  color: #ef4444;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: rgba(239,68,68,0.1);
}

/* Plans Grid */
.plans-section {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
}
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
  gap: 20px;
}

.plan-card {
  position: relative;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  transition: all 0.25s;
}
.plan-card:hover {
  border-color: rgba(59,130,246,0.2);
  background: rgba(255,255,255,0.03);
  transform: translateY(-2px);
}
.plan-card--featured {
  border-color: rgba(59,130,246,0.25);
  box-shadow: 0 0 20px rgba(59,130,246,0.08);
}

.plan-badge {
  position: absolute;
  top: -1px;
  right: 20px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 0 0 8px 8px;
}
.plan-badge--current {
  background: rgba(34, 197, 94, 0.8);
  right: auto;
  left: 20px;
}

.plan-name {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 4px;
  color: #e4e4e7;
}
.plan-desc {
  font-size: 0.78rem;
  color: #71717a;
  margin: 0 0 16px;
}

.plan-price-block {
  margin-bottom: 16px;
}
.plan-price {
  margin-bottom: 4px;
}
.price-symbol {
  font-size: 1rem;
  vertical-align: top;
  line-height: 1.3;
}
.price-value {
  font-size: 2rem;
  font-weight: 800;
  color: #f4f4f5;
}
.price-cycle {
  font-size: 0.78rem;
  color: #71717a;
}
.plan-price-yearly {
  font-size: 0.85rem;
  color: #a1a1aa;
}
.price-discount {
  font-size: 0.7rem;
  color: #22c55e;
  margin-left: 4px;
}
.plan-original {
  font-size: 0.7rem;
  color: #6b7280;
  text-decoration: line-through;
}

.plan-features {
  flex: 1;
  margin-bottom: 20px;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 0.82rem;
}
.feature-icon { font-size: 0.85rem; flex-shrink: 0; }
.feature-text { color: #a1a1aa; }
.feature-extra-list {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.feature-extra {
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 2px 0;
}

.plan-btn {
  width: 100%;
  padding: 12px 0;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.plan-btn--current {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: #71717a;
}
.plan-btn--buy {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}
.plan-btn--buy:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(59,130,246,0.25);
}
.plan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal-dialog {
  background: #12142a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  width: 400px;
  max-width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.modal-dialog--qr {
  width: 420px;
}
.modal-title {
  padding: 20px 24px 0;
  font-size: 1rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 16px;
}
.modal-body {
  padding: 0 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.plan-summary {
  text-align: center;
}
.plan-summary-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e4e4e7;
}

/* Cycle Options */
.cycle-options {
  display: flex;
  gap: 12px;
  width: 100%;
}
.cycle-card {
  flex: 1;
  padding: 16px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255,255,255,0.02);
}
.cycle-card:hover {
  border-color: rgba(59,130,246,0.3);
}
.cycle-card.selected {
  border-color: rgba(59,130,246,0.4);
  background: rgba(59,130,246,0.08);
}
.cycle-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #a1a1aa;
  margin-bottom: 8px;
}
.cycle-price-num {
  font-size: 1.4rem;
  font-weight: 800;
  color: #f4f4f5;
}
.cycle-price-period {
  font-size: 0.72rem;
  color: #71717a;
}
.cycle-discount {
  font-size: 0.65rem;
  color: #22c55e;
  margin-top: 4px;
}

/* Payment Method List */
.pay-plan-name { font-size: 0.85rem; color: #a1a1aa; }
.pay-amount { font-size: 2rem; font-weight: 800; color: #f4f4f5; }

.pay-method-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.pay-method-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.pay-method-item:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(59,130,246,0.3);
}
.pay-method-icon { font-size: 1.3rem; }
.pay-method-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: #e4e4e7; }
.pay-method-arrow { font-size: 1.2rem; color: #52525b; }

/* QR Code Area */
.qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 8px 0;
}
.qr-wrapper {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.qr-img {
  width: 220px;
  height: 220px;
  display: block;
}
.qr-loading {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #71717a;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
}

/* Pay Status */
.pay-status {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  text-align: center;
}
.pay-status--pending {
  background: rgba(234,179,8,0.08);
  color: #eab308;
  border: 1px solid rgba(234,179,8,0.15);
}
.pay-status--paid {
  background: rgba(34,197,94,0.08);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,0.15);
}
.pay-status--failed {
  background: rgba(239,68,68,0.08);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.15);
}

.pay-tip {
  font-size: 0.72rem;
  color: #ef4444;
  text-align: center;
  max-width: 300px;
  line-height: 1.4;
}

/* Modal Actions */
.modal-actions {
  padding: 14px 24px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.modal-btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.modal-btn--cancel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #a1a1aa; }
.modal-btn--cancel:hover { background: rgba(255,255,255,0.08); }
.modal-btn--confirm { background: linear-gradient(135deg,#3b82f6,#2563eb); color: #fff; }
.modal-btn--confirm:hover:not(:disabled) { opacity: 0.9; }
.modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  z-index: 300;
  animation: fadeUp 0.3s ease;
}
.toast--ok { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.toast--err { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

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
