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

    <div class="md-tip">
      💡 钻石仅可充值消费（购买礼物打赏茶客），不可提现。收礼方按礼物钻石价值 <b>65%</b> 自动获得金币。
    </div>

    <!-- 充值：跳转线上版（与线上支付方式一致） -->
    <div class="md-card">
      <div class="md-card-title">⚡ 充值钻石（1 元 = {{ diamondPerYuan }} 钻石）</div>
      <div class="md-opts">
        <button v-for="o in rechargeOptions" :key="o.amount" class="md-opt" :class="{ pop: o.popular }">
          <span class="md-opt-amt">{{ o.amount * diamondPerYuan }} 钻</span>
          <span class="md-opt-price">¥{{ o.amount }}</span>
          <span v-if="o.popular" class="md-opt-tag">推荐</span>
        </button>
      </div>
      <button class="md-btn primary" @click="goRecharge">💎 前往线上充值</button>
      <p class="md-pay-hint">跳转到线上网页版完成支付（支持余额 / 微信 / 支付宝，与线上支付方式一致）</p>
    </div>

    <div class="md-card">
      <div class="md-card-title">📒 钻石明细</div>
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
// 线上充值页地址（与线上网页版一致）
const onlineDiamondsUrl = () => {
  const base = window.location.origin || 'https://aigc.fushtn.com'
  return `${base}/user/diamonds`
}
function goRecharge() {
  // 跳转线上版充值页（保留登录态，线上支付体系）
  const t = (() => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } })()
  const url = onlineDiamondsUrl()
  if (t) {
    // 尝试带 token 直开新页；若同源，直接跳转
    window.open(url, '_blank')
  } else {
    window.location.href = url
  }
}

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
</script>

<style scoped>
.md-hero { background: linear-gradient(135deg, #38bdf8, #6366f1); border-radius: 14px; padding: 22px 18px; color: #fff; text-align: center; }
.md-num { font-size: 36px; font-weight: 800; }
.md-label { font-size: 13px; opacity: .9; margin-top: 4px; }
.md-legend { display: flex; justify-content: center; gap: 18px; margin-top: 10px; font-size: 12px; opacity: .95; }
.md-tip { margin: 12px 0; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 12px; color: #1d4ed8; font-size: 12px; line-height: 1.7; }
.md-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.md-card-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #111827; }
.md-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.md-opt { position: relative; padding: 12px 0; border: 1px solid #e5e5e5; border-radius: 8px; background: #fff; }
.md-opt.pop { border-color: #6366f1; background: #eef2ff; }
.md-opt-amt { display: block; font-size: 15px; font-weight: 700; }
.md-opt-price { display: block; font-size: 12px; color: #666; margin-top: 2px; }
.md-opt-tag { position: absolute; top: -6px; right: 6px; background: #f59e0b; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 8px; }
.md-btn { width: 100%; margin-top: 12px; padding: 12px; border: none; border-radius: 10px; background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; font-size: 15px; font-weight: 700; }
.md-pay-hint { text-align: center; color: #999; font-size: 12px; margin-top: 8px; }
.md-empty { text-align: center; color: #999; font-size: 13px; padding: 20px 0; }
.md-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f4; font-size: 13px; }
.md-item:last-child { border-bottom: none; }
.md-item-main { display: flex; flex-direction: column; gap: 2px; }
.md-item-title { font-size: 13px; color: #111827; }
.md-item-time { font-size: 11px; color: #9ca3af; }
.md-item-delta { font-weight: 700; color: #ef4444; }
.md-item-delta.plus { color: #6366f1; }
</style>
