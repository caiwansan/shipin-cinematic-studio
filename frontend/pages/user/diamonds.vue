<template>
  <div class="diamonds-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/user/center')">← 会员中心</button>
      <h1>我的钻石</h1>
      <p class="page-sub">充值钻石 · 收益钻石 · 消费流水</p>
    </div>

    <div class="page-body">
      <!-- 钻石总览卡 -->
      <div class="diamond-hero">
        <div class="diamond-hero-icon">💎</div>
        <div class="diamond-hero-info">
          <div class="diamond-hero-label">我的钻石</div>
          <div class="diamond-hero-value">{{ diamonds.totalDiamonds || 0 }}</div>
      <div class="diamond-hero-legend">
            <span class="legend-item"><i class="legend-dot legend-dot--recharge" />充值钻石 {{ diamonds.rechargeDiamonds || 0 }}</span>
            <span class="legend-item"><i class="legend-dot legend-dot--earn" />礼物收益 → <router-link to="/user/gold-coins" class="legend-link">我的礼物</router-link></span>
          </div>
        </div>
      </div>

      <div class="diamond-tip">
        💡 钻石仅可充值消费（购买礼物打赏茶客），不可提现、不可兑换余额；收礼方按礼物钻石价值的 <b>65%</b> 自动获得金币（即时到账），金币可 <b>10:1</b> 兑换余额（最低 200 金币起兑）。
      </div>

      <!-- 充值钻石卡 -->
      <div class="recharge-section">
        <h2 class="section-title">⚡ 充值钻石</h2>
        <p class="section-sub">1 元 = {{ diamondPerYuan }} 钻石 · 微信 / 支付宝扫码支付</p>

        <!-- 金额档位 -->
        <div class="amount-grid">
          <button v-for="opt in rechargeOptions" :key="opt.amount"
            @click="selectedAmount = opt.amount; currentOrder = null; payMsg = ''"
            :class="['amount-card', selectedAmount === opt.amount ? 'amount-card--active' : '']">
            <span class="amount-card-price">¥{{ opt.amount }}</span>
            <span class="amount-card-coins">+{{ (opt.amount * diamondPerYuan).toLocaleString() }} 钻</span>
            <span v-if="opt.popular" class="amount-card-badge">推荐</span>
          </button>
        </div>

        <!-- 支付方式 -->
        <div class="pay-methods">
          <p class="pay-methods-label">选择支付方式</p>
          <div class="pay-methods-row">
            <!-- PAYMENT-BALANCE-FIRST-01 余额优先：余额足够时可直接余额支付 -->
            <button v-if="walletBalance > 0"
              @click="selectedMethod = 'wallet'; currentOrder = null; payMsg = ''"
              :class="['pay-method-btn', selectedMethod === 'wallet' ? 'pay-method-btn--active' : '']">
              <span class="pay-method-icon">💰</span>
              余额支付（¥{{ walletBalance.toFixed(2) }}）
            </button>
            <button v-for="pm in payMethods" :key="pm.method"
              @click="selectedMethod = pm.method; currentOrder = null; payMsg = ''"
              :class="['pay-method-btn', selectedMethod === pm.method ? 'pay-method-btn--active' : '']">
              <span class="pay-method-icon">{{ pm.method === 'wechat' ? '💚' : '💙' }}</span>
              {{ pm.name }}
            </button>
            <div v-if="!payMethods.length && walletBalance <= 0" class="pay-methods-empty">暂无可用的支付方式，请联系管理员配置</div>
          </div>
        </div>

        <!-- 充值按钮 -->
        <button class="recharge-btn" :disabled="submitting" @click="createRecharge">
          {{ submitting ? '创建订单中...' : (selectedMethod === 'wallet' ? `余额支付 · ¥${selectedAmount}` : `扫码支付 · ¥${selectedAmount}`) }}
        </button>

        <div v-if="payMsg" class="pay-msg" :class="payMsgOk ? 'pay-msg--ok' : 'pay-msg--err'">{{ payMsg }}</div>

        <!-- 收款码模式：展示收款信息 -->
        <div v-if="currentOrder && currentOrder.qrCodeUrl" class="collect-box">
          <img :src="currentOrder.qrCodeUrl" class="collect-qr" />
          <p class="collect-account">🏦 收款账号：<span class="mono">{{ currentOrder.account || '请联系管理员获取' }}</span></p>
          <p v-if="currentOrder.payeeName" class="collect-name">收款人：{{ currentOrder.payeeName }}</p>
          <p class="collect-hint">扫码或转账后请联系管理员确认到账</p>
        </div>
      </div>

      <!-- 钻石流水 -->
      <div class="logs-section">
        <h2 class="section-title">💎 钻石流水</h2>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!logs.length" class="empty">暂无流水记录</div>
        <div v-else class="logs-list">
          <div v-for="log in logs" :key="log.id" class="log-row">
            <div class="log-info">
              <div class="log-remark">{{ log.remark || log.type }}</div>
              <div class="log-time">{{ formatTime(log.createdAt) }}</div>
            </div>
            <div class="log-amount" :class="log.amount > 0 ? 'log-amount--plus' : 'log-amount--minus'">
              {{ log.amount > 0 ? '+' : '' }}{{ log.amount }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 支付二维码弹窗（密钥模式 native 支付） -->
    <teleport to="body">
      <div v-if="showPayModal" class="pay-modal-mask" @click.self="closePayModal">
        <div class="pay-modal">
          <button class="pay-modal-close" @click="closePayModal">✕</button>
          <div class="pay-modal-title">💳 扫码支付</div>
          <p class="pay-modal-sub">
            {{ methodText(selectedMethod) }} · ¥{{ currentOrder?.amount }} · {{ currentOrder?.coins }} 钻石
          </p>
          <p class="pay-modal-order">订单号：<span class="mono">{{ currentOrder?.orderNo }}</span></p>

          <div v-if="qrBase64" class="pay-modal-qr-wrap">
            <img :src="qrBase64" class="pay-modal-qr" />
          </div>
          <div v-else class="pay-modal-qr-wrap">
            <div class="pay-modal-qr-loading">
              <span class="spinner"></span>
              <p>正在生成支付二维码...</p>
            </div>
          </div>

          <p class="pay-modal-hint">请使用{{ methodText(selectedMethod) }}扫码支付</p>

          <div v-if="paySuccess" class="pay-modal-success">
            ✅ 支付成功！钻石已到账
          </div>
          <div v-else-if="payTimeout" class="pay-modal-timeout">
            ⏱ 支付超时，请关闭后重新下单
          </div>
          <div v-else class="pay-modal-waiting">
            <span class="waiting-dot" />等待支付确认中...
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const token = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }

