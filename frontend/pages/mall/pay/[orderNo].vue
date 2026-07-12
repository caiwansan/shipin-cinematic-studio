<template>
  <div class="min-h-screen bg-[#050A15]">
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-4xl mx-auto px-4">
        <NuxtLink to="/mall/orders" class="text-sm text-gray-400 hover:text-white">← 返回订单列表</NuxtLink>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-4 py-8 text-center">
      <div class="text-6xl mb-4">💳</div>
      <h1 class="text-xl font-bold text-white">确认支付</h1>
      <p class="text-gray-400 mt-2">订单号：{{ route.params.orderNo }}</p>
      <div v-if="order" class="mt-4 bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-6">
        <div class="text-sm text-gray-400">应付金额</div>
        <div class="text-3xl font-bold text-red-400 mt-1">¥{{ order.payAmount.toFixed(2) }}</div>
      </div>

      <!-- 选择支付方式 -->
      <div class="mt-6 space-y-3">
        <h2 class="text-sm font-semibold text-white">选择支付方式</h2>
        <div class="grid grid-cols-2 gap-3">
          <button @click="doPay('wechat')"
            :disabled="loading"
            class="p-4 rounded-xl border transition text-center hover:border-green-500 hover:bg-green-600/10 border-[#1A2D4A] bg-[#0D1B33]">
            <span class="text-2xl">💚</span>
            <div class="text-sm text-white mt-1">微信支付</div>
          </button>
          <button @click="doPay('alipay')"
            :disabled="loading"
            class="p-4 rounded-xl border transition text-center hover:border-blue-500 hover:bg-blue-600/10 border-[#1A2D4A] bg-[#0D1B33]">
            <span class="text-2xl">💙</span>
            <div class="text-sm text-white mt-1">支付宝</div>
          </button>
        </div>
      </div>

      <div v-if="loading" class="mt-4 text-sm text-gray-400">⏳ 正在获取付款二维码...</div>
      <div v-if="error" class="mt-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
        <p class="text-xs text-red-400/70 text-center">{{ error }}</p>
      </div>
    </div>

    <!-- 付款二维码弹窗（和 VIP 完全一致） -->
    <Transition name="modal-fade">
      <div v-if="showQr" class="pay-overlay" @click.self="closeQr">
        <div class="pay-dialog pay-dialog--qr">
          <h3 class="pay-title">{{ paymentType === 'wxpay_qr' ? '微信扫码付款' : '支付宝扫码付款' }}</h3>
          <div class="pay-body">
            <div class="pay-plan-name">商城订单 {{ order?.orderNo?.slice(0,12) }}...</div>
            <div class="pay-amount">¥{{ amount.toFixed(2) }}</div>

            <div class="pay-alipay-qr-area">
              <div v-if="qrCode" class="pay-alipay-qr-wrapper">
                <img v-if="qrBase64" :src="qrBase64" class="pay-alipay-qr-img" :alt="paymentType === 'wxpay_qr' ? '微信付款码' : '支付宝付款码'" />
                <img v-else :src="`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`" class="pay-alipay-qr-img" :alt="paymentType === 'wxpay_qr' ? '微信付款码' : '支付宝付款码'" />
              </div>
              <div v-else class="pay-alipay-loading">正在生成付款码...</div>
            </div>

            <div class="pay-tip">{{ paymentType === 'wxpay_qr' ? '请使用微信扫码完成支付' : '请使用支付宝扫码完成支付' }}</div>

            <div v-if="qrStatus === 'pending'" class="pay-status pay-status--pending">⏳ 等待用户扫码支付...</div>
            <div v-if="qrStatus === 'paid'" class="pay-status pay-status--paid">✅ 支付成功！</div>
            <div v-if="qrStatus === 'failed'" class="pay-status pay-status--failed">❌ {{ qrError || '支付失败' }}</div>
          </div>
          <div class="pay-actions">
            <button class="pay-btn pay-btn--cancel" @click="closeQr" :disabled="polling">取消</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getToken } from '~/utils/token-cache'

const route = useRoute()
const router = useRouter()
const order = ref<any>(null)
const loading = ref(false)
const error = ref('')

// 支付弹窗状态
const showQr = ref(false)
const qrCode = ref('')
const qrBase64 = ref('')
const qrStatus = ref<'pending' | 'paid' | 'failed'>('pending')
const qrError = ref('')
const amount = ref(0)
const paymentType = ref('')
const rechargeOrderId = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

