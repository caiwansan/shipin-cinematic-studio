<!-- /enterprise/payment.vue — AI新媒体运营部门支付页 -->
<template>
  <div class="payment-page">
    <div class="payment-container">
      <!-- Header -->
      <div class="payment-header">
        <h1>确认订单</h1>
        <p>完成支付，立即激活您的 AI 数字部门</p>
      </div>

      <!-- Order Summary -->
      <div class="order-summary" v-if="order">
        <h2>订单详情</h2>
        <div class="summary-row">
          <span>套餐</span>
          <strong>{{ order.planName }}</strong>
        </div>
        <div class="summary-row">
          <span>订单号</span>
          <span class="order-no">{{ order.orderNo }}</span>
        </div>
        <div class="summary-row total">
          <span>应付金额</span>
          <strong class="total-price">¥{{ (order.amount / 100).toFixed(2) }}</strong>
        </div>
      </div>

      <!-- Payment Methods -->
      <div class="payment-methods">
        <h2>选择支付方式</h2>
        <div class="method-grid">
          <div
            v-for="method in paymentMethods"
            :key="method.id"
            class="method-card"
            :class="{ selected: selectedMethod === method.id }"
            @click="selectedMethod = method.id"
          >
            <span class="method-icon">{{ method.icon }}</span>
            <span class="method-name">{{ method.name }}</span>
          </div>
        </div>
      </div>

      <!-- Pay Button -->
      <button
        class="pay-button"
        :disabled="!selectedMethod || processing"
        @click="handlePay"
      >
        {{ processing ? '处理中...' : '立即支付' }}
      </button>

      <!-- BYOK Notice -->
      <div class="byok-notice">
        💡 模型费用自理：支付完成后，您需要在企业设置中配置自己的 LLM API Key
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const order = ref<any>(null)
const selectedMethod = ref('')
const processing = ref(false)

const paymentMethods = [
  { id: 'wechat', name: '微信支付', icon: '💚' },
  { id: 'alipay', name: '支付宝', icon: '🔵' },
  { id: 'bank', name: '银行转账', icon: '🏦' },
]

onMounted(async () => {
  const planId = route.query.planId as string
  if (planId) {
    await createOrder(planId)
  }
})

async function createOrder(planId: string) {
  try {
    const res = await fetch('/api/enterprise/subscription/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({ planId }),
    })
    const data = await res.json()
    if (data.code === 0) {
      order.value = data.data
    }
  } catch (e) {
    console.error('Failed to create order:', e)
  }
}

async function handlePay() {
  if (!selectedMethod.value || !order.value) return
  processing.value = true
  try {
    // Redirect to payment processing
    window.location.href = `/enterprise/payment-processing?orderNo=${order.value.orderNo}&method=${selectedMethod.value}`
  } finally {
    processing.value = false
  }
}
</script>

<style scoped>
.payment-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 60px 24px 80px;
  color: #e0e0e0;
}

.payment-header {
  text-align: center;
  margin-bottom: 32px;
}
.payment-header h1 {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
}
.payment-header p {
  color: #9ca3af;
}

.order-summary {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}
.order-summary h2 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #9ca3af;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}
.summary-row.total {
  border-top: 1px solid #374151;
  margin-top: 12px;
  padding-top: 16px;
}
.total-price {
  font-size: 24px;
  color: #60a5fa;
}
.order-no {
  font-size: 12px;
  color: #6b7280;
}

.payment-methods {
  margin-bottom: 24px;
}
.payment-methods h2 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #9ca3af;
}
.method-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.method-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border: 1px solid #374151;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.method-card:hover {
  border-color: #60a5fa;
}
.method-card.selected {
  border-color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}
.method-icon {
  font-size: 24px;
}
.method-name {
  font-size: 13px;
}

.pay-button {
  width: 100%;
  padding: 14px;
  background: #60a5fa;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.pay-button:hover {
  background: #3b82f6;
}
.pay-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.byok-notice {
  margin-top: 20px;
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #86efac;
  text-align: center;
}
</style>