const diamonds = ref<any>({ totalDiamonds: 0, rechargeDiamonds: 0, earnDiamonds: 0 })
const logs = ref<any[]>([])
const loading = ref(true)
const diamondPerYuan = ref(10) // 1 元 = N 钻（后台 SystemConfig 可配，默认 1:10）

// 充值状态
const rechargeOptions = [
  { amount: 10, popular: false },
  { amount: 30, popular: true },
  { amount: 50, popular: false },
  { amount: 100, popular: false },
  { amount: 200, popular: false },
  { amount: 500, popular: false },
]
const payMethods = ref<any[]>([])
const selectedMethod = ref('')
const selectedAmount = ref(30)
const submitting = ref(false)
const currentOrder = ref<any>(null)
const payMsg = ref('')
const payMsgOk = ref(false)
// PAYMENT-BALANCE-FIRST-01 余额优先支付
const walletBalance = ref(0)

// 支付弹窗
const showPayModal = ref(false)
const qrBase64 = ref('')
const paySuccess = ref(false)
const payTimeout = ref(false)
let pollTimer: any = null
let pollCount = 0

function formatTime(t: string) {
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return t || '' }
}

const methodText = (m: string) => m === 'wechat' ? '微信' : m === 'wallet' ? '余额' : '支付宝'

// PAYMENT-BALANCE-FIRST-01：加载账户余额（余额支付选项数据源）
async function loadWalletBalance() {
  try {
    const res = await fetch('/api/wallet', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const data = await res.json()
      walletBalance.value = data.data?.balance || 0
    }
  } catch { /* ignore */ }
}

async function loadDiamonds() {
  try {
    const res = await fetch('/api/user/diamonds', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const data = await res.json()
      diamonds.value = data.data || {}
      logs.value = diamonds.value.logs || []
      if (diamonds.value.diamondPerYuan) diamondPerYuan.value = diamonds.value.diamondPerYuan
    }
  } catch (e) {
    console.warn('[Diamonds] failed', e)
  } finally {
    loading.value = false
  }
}

async function loadPayMethods() {
  try {
    const res = await fetch('/api/payment/methods')
    if (res.ok) {
      const data = await res.json()
      payMethods.value = data
      if (data.length > 0) selectedMethod.value = data[0].method
    }
  } catch (e) {
    console.warn('[Diamonds] loadPayMethods failed', e)
  }
}

