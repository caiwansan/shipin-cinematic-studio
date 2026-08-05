<template>
  <div class="gold-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/user/center')">← 会员中心</button>
      <h1>礼物金币</h1>
      <p class="page-sub">收到礼物自动结算 · 10 金币 = 1 元余额</p>
    </div>

    <div class="page-body">
      <!-- 金币总览卡 -->
      <div class="gold-hero">
        <div class="gold-hero-icon">🪙</div>
        <div class="gold-hero-info">
          <div class="gold-hero-label">我的金币</div>
          <div class="gold-hero-value">{{ data.goldCoins ?? 0 }}</div>
          <div class="gold-hero-legend">
            <span class="legend-item"><i class="legend-dot legend-dot--gift" />累计收礼 {{ data.giftStats?.receivedCount || 0 }} 次</span>
            <span class="legend-item"><i class="legend-dot legend-dot--diamond" />礼物价值 {{ data.giftStats?.totalGiftDiamonds || 0 }} 钻</span>
          </div>
        </div>
        <button class="exchange-btn" :disabled="exchanging || data.goldCoins < data.exchangeMin" @click="doExchange">
          {{ exchanging ? '兑换中...' : `兑换余额 ¥${data.exchangeableYuan || 0}` }}
        </button>
      </div>

      <div class="gold-tip">
        💡 茶客用钻石购买的礼物打赏给您后，按礼物钻石价值的 <b>65%</b> 即时结算为金币。
        金币满 <b>{{ data.exchangeMin }} 起兑</b>，按 <b>10:1</b> 兑换成余额（{{ data.exchangeMin }} 金币 = {{ data.exchangeMin / data.exchangeRate }} 元），余额可提现（提现手续费 5%）。
      </div>

      <!-- 兑换规则卡 -->
      <div class="rule-section">
        <h2 class="section-title">📜 兑换规则</h2>
        <div class="rule-grid">
          <div class="rule-item"><span class="rule-key">兑换比例</span><span class="rule-val">10 金币 = 1 元</span></div>
          <div class="rule-item"><span class="rule-key">最低起兑</span><span class="rule-val">{{ data.exchangeMin }} 金币（{{ data.exchangeMin / data.exchangeRate }} 元）</span></div>
          <div class="rule-item"><span class="rule-key">兑换方式</span><span class="rule-val">自动兑换全部可兑金额</span></div>
          <div class="rule-item"><span class="rule-key">余额提现</span><span class="rule-val">手续费 5% · 满 ¥100 可提</span></div>
        </div>
      </div>

      <!-- 金币流水 -->
      <div class="logs-section">
        <h2 class="section-title">🪙 金币流水</h2>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!data.logs || !data.logs.length" class="empty">暂无金币流水，去昆仑茶馆收礼物吧 🎁</div>
        <div v-else class="logs-list">
          <div v-for="log in data.logs" :key="log.id" class="log-row">
            <div class="log-info">
              <div class="log-remark">{{ log.remark || log.typeLabel }}</div>
              <div class="log-time">{{ formatTime(log.createdAt) }}</div>
            </div>
            <div class="log-amount" :class="log.amount > 0 ? 'log-amount--plus' : 'log-amount--minus'">
              {{ log.amount > 0 ? '+' : '' }}{{ log.amount }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 兑换成功弹窗 -->
    <div v-if="showSuccess" class="pay-modal-mask" @click.self="showSuccess = false">
      <div class="pay-modal success-modal">
        <button class="pay-modal-close" @click="showSuccess = false">✕</button>
        <div class="success-icon">✅</div>
        <div class="success-title">兑换成功</div>
        <p class="success-sub">{{ lastExchange.coins }} 金币 → <b>¥{{ lastExchange.yuan }}</b> 已到账余额钱包</p>
        <div class="success-actions">
          <button class="btn-ghost" @click="showSuccess = false">继续逛逛</button>
          <router-link to="/user/wallet" class="btn-primary">去余额钱包 →</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const data = ref<any>({})
const loading = ref(true)
const exchanging = ref(false)
const showSuccess = ref(false)
const lastExchange = ref<any>({})
const token = () => {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function load() {
  try {
    const r = await fetch('/api/user/gold-coins', { headers: { Authorization: 'Bearer ' + token() } })
    const j = await r.json()
    data.value = j.data || j
  } catch (e) {
    console.error('金币钱包加载失败', e)
  } finally {
    loading.value = false
  }
}

async function doExchange() {
  const coins = data.value.goldCoins || 0
  // 取 10 的倍数（可兑换的整数元）
  const exchangeCoins = Math.floor(coins / data.value.exchangeRate) * data.value.exchangeRate
  if (exchangeCoins < data.value.exchangeMin) return
  exchanging.value = true
  try {
    const r = await fetch('/api/user/gold-coins/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ coins: exchangeCoins }),
    })
    const j = await r.json()
    if (j.success) {
      lastExchange.value = j.data
      showSuccess.value = true
      await load()
    } else {
      alert(j.error || '兑换失败')
    }
  } catch (e) {
    alert('兑换失败，请稍后重试')
  } finally {
    exchanging.value = false
  }
}

function formatTime(t: string) {
  if (!t) return ''
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(load)
</script>

<style scoped>
.gold-page { max-width: 860px; margin: 0 auto; padding: 24px 16px 60px; }
.page-header { margin-bottom: 20px; }
.back-btn { background: none; border: none; color: #6b7280; cursor: pointer; padding: 0; margin-bottom: 8px; font-size: 14px; }
.page-header h1 { margin: 0; font-size: 26px; color: #111827; }
.page-sub { margin: 4px 0 0; color: #6b7280; font-size: 14px; }

.gold-hero { display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 16px; padding: 24px; color: #fff; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25); }
.gold-hero-icon { font-size: 44px; }
.gold-hero-info { flex: 1; }
.gold-hero-label { font-size: 13px; opacity: 0.9; }
.gold-hero-value { font-size: 38px; font-weight: 800; line-height: 1.1; }
.gold-hero-legend { display: flex; gap: 16px; margin-top: 6px; font-size: 12px; opacity: 0.95; }
.legend-item { display: inline-flex; align-items: center; gap: 4px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.legend-dot--gift { background: #fff; }
.legend-dot--diamond { background: rgba(255,255,255,0.6); }
.exchange-btn { background: #fff; color: #b45309; border: none; border-radius: 999px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.exchange-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.gold-tip { margin: 16px 0; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 14px; color: #92400e; font-size: 13px; line-height: 1.7; }
.rule-section { background: #fff; border: 1px solid #f3f4f6; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; }
.section-title { font-size: 16px; margin: 0 0 14px; color: #111827; }
.rule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rule-item { display: flex; justify-content: space-between; background: #f9fafb; border-radius: 10px; padding: 10px 12px; font-size: 13px; }
.rule-key { color: #6b7280; }
.rule-val { color: #111827; font-weight: 600; }

.logs-section { background: #fff; border: 1px solid #f3f4f6; border-radius: 14px; padding: 18px 20px; }
.logs-list { display: flex; flex-direction: column; }
.log-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f9fafb; }
.log-row:last-child { border-bottom: none; }
.log-remark { font-size: 14px; color: #111827; }
.log-time { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.log-amount { font-size: 15px; font-weight: 700; }
.log-amount--plus { color: #f59e0b; }
.log-amount--minus { color: #ef4444; }
.empty { text-align: center; color: #9ca3af; padding: 32px 0; font-size: 14px; }

.pay-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.pay-modal { background: #fff; border-radius: 16px; padding: 28px; width: 360px; position: relative; text-align: center; }
.pay-modal-close { position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 16px; color: #9ca3af; cursor: pointer; }
.success-icon { font-size: 44px; margin: 8px 0 4px; }
.success-title { font-size: 20px; font-weight: 700; color: #111827; }
.success-sub { color: #6b7280; font-size: 14px; margin: 8px 0 18px; }
.success-actions { display: flex; gap: 10px; justify-content: center; }
.btn-ghost { background: #f3f4f6; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; color: #374151; font-size: 14px; text-decoration: none; }
.btn-primary { background: #f59e0b; border: none; border-radius: 10px; padding: 10px 18px; cursor: pointer; color: #fff; font-size: 14px; text-decoration: none; }
</style>
