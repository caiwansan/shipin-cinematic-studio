<template>
  <MPageShell title="余额" @close="$emit('close')">
    <div class="mb-balance-card">
      <div class="mb-balance-label">收益余额（元）</div>
      <div class="mb-balance-num">¥{{ balance }}</div>
    </div>

    <div class="mb-card">
      <div class="mb-card-title">💰 充值</div>
      <div class="mb-recharge-opts">
        <button v-for="o in opts" :key="o" class="mb-opt" :class="{ on: o === amount }" @click="amount = o">¥{{ o }}</button>
      </div>
      <button class="mb-btn primary" :disabled="recharging" @click="recharge">
        {{ recharging ? '创建订单…' : '充值' }}
      </button>
      <div v-if="payMsg" class="mb-pay-msg" :class="{ ok: payMsgOk }">{{ payMsg }}</div>
    </div>

    <div class="mb-card">
      <div class="mb-card-title">🏦 提现（满 100 元起，手续费 5%）</div>
      <input v-model.number="withdrawAmount" type="number" min="100" :max="Number(balance)" class="mb-input" placeholder="输入提现金额" />
      <p v-if="withdrawAmount >= 100" class="mb-hint">手续费 ¥{{ (withdrawAmount * 0.05).toFixed(2) }}，实际到账 ¥{{ (withdrawAmount * 0.95).toFixed(2) }}</p>
      <button class="mb-btn" :disabled="withdrawing || !withdrawAmount || withdrawAmount < 100" @click="doWithdraw">
        {{ withdrawing ? '提交中…' : '提交提现申请' }}
      </button>
    </div>

    <div class="mb-card">
      <div class="mb-card-title">📋 提现记录</div>
      <div v-if="!withdraws.length" class="mb-empty">暂无提现记录</div>
      <div v-for="w in withdraws" :key="w.id" class="mb-item">
        <div class="mb-item-main">
          <span class="mb-item-amt">-¥{{ Number(w.amount).toFixed(2) }}</span>
          <span class="mb-item-sub">{{ statusLabel(w.status) }}</span>
        </div>
        <span class="mb-item-time">{{ (w.createdAt || '').slice(0, 10) }}</span>
      </div>
    </div>

    <div class="mb-card">
      <div class="mb-card-title">💳 提现账号</div>
      <div v-if="!acct" class="mb-empty">未绑定提现账号</div>
      <div v-else class="mb-item">
        <div class="mb-item-main"><span class="mb-item-amt">{{ acct.accountName }}</span><span class="mb-item-sub">{{ acct.accountNo || '' }}</span></div>
        <button class="mb-mini-btn" @click="unbind">解绑</button>
      </div>
      <input v-model="bindName" class="mb-input" placeholder="持卡人/收款人姓名" />
      <input v-model="bindNo" class="mb-input" placeholder="卡号/账号" />
      <button class="mb-btn" :disabled="binding || !bindName || !bindNo" @click="bindAcct">{{ binding ? '绑定中…' : '绑定账号' }}</button>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast, fmtMoney } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()

const balance = ref('0')
const opts = [50, 100, 200, 500, 1000]
const amount = ref(100)
const recharging = ref(false)
const payMsg = ref('')
const payMsgOk = ref(false)
const withdraws = ref<any[]>([])
const withdrawAmount = ref<number | null>(null)
const withdrawing = ref(false)
const acct = ref<any>(null)
const bindName = ref('')
const bindNo = ref('')
const binding = ref(false)

async function load() {
  try {
    const r = await mobileAuthFetch('/api/wallet')
    const j = await r.json()
    balance.value = fmtMoney(j.walletBalance ?? j.data?.walletBalance ?? j.balance ?? 0)
    withdraws.value = j.withdraws || j.data?.withdraws || []
  } catch { /* ignore */ }
  try {
    const r = await mobileAuthFetch('/api/wallet/account')
    const j = await r.json()
    acct.value = j.data?.account || j.account || null
  } catch { /* ignore */ }
}
onMounted(load)

function statusLabel(s?: string) {
  const map: Record<string, string> = { pending: '待审核', paid: '已打款', rejected: '已驳回', active: '绑定中' }
  return map[s || ''] || s || ''
}

