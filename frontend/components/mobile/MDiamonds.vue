<template>
  <MPageShell title="钻石充值" @close="$emit('close')">
    <div class="md-hero">
      <div class="md-num">{{ diamonds.totalDiamonds || 0 }}</div>
      <div class="md-label">我的钻石 💎</div>
      <div class="md-legend">
        <span>充值 {{ diamonds.rechargeDiamonds || 0 }}</span>
        <span>收益 {{ diamonds.earnDiamonds || 0 }}</span>
      </div>
    </div>

    <div class="md-card">
      <div class="md-card-title">💰 充值钻石（{{ diamondPerYuan }} 钻 = 1 元）</div>
      <div class="md-opts">
        <button v-for="o in rechargeOptions" :key="o.amount" class="md-opt" :class="{ on: selectedAmount === o.amount, pop: o.popular }" @click="selectedAmount = o.amount">
          <span class="md-opt-amt">{{ o.amount * diamondPerYuan }} 钻</span>
          <span class="md-opt-price">¥{{ o.amount }}</span>
          <span v-if="o.popular" class="md-opt-tag">热销</span>
        </button>
      </div>

      <!-- 支付方式：余额 / 微信 / 支付宝（H5 唤起，非扫码） -->
      <div class="md-payways">
        <button class="md-payway" :class="{ on: payMethod === 'wallet' }" @click="payMethod = 'wallet'">
          <span class="md-payway-ic">💎</span><span>余额</span>
        </button>
        <button class="md-payway" :class="{ on: payMethod === 'wechat' }" @click="payMethod = 'wechat'">
          <span class="md-payway-ic wx">💚</span><span>微信</span>
        </button>
        <button class="md-payway" :class="{ on: payMethod === 'alipay' }" @click="payMethod = 'alipay'">
          <span class="md-payway-ic alipay">🔵</span><span>支付宝</span>
        </button>
      </div>

      <button class="md-btn primary" :disabled="submitting" @click="createRecharge">{{ submitting ? '创建订单…' : payMethod === 'wallet' ? '立即充值' : payMethod === 'wechat' ? '💚 微信支付' : '🔵 支付宝支付' }}</button>
      <div v-if="payMsg" class="md-pay-msg" :class="{ ok: payMsgOk }">{{ payMsg }}</div>
    </div>

    <div class="md-card">
      <div class="md-card-title">📜 钻石明细</div>
      <div v-if="!logs.length" class="md-empty">暂无明细</div>
      <div v-for="l in logs" :key="l.id" class="md-item">
        <div class="md-item-main">
          <span class="md-item-title">{{ l.title || l.description || l.type || '钻石变动' }}</span>
          <span class="md-item-time">{{ (l.createdAt || '').slice(0, 10) }}</span>
        </div>
        <span class="md-item-delta" :class="{ plus: (l.delta ?? l.change ?? 0) >= 0 }">{{ (l.delta ?? l.change ?? 0) >= 0 ? '+' : '' }}{{ l.delta ?? l.change ?? 0 }}</span>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()

const diamonds = ref<any>({ totalDiamonds: 0, rechargeDiamonds: 0, earnDiamonds: 0 })
const logs = ref<any[]>([])
const diamondPerYuan = ref(10)
const rechargeOptions = [
  { amount: 10, popular: false },
  { amount: 30, popular: true },
  { amount: 50, popular: false },
  { amount: 100, popular: false },
  { amount: 200, popular: false },
  { amount: 500, popular: false },
]
const selectedAmount = ref(30)
const payMethod = ref<'wallet' | 'wechat' | 'alipay'>('wallet')
const submitting = ref(false)
const payMsg = ref('')
const payMsgOk = ref(false)

async function load() {
  try {
    const r = await mobileAuthFetch('/api/user/diamonds')
    const j = await r.json()
    const d = j.data || j
    diamonds.value = d
    if (d.diamondPerYuan) diamondPerYuan.value = Number(d.diamondPerYuan)
    logs.value = d.logs || d.transactions || []
  } catch { /* ignore */ }
}
onMounted(load)