async function fetchOrder() {
  try {
    const token = getToken()
    const res = await fetch(`/api/mall/orders/${route.params.orderNo}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json()
    if (data?.success) order.value = data.data
  } catch (e) { console.error(e) }
}

async function doPay(method: string) {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/mall/orders/${route.params.orderNo}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method }),
    })
    const data = await res.json()
    if (!data.success) {
      error.value = data.error || '获取支付信息失败'
      loading.value = false
      return
    }

    amount.value = data.data.amount
    rechargeOrderId.value = data.data.rechargeOrderId || ''

    // 降级到收款码模式
    if (data.data.paymentType === 'qrcode_manual') {
      // 调 /api/member/create-payment 重试（可能密钥刚配置成功）
      try {
        const retryRes = await fetch('/api/member/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderId: rechargeOrderId.value, channel: method }),
        })
        const retryData = await retryRes.json()
        if (retryData.qrCode || retryData.codeUrl) {
          showQr.value = true
          qrCode.value = retryData.qrCode || retryData.codeUrl
          paymentType.value = retryData.paymentType || ''
          qrStatus.value = 'pending'
          loading.value = false
          startPolling()
          return
        }
      } catch { /* 降级继续 */ }

      // 真·收款码模式
      showQr.value = false
      if (data.data.qrCodeUrl) {
        qrCode.value = data.data.qrCodeUrl
        paymentType.value = 'qrcode_manual'
        showQr.value = true
      }
      qrStatus.value = 'pending'
      loading.value = false
      return
    }

    // 密钥模式：显示二维码
    showQr.value = true

    if (data.data.qrCode) {
      // 支付宝当面付：二维码字符串
      qrCode.value = data.data.qrCode
      paymentType.value = data.data.paymentType || 'alipay_qr'
    } else if (data.data.codeUrl) {
      // 微信 NATIVE：二维码链接
      qrCode.value = data.data.codeUrl
      paymentType.value = data.data.paymentType || 'wxpay_qr'
    } else if (data.data.payUrl) {
      // 支付宝电脑网站支付：把链接转成二维码
      try {
        const QRCode = (await import('qrcode')).default
        qrCode.value = data.data.payUrl
        const qrDataUrl = await QRCode.toDataURL(data.data.payUrl, { width: 280, margin: 2 })
        qrBase64.value = qrDataUrl
        paymentType.value = 'alipay_page'
      } catch {
        // fallback: 跳转支付
        window.location.href = data.data.payUrl
        loading.value = false
        return
      }
    }

    qrStatus.value = 'pending'
    loading.value = false
    startPolling()
  } catch (e: any) {
    error.value = e?.data?.error || '请求失败'
    loading.value = false
  }
}

function startPolling() {
  stopPoll()
  pollTimer = setInterval(async () => {
    try {
      const token = getToken()
      const url = rechargeOrderId.value
        ? `/api/mall/orders/${route.params.orderNo}/pay-status?rechargeOrderId=${rechargeOrderId.value}`
        : `/api/mall/orders/${route.params.orderNo}/pay-status`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success && data.data?.status === 'paid') {
        qrStatus.value = 'paid'
        stopPoll()
        setTimeout(() => {
          showQr.value = false
          router.push('/mall/orders')
        }, 1500)
      }
    } catch { /* 忽略 */ }
  }, 3000)
}

function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function closeQr() {
  stopPoll()
  showQr.value = false
}

onMounted(fetchOrder)
onUnmounted(stopPoll)
</script>

<style scoped>
/* === 支付弹窗样式（和 VIP 会员中心完全一致） === */
.pay-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}
.pay-dialog {
  background: #131a2e;
  border: 1px solid #1e2a45;
  border-radius: 1rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.pay-dialog--qr { text-align: center; }
.pay-title { font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
.pay-body { padding: 0.5rem 0; }
.pay-plan-name { font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-bottom: 0.25rem; }
.pay-amount { font-size: 1.75rem; font-weight: 800; color: #f87171; margin-bottom: 1rem; }
.pay-alipay-qr-area { display: flex; justify-content: center; margin-bottom: 0.75rem; }
.pay-alipay-qr-wrapper { border-radius: 0.75rem; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.pay-alipay-qr-img { width: 220px; height: 220px; display: block; }
.pay-alipay-loading { width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 0.8rem; background: #0b1020; border-radius: 0.75rem; }
.pay-tip { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin-bottom: 0.5rem; }
.pay-status { font-size: 0.8rem; padding: 0.4rem 0.75rem; border-radius: 999px; display: inline-block; margin-bottom: 0.5rem; }
.pay-status--pending { background: rgba(250,204,21,0.1); color: #facc15; }
.pay-status--paid { background: rgba(74,222,128,0.1); color: #4ade80; }
.pay-status--failed { background: rgba(248,113,113,0.1); color: #f87171; }
.pay-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.pay-btn { flex: 1; padding: 0.6rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s; }
.pay-btn--cancel { background: #1a243e; color: rgba(255,255,255,0.5); }
.pay-btn--cancel:hover { background: #24304f; }
.pay-btn--confirm { background: #4f46e5; color: #fff; }
.pay-btn--confirm:hover { background: #6366f1; }
.pay-btn--confirm:disabled { background: #374151; cursor: not-allowed; }

/* 过渡动画 */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