async function recharge() {
  recharging.value = true
  payMsg.value = ''
  try {
    const r = await mobileAuthFetch('/api/payment/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount: amount.value, method: 'balance' }),
    })
    const j = await r.json()
    if (r.ok && j.data) {
      if (j.data.status === 'paid' && j.data.paidByBalance) {
        payMsg.value = `✅ 余额支付成功，${j.data.coins || ''} 已到账`
        payMsgOk.value = true
        load()
      } else if (j.data.codeUrl || j.data.qrCode) {
        payMsg.value = '⚠ 请在桌面版完成扫码支付'
        payMsgOk.value = false
      } else {
        payMsg.value = '订单已创建，请联系管理员确认到账'
        payMsgOk.value = true
      }
    } else {
      payMsg.value = '⚠ ' + (j.error || '充值失败')
      payMsgOk.value = false
    }
  } catch {
    payMsg.value = '⚠ 网络错误，请重试'
    payMsgOk.value = false
  } finally {
    recharging.value = false
  }
}

async function doWithdraw() {
  if (!withdrawAmount.value || withdrawAmount.value < 100) return
  withdrawing.value = true
  try {
    const r = await mobileAuthFetch('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: withdrawAmount.value }),
    })
    const j = await r.json()
    if (j.success) {
      mobileToast('✅ 提现申请已提交')
      withdrawAmount.value = null
      load()
    } else {
      mobileToast('⚠ ' + (j.error || '提现失败'))
    }
  } catch {
    mobileToast('⚠ 网络错误，请重试')
  } finally {
    withdrawing.value = false
  }
}

async function bindAcct() {
  binding.value = true
  try {
    const r = await mobileAuthFetch('/api/wallet/bind-account', {
      method: 'POST',
      body: JSON.stringify({ accountName: bindName.value, accountNo: bindNo.value }),
    })
    const j = await r.json()
    if (j.success) {
      mobileToast('✅ 绑定成功')
      bindName.value = ''
      bindNo.value = ''
      load()
    } else {
      mobileToast('⚠ ' + (j.error || '绑定失败'))
    }
  } catch {
    mobileToast('⚠ 网络错误')
  } finally {
    binding.value = false
  }
}

async function unbind() {
  try {
    const r = await mobileAuthFetch('/api/wallet/bind-account', { method: 'DELETE' })
    const j = await r.json()
    if (j.success) mobileToast('✅ 已解绑')
    load()
  } catch { /* ignore */ }
}
</script>

<style scoped>
.mb-balance-card { background: linear-gradient(135deg, #f6a15c 0%, #e8644e 100%); border-radius: 12px; padding: 22px 18px; color: #fff; }
.mb-balance-label { font-size: 12px; opacity: .85; }
.mb-balance-num { font-size: 32px; font-weight: 800; margin-top: 6px; }
.mb-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.mb-card-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.mb-recharge-opts { display: flex; flex-wrap: wrap; gap: 8px; }
.mb-opt { flex: 1; min-width: 70px; padding: 10px 0; border: 1px solid #e5e5e5; border-radius: 8px; background: #fff; font-size: 14px; }
.mb-opt.on { border-color: #e8644e; color: #e8644e; background: #fff5f3; }
.mb-btn { width: 100%; margin-top: 10px; padding: 11px; border: none; border-radius: 8px; background: #f2f3f5; color: #333; font-size: 14px; }
.mb-btn.primary { background: #e8644e; color: #fff; }
.mb-btn:disabled { opacity: .5; }
.mb-pay-msg { margin-top: 10px; font-size: 13px; color: #e5484d; }
.mb-pay-msg.ok { color: #22c55e; }
.mb-input { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; outline: none; }
.mb-hint { font-size: 12px; color: #999; margin: 6px 0 0; }
.mb-empty { text-align: center; color: #999; font-size: 13px; padding: 16px 0; }
.mb-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f4; font-size: 13px; }
.mb-item:last-child { border-bottom: none; }
.mb-item-main { display: flex; flex-direction: column; gap: 2px; }
.mb-item-amt { font-weight: 600; }
.mb-item-sub { color: #999; font-size: 12px; }
.mb-item-time { color: #aaa; font-size: 12px; }
.mb-mini-btn { border: 1px solid #e5e5e5; border-radius: 6px; background: #fff; padding: 4px 10px; font-size: 12px; color: #666; }
</style>