async function createRecharge() {
  if (!selectedMethod.value) {
    payMsg.value = '请选择支付方式'
    payMsgOk.value = false
    return
  }
  payMsg.value = ''
  currentOrder.value = null
  submitting.value = true
  try {
    const res = await fetch('/api/payment/recharge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ amount: selectedAmount.value, method: selectedMethod.value }),
    })
    const data = await res.json()
    if (res.ok && data.data) {
      currentOrder.value = data.data
      // PAYMENT-BALANCE-FIRST-01：余额直接支付成功（无需扫码）
      if (data.data.status === 'paid' && data.data.paidByBalance) {
        payMsg.value = `✅ 余额支付成功，${data.data.coins} 钻石已到账`
        payMsgOk.value = true
        loadDiamonds()
        loadWalletBalance()
        return
      }
      // 密钥模式 native 支付 → 弹窗扫码 + 轮询
      const native = data.data.codeUrl || data.data.qrCode || data.data.paymentUrl
      if (native) {
        await openPayModal(native)
      } else if (data.data.qrCodeUrl) {
        // 收款码模式 → 页面内展示收款信息
        payMsg.value = '请扫码或转账后联系管理员确认到账'
        payMsgOk.value = true
      } else {
        payMsg.value = '订单已创建，请联系管理员确认到账'
        payMsgOk.value = true
      }
    } else {
      payMsg.value = data.error || '创建订单失败'
      payMsgOk.value = false
    }
  } catch (e: any) {
    payMsg.value = '网络错误，请重试'
    payMsgOk.value = false
  } finally {
    submitting.value = false
  }
}

async function openPayModal(nativeUrl: string) {
  paySuccess.value = false
  payTimeout.value = false
  qrBase64.value = ''
  showPayModal.value = true
  // 生成二维码图片
  try {
    const QRCode = (await import('qrcode')).default
    qrBase64.value = await QRCode.toDataURL(nativeUrl, { width: 260, margin: 2 })
  } catch {
    qrBase64.value = ''
  }
  // 轮询订单状态
  startPolling(currentOrder.value.orderId)
}