async function createRecharge() {
  submitting.value = true
  payMsg.value = ''
  try {
    const r = await mobileAuthFetch('/api/payment/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount: selectedAmount.value, method: payMethod.value, payMode: 'h5' }),
    })
    const j = await r.json()
    if (r.ok && j.data) {
      const d = j.data
      if (d.status === 'paid' && d.paidByBalance) {
        payMsg.value = `✅ 余额支付成功，${d.coins || selectedAmount.value * diamondPerYuan.value} 钻石已到账`
        payMsgOk.value = true
        load()
        return
      }
      // 微信 H5 / 支付宝 WAP：手机浏览器唤起支付
      const payUrl = d.h5Url || d.paymentUrl
      if (payUrl) {
        // 记住订单，支付完成回手机版后轮询到账
        try {
          sessionStorage.setItem('pendingRecharge', JSON.stringify({ orderId: d.orderId, amount: d.amount, coins: d.coins, method: d.method }))
        } catch { /* ignore */ }
        payMsg.value = '正在唤起' + (d.method === 'wechat' ? '微信' : '支付宝') + '支付…'
        window.location.href = payUrl
        return
      }
      if (d.codeUrl || d.qrCode) {
        payMsg.value = '⚠ 请在桌面版完成扫码支付'
        payMsgOk.value = false
      } else {
        payMsg.value = '⚠ ' + (d.error || '支付链接生成失败（请确认支付已配置）')
        payMsgOk.value = false
      }
    } else {
      payMsg.value = '⚠ ' + (j.error || '充值失败')
      payMsgOk.value = false
    }
  } catch {
    payMsg.value = '⚠ 网络错误，请重试'
    payMsgOk.value = false
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.md-hero { background: linear-gradient(135deg, #4f7df9 0%, #7c4df9 100%); border-radius: 12px; padding: 22px 18px; color: #fff; text-align: center; }
.md-num { font-size: 36px; font-weight: 800; }
.md-label { font-size: 13px; opacity: .9; margin-top: 4px; }
.md-legend { display: flex; justify-content: center; gap: 16px; font-size: 12px; opacity: .8; margin-top: 8px; }
.md-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.md-card-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.md-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.md-opt { position: relative; padding: 12px 0; border: 1px solid #e5e5e5; border-radius: 10px; background: #fff; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.md-opt.on { border-color: #4f7df9; background: #eef3ff; }
.md-opt-amt { font-size: 15px; font-weight: 700; }
.md-opt-price { font-size: 12px; color: #888; }
.md-opt-tag { position: absolute; top: -8px; right: -4px; background: #ff4d4f; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 8px; }
.md-btn { width: 100%; margin-top: 12px; padding: 12px; border: none; border-radius: 10px; font-size: 15px; }
.md-btn.primary { background: #4f7df9; color: #fff; }
.md-btn:disabled { opacity: .5; }
.md-payways { display: flex; gap: 8px; margin-top: 12px; }
.md-payway { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 0; border: 1px solid #e5e5e5; border-radius: 10px; background: #fff; font-size: 13px; }
.md-payway.on { border-color: #4f7df9; background: #eef3ff; color: #4f7df9; }
.md-payway-ic { font-size: 15px; }
.md-payway-ic.wx { color: #07c160; }
.md-payway-ic.alipay { color: #1677ff; }
.md-pay-msg { margin-top: 10px; font-size: 13px; color: #e5484d; }
.md-pay-msg.ok { color: #22c55e; }
.md-empty { text-align: center; color: #999; font-size: 13px; padding: 16px 0; }
.md-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
.md-item:last-child { border-bottom: none; }
.md-item-main { display: flex; flex-direction: column; gap: 2px; }
.md-item-title { font-size: 13px; }
.md-item-time { color: #aaa; font-size: 12px; }
.md-item-delta { font-weight: 700; color: #999; }
.md-item-delta.plus { color: #22c55e; }
</style>
