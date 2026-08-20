<template>
  <MPageShell title="我的礼物" @close="$emit('close')">
    <!-- 金币总览卡（对齐线上 my礼物 gold-coins） -->
    <div class="mgf-hero">
      <div class="mgf-hero-row">
        <div class="mgf-hero-icon">🪙</div>
        <div class="mgf-hero-info">
          <div class="mgf-hero-label">我的金币</div>
          <div class="mgf-hero-value">{{ data.goldCoins ?? 0 }}</div>
          <div class="mgf-hero-legend">
            <span>累计收礼 {{ data.giftStats?.receivedCount || 0 }} 次</span>
            <span class="mgf-legend-div">·</span>
            <span>礼物价值 {{ data.giftStats?.totalGiftDiamonds || 0 }} 钻</span>
          </div>
        </div>
        <button class="mgf-exch" :disabled="exchanging || (data.goldCoins || 0) < (data.exchangeMin || 200)" @click="doExchange">
          {{ exchanging ? '兑换中…' : `兑换余额 ¥${data.exchangeableYuan || 0}` }}
        </button>
      </div>
    </div>

    <div class="mgf-tip">
      💡 茶客用钻石购买的礼物打赏给您后，按礼物钻石价值的 <b>65%</b> 即时结算为金币。
      金币满 <b>{{ data.exchangeMin || 200 }}</b> 起兑，按 <b>{{ data.exchangeRate || 10 }}:1</b> 兑换成余额，余额可提现（提现手续费 5%）。
    </div>

    <!-- 金币流水 -->
    <div class="mgf-card">
      <div class="mgf-card-title">🪙 金币流水</div>
      <div v-if="loading" class="mgf-empty">加载中…</div>
      <div v-else-if="!logs.length" class="mgf-empty">暂无金币流水，去昆仑茶馆收礼物吧 🎁</div>
      <div v-else class="mgf-item" v-for="log in logs" :key="log.id">
        <div class="mgf-info">
          <div class="mgf-name">{{ log.remark || log.typeLabel }}</div>
          <div class="mgf-sub">{{ fmtTime(log.createdAt) }}</div>
        </div>
        <div class="mgf-award" :class="{ minus: (log.amount || 0) < 0 }">{{ log.amount > 0 ? '+' : '' }}{{ log.amount }}</div>
      </div>
    </div>

    <!-- 兑换成功 → 我的余额弹窗 -->
    <div v-if="balanceOpen" class="mgf-mask" @click.self="balanceOpen = false">
      <div class="mgf-balance-modal">
        <button class="mgf-balance-close" @click="balanceOpen = false">✕</button>
        <div class="mgf-balance-icon">💰</div>
        <div class="mgf-balance-title">兑换成功</div>
        <p class="mgf-balance-sub">{{ lastExchange.coins }} 金币 → <b>¥{{ lastExchange.yuan }}</b> 已到账余额</p>
        <div class="mgf-balance-card">
          <p class="mgf-balance-label">我的余额（可提现）</p>
          <p class="mgf-balance-value">¥{{ currentBalance.toFixed(2) }}</p>
          <p class="mgf-balance-hint">满 ¥100 可提现 · 提现手续费 5%</p>
        </div>
        <div class="mgf-balance-actions">
          <button class="mgf-balance-ghost" @click="balanceOpen = false">继续逛逛</button>
          <button class="mgf-balance-primary" @click="$emit('open','wallet'); close()">去提现 →</button>
        </div>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void; (e: 'open', page: string, props?: any): void }>()
const data = ref<any>({})
const logs = ref<any[]>([])
const loading = ref(true)
const exchanging = ref(false)
const balanceOpen = ref(false)
const currentBalance = ref(0)
const lastExchange = ref<any>({})

async function load() {
  try {
    const r = await mobileAuthFetch('/api/user/gold-coins')
    const j = await r.json()
    data.value = j.data || j
    logs.value = j.data?.logs || []
  } catch { /* ignore */ } finally { loading.value = false }
}
async function doExchange() {
  const coins = data.value.goldCoins || 0
  const rate = data.value.exchangeRate || 10
  const exchangeCoins = Math.floor(coins / rate) * rate
  if (exchangeCoins < (data.value.exchangeMin || 200)) return
  exchanging.value = true
  try {
    const r = await mobileAuthFetch('/api/user/gold-coins/exchange', { method: 'POST', body: JSON.stringify({ coins: exchangeCoins }) })
    const j = await r.json()
    if (j.success) { lastExchange.value = j.data; await load(); currentBalance.value = data.value.walletBalance || 0; balanceOpen.value = true }
    else alert(j.error || '兑换失败')
  } catch { alert('兑换失败，请稍后重试') }
  finally { exchanging.value = false }
}
function fmtTime(t: string) {
  if (!t) return ''
  const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
onMounted(load)
</script>

<style scoped>
.mgf-hero { background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 14px; padding: 20px 16px; color: #fff; }
.mgf-hero-row { display: flex; align-items: center; gap: 12px; }
.mgf-hero-icon { font-size: 34px; }
.mgf-hero-info { flex: 1; min-width: 0; }
.mgf-hero-label { font-size: 12px; opacity: .9; }
.mgf-hero-value { font-size: 32px; font-weight: 800; line-height: 1.15; }
.mgf-hero-legend { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; font-size: 11px; opacity: .95; }
.mgf-legend-div { opacity: .6; }
.mgf-exch { background: #fff; color: #b45309; border: none; border-radius: 999px; padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.mgf-exch:disabled { opacity: .55; }
.mgf-tip { margin: 12px 0; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 12px; color: #92400e; font-size: 12px; line-height: 1.7; }
.mgf-card { background: #fff; border-radius: 12px; padding: 14px; }
.mgf-card-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: #111827; }
.mgf-empty { text-align: center; color: #999; font-size: 13px; padding: 24px 0; }
.mgf-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
.mgf-item:last-child { border-bottom: none; }
.mgf-info { flex: 1; min-width: 0; }
.mgf-name { font-size: 13px; color: #111827; }
.mgf-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.mgf-award { font-size: 14px; font-weight: 700; color: #f59e0b; }
.mgf-award.minus { color: #ef4444; }
.mgf-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 99; padding: 20px; }
.mgf-balance-modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 340px; position: relative; text-align: center; }
.mgf-balance-close { position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 15px; color: #9ca3af; cursor: pointer; }
.mgf-balance-icon { font-size: 38px; margin: 6px 0 2px; }
.mgf-balance-title { font-size: 18px; font-weight: 700; color: #111827; }
.mgf-balance-sub { color: #6b7280; font-size: 13px; margin: 6px 0 14px; }
.mgf-balance-card { background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #fde68a; border-radius: 12px; padding: 14px; margin-bottom: 14px; }
.mgf-balance-label { margin: 0; font-size: 11px; color: #92400e; }
.mgf-balance-value { margin: 3px 0; font-size: 28px; font-weight: 800; color: #b45309; }
.mgf-balance-hint { margin: 0; font-size: 11px; color: #b45309; opacity: .85; }
.mgf-balance-actions { display: flex; gap: 10px; justify-content: center; }
.mgf-balance-ghost { background: #f3f4f6; border: none; border-radius: 9px; padding: 9px 16px; color: #374151; font-size: 13px; cursor: pointer; }
.mgf-balance-primary { background: #f59e0b; border: none; border-radius: 9px; padding: 9px 16px; color: #fff; font-size: 13px; cursor: pointer; }
</style>