function startPolling(orderId: string) {
  stopPolling()
  pollCount = 0
  pollTimer = setInterval(async () => {
    if (pollCount >= 120) { // 最多 10 分钟（5s 一次）
      stopPolling()
      payTimeout.value = true
      return
    }
    pollCount++
    try {
      const res = await fetch(`/api/payment/wxpay/status/${orderId}`)
      const data = await res.json()
      if (data.status === 'paid') {
        stopPolling()
        paySuccess.value = true
        setTimeout(() => {
          closePayModal()
          loadDiamonds()
        }, 1200)
      }
    } catch (e) {
      console.warn('[Diamonds] poll failed', e)
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function closePayModal() {
  stopPolling()
  showPayModal.value = false
}

onMounted(() => {
  loadDiamonds()
  loadPayMethods()
  loadWalletBalance()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.diamonds-page {
  min-height: 100vh;
  background: #0B1320;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  padding: 24px;
  box-sizing: border-box;
}
.page-header { max-width: 720px; margin: 0 auto 24px; }
.back-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
  padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; margin-bottom: 16px;
}
.back-btn:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
.page-header h1 { font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0 0 6px; }
.page-sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0; }
.page-body { max-width: 720px; margin: 0 auto; }

.diamond-hero {
  display: flex; align-items: center; gap: 20px;
  padding: 28px;
  background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12));
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 16px;
  margin-bottom: 16px;
}
.diamond-hero-icon { font-size: 3rem; }
.diamond-hero-info { flex: 1; }
.diamond-hero-label { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
.diamond-hero-value { font-size: 2.4rem; font-weight: 800; color: #fff; margin-bottom: 8px; }
.diamond-hero-legend { display: flex; gap: 16px; flex-wrap: wrap; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.legend-dot--recharge { background: #60a5fa; }
.legend-dot--earn { background: #34d399; }

.diamond-tip {
  background: rgba(250,204,21,0.06); border: 1px solid rgba(250,204,21,0.15);
  border-radius: 10px; padding: 10px 14px; font-size: 0.75rem; color: rgba(255,255,255,0.5);
  margin-bottom: 20px; line-height: 1.6;
}

/* 充值区 */
.recharge-section {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 22px; margin-bottom: 20px;
}
.section-title { font-size: 1.05rem; font-weight: 700; color: #fff; margin: 0 0 4px; }
.section-sub { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin: 0 0 16px; }

.amount-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
.amount-card {
  position: relative; padding: 14px 8px; border-radius: 12px; cursor: pointer;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  transition: all .2s; text-align: center;
}
.amount-card:hover { border-color: rgba(255,255,255,0.25); }
.amount-card--active {
  background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15));
  border-color: rgba(99,102,241,0.5);
}
.amount-card-price { display: block; font-size: 1.15rem; font-weight: 800; color: #fff; }
.amount-card-coins { display: block; font-size: 0.7rem; color: rgba(255,255,255,0.4); margin-top: 3px; }
.amount-card-badge {
  position: absolute; top: -7px; right: -4px; padding: 2px 8px; border-radius: 999px;
  background: linear-gradient(90deg, #f59e0b, #ef4444); color: #fff; font-size: 0.62rem; font-weight: 700;
}

.pay-methods { margin-bottom: 18px; }
.pay-methods-label { font-size: 0.78rem; color: rgba(255,255,255,0.45); margin: 0 0 10px; }
.pay-methods-row { display: flex; gap: 10px; }
.pay-method-btn {
  flex: 1; padding: 12px; border-radius: 10px; cursor: pointer; text-align: center;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 0.85rem; transition: all .2s;
}
.pay-method-btn:hover { border-color: rgba(255,255,255,0.25); }
.pay-method-btn--active {
  background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.45); color: #34d399;
}
.pay-method-icon { margin-right: 6px; }
.pay-methods-empty { font-size: 0.75rem; color: rgba(255,255,255,0.3); padding: 8px 0; }

.recharge-btn {
  width: 100%; padding: 14px; border: none; border-radius: 12px; cursor: pointer;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  color: #fff; font-size: 0.95rem; font-weight: 700; letter-spacing: 1px;
  transition: all .2s;
}
.recharge-btn:hover:not(:disabled) { filter: brightness(1.15); }
.recharge-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.pay-msg { margin-top: 12px; padding: 10px 14px; border-radius: 10px; font-size: 0.8rem; text-align: center; }
.pay-msg--ok { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); color: #34d399; }
.pay-msg--err { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #f87171; }

.collect-box { margin-top: 14px; padding: 16px; border-radius: 12px; text-align: center; background: rgba(255,255,255,0.03); border: 1px dashed rgba(250,204,21,0.3); }
.collect-qr { width: 200px; height: 200px; border-radius: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1); }
.collect-account { font-size: 0.82rem; color: rgba(255,255,255,0.75); margin: 6px 0 2px; }
.collect-name { font-size: 0.75rem; color: rgba(255,255,255,0.45); margin: 2px 0; }
.collect-hint { font-size: 0.72rem; color: rgba(250,204,21,0.6); margin: 8px 0 0; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* 流水 */
.logs-section { margin-top: 24px; }
.empty { text-align: center; color: rgba(255,255,255,0.25); padding: 32px 0; font-size: 0.85rem; }
.logs-list { display: flex; flex-direction: column; gap: 8px; }
.log-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 12px 16px;
}
.log-remark { font-size: 0.85rem; color: rgba(255,255,255,0.75); }
.log-time { font-size: 0.7rem; color: rgba(255,255,255,0.3); margin-top: 4px; }
.log-amount { font-size: 1rem; font-weight: 700; flex-shrink: 0; }
.log-amount--plus { color: #34d399; }
.log-amount--minus { color: #f87171; }

/* 支付弹窗 */
.pay-modal-mask {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.pay-modal {
  position: relative; width: 360px; max-width: 92vw;
  background: #101826; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px;
  padding: 28px 24px 24px; text-align: center;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}
.pay-modal-close {
  position: absolute; top: 12px; right: 14px;
  background: transparent; border: none; color: rgba(255,255,255,0.4);
  font-size: 1rem; cursor: pointer;
}
.pay-modal-close:hover { color: #fff; }
.pay-modal-title { font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 6px; }
.pay-modal-sub { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin: 0 0 4px; }
.pay-modal-order { font-size: 0.7rem; color: rgba(255,255,255,0.3); margin: 0 0 16px; }
.pay-modal-qr-wrap {
  width: 260px; height: 260px; margin: 0 auto 14px;
  background: #fff; border-radius: 14px; padding: 12px; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
}
.pay-modal-qr { width: 100%; height: 100%; }
.pay-modal-qr-loading { text-align: center; color: #666; font-size: 0.8rem; }
.spinner {
  display: inline-block; width: 28px; height: 28px; margin-bottom: 10px;
  border: 3px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pay-modal-hint { font-size: 0.8rem; color: rgba(255,255,255,0.55); margin: 0 0 12px; }
.pay-modal-waiting { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.75rem; color: rgba(255,255,255,0.35); }
.waiting-dot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.pay-modal-success {
  margin-top: 4px; padding: 10px; border-radius: 10px; font-size: 0.9rem; font-weight: 600;
  background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #34d399;
}
.pay-modal-timeout {
  margin-top: 4px; padding: 10px; border-radius: 10px; font-size: 0.85rem;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #f87171;
}
</style>
