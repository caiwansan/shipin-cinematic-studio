<template>
  <MPageShell title="我的余额" @close="$emit('close')">
    <!-- 余额卡（对齐线上我的余额） -->
    <div class="mb-balance-card">
      <div class="mb-balance-label">钱包余额（元）</div>
      <div class="mb-balance-num">¥{{ balance }}</div>
      <div class="mb-balance-actions">
        <button class="mb-btn-slim" :disabled="Number(balance) < 100 || withdrawing || withdrawPanel" @click="withdrawPanel = true">申请提现</button>
        <button class="mb-btn-slim ghost" @click="showUpgrade = true">升级 VIP</button>
      </div>
      <div v-if="Number(balance) < 100" class="mb-balance-hint">满 ¥100 可提现 · 手续费 5%</div>
    </div>

    <!-- 收款账号（对齐线上：支付宝/微信 + 收款码） -->
    <div class="mb-card">
      <div class="mb-head">
        <div class="mb-card-title">💳 收款账号</div>
        <button class="mb-mini-btn" @click="showBind = true">{{ acct ? '修改' : '绑定' }}</button>
      </div>
      <div v-if="!acct" class="mb-empty">尚未绑定收款账号，提现前请先绑定支付宝或微信收款码</div>
      <div v-else class="mb-item">
        <div class="mb-item-main">
          <span class="mb-item-amt">{{ acct.accountName }}</span>
          <span class="mb-item-sub">{{ acct.accountType === 'alipay' ? '支付宝' : '微信支付' }}{{ acct.accountNo ? ' · ' + acct.accountNo : '' }}</span>
          <img v-if="acct.qrCodeUrl" :src="acct.qrCodeUrl" class="mb-qr-thumb" />
        </div>
      </div>
    </div>

    <!-- 佣金流水（对齐线上） -->
    <div class="mb-card">
      <div class="mb-card-title">🧾 佣金流水</div>
      <div v-if="!commissions.length" class="mb-empty">暂无佣金记录</div>
      <div v-for="c in commissions" :key="c.id" class="mb-item">
        <div class="mb-item-main"><span class="mb-item-amt plus">+¥{{ Number(c.commissionAmount).toFixed(2) }}</span><span class="mb-item-sub">{{ c.remark || '推荐佣金' }}</span></div>
        <span class="mb-item-time">{{ (c.createdAt || '').slice(0, 10) }}</span>
      </div>
    </div>

    <!-- 提现记录 -->
    <div class="mb-card">
      <div class="mb-card-title">📋 提现记录</div>
      <div v-if="!withdraws.length" class="mb-empty">暂无提现记录</div>
      <div v-for="w in withdraws" :key="w.id" class="mb-item">
        <div class="mb-item-main">
          <span class="mb-item-amt">-¥{{ Number(w.amount).toFixed(2) }}</span>
          <span class="mb-item-sub">{{ statusLabel(w.status) }}{{ w.fee ? ' · 手续费 ¥' + Number(w.fee).toFixed(2) : '' }}</span>
        </div>
        <span class="mb-item-time">{{ (w.createdAt || '').slice(0, 10) }}</span>
      </div>
    </div>

    <!-- 提现弹窗 -->
    <div v-if="withdrawPanel" class="mb-mask" @click.self="withdrawPanel=false">
      <div class="mb-bind-modal">
        <button class="mb-balance-close" @click="withdrawPanel=false">✕</button>
        <div class="mb-balance-title">申请提现</div>
        <input v-model.number="withdrawAmount" type="number" min="100" :max="Number(balance)" class="mb-input" placeholder="输入提现金额" />
        <p v-if="withdrawAmount >= 100" class="mb-hint">手续费 ¥{{ (withdrawAmount * 0.05).toFixed(2) }}，实际到账 ¥{{ (withdrawAmount * 0.95).toFixed(2) }}</p>
        <p v-if="!acct" class="mb-hint warn">⚠ 请先绑定收款账号</p>
        <button class="mb-btn primary" :disabled="withdrawing || !withdrawAmount || withdrawAmount < 100" @click="doWithdraw">{{ withdrawing ? '提交中…' : '提交提现申请' }}</button>
      </div>
    </div>

    <!-- 收款账号弹窗 -->
    <div v-if="showBind" class="mb-mask" @click.self="showBind=false">
      <div class="mb-bind-modal">
        <button class="mb-balance-close" @click="showBind=false">✕</button>
        <div class="mb-balance-title">{{ acct ? '修改' : '绑定' }}收款账号</div>
        <select v-model="bindType" class="mb-input">
          <option value="alipay">支付宝</option>
          <option value="wechat">微信支付</option>
        </select>
        <input v-model="bindName" class="mb-input" placeholder="收款人全名（身份证姓名）" />
        <input v-model="bindNo" class="mb-input" placeholder="账号（选填）" />
        <div class="mb-qr-upload">
          <input type="file" accept="image/*" @change="onQrPick" ref="qrFileInput" style="display:none" />
          <button class="mb-mini-btn" @click="qrFileInput.click()">{{ bindQrUrl ? '更换收款码图' : '📷 上传收款码图（选填）' }}</button>
          <img v-if="bindQrUrl" :src="bindQrUrl" class="mb-qr-thumb" />
        </div>
        <p v-if="bindErr" class="mb-pay-msg">{{ bindErr }}</p>
        <button class="mb-btn primary" :disabled="binding || !bindName" @click="bindAcct">{{ binding ? '保存中…' : '保存收款信息' }}</button>
      </div>
    </div>

    <!-- 升级 VIP 提示 -->
    <div v-if="showUpgrade" class="mb-mask" @click.self="showUpgrade=false">
      <div class="mb-bind-modal">
        <button class="mb-balance-close" @click="showUpgrade=false">✕</button>
        <div class="mb-balance-title">使用余额升级 VIP</div>
        <div class="mb-empty">会员升级请在桌面版「会员中心」完成，手机端可继续逛逛其他功能。</div>
        <button class="mb-btn primary" @click="showUpgrade=false">知道了</button>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast, fmtMoney, mobileToken } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()

const balance = ref('0')
const withdraws = ref<any[]>([])
const commissions = ref<any[]>([])
const withdrawAmount = ref<number | null>(null)
const withdrawing = ref(false)
const withdrawPanel = ref(false)
const acct = ref<any>(null)
const showBind = ref(false)
const bindType = ref('alipay')
const bindName = ref('')
const bindNo = ref('')
const bindQrUrl = ref('')
const bindErr = ref('')
const binding = ref(false)
const showUpgrade = ref(false)
const qrFileInput = ref<any>(null)

async function load() {
  try {
    const r = await mobileAuthFetch('/api/wallet')
    const j = await r.json()
    const d = j.data || j
    balance.value = fmtMoney(d.walletBalance ?? d.balance ?? 0)
    withdraws.value = d.withdraws || []
    commissions.value = d.commissions || []
  } catch { /* ignore */ }
  try {
    const r = await mobileAuthFetch('/api/wallet/account')
    const j = await r.json()
    acct.value = j.data?.account || j.account || null
  } catch { /* ignore */ }
}
onMounted(load)

function statusLabel(s?: string) {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', paid: '已打款', rejected: '已驳回', active: '绑定中' }
  return map[s || ''] || s || ''
}

async function doWithdraw() {
  if (!withdrawAmount.value || withdrawAmount.value < 100) return
  if (!acct.value) return mobileToast('⚠ 请先绑定收款账号')
  withdrawing.value = true
  try {
    const r = await mobileAuthFetch('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: withdrawAmount.value }) })
    const j = await r.json()
    if (j.success) { mobileToast('✅ 提现申请已提交'); withdrawAmount.value = null; withdrawPanel.value = false; load() }
    else mobileToast('⚠ ' + (j.error || '提现失败'))
  } catch { mobileToast('⚠ 网络错误，请重试') }
  finally { withdrawing.value = false }
}

async function onQrPick(e: any) {
  const file = e.target?.files?.[0]
  if (!file) return
  try {
    const fd = new FormData(); fd.append('file', file)
    // 上传用原生 fetch（FormData 自动 multipart，勿设 JSON header）
    const t = typeof mobileToken === 'function' ? mobileToken() : ''
    const r = await fetch('/api/im/upload', { method: 'POST', headers: t ? { Authorization: 'Bearer ' + t } : {}, credentials: 'include', body: fd })
    const j = await r.json()
    if (j.success) bindQrUrl.value = (j.data?.url || j.url || '')
    else mobileToast('⚠ 收款码上传失败')
  } catch { mobileToast('⚠ 上传失败') }
}
async function bindAcct() {
  if (!bindName.value) return
  binding.value = true; bindErr.value = ''
  try {
    const r = await mobileAuthFetch('/api/wallet/bind-account', { method: 'POST', body: JSON.stringify({ accountType: bindType.value, accountName: bindName.value, accountNo: bindNo.value, qrCodeUrl: bindQrUrl.value || undefined }) })
    const j = await r.json()
    if (j.success) { mobileToast('✅ 绑定成功'); showBind.value = false; bindName.value = ''; bindNo.value = ''; bindQrUrl.value = ''; load() }
    else bindErr.value = j.error || '绑定失败'
  } catch { bindErr.value = '网络错误' }
  finally { binding.value = false }
}
async function unbind() {
  try {
    const r = await mobileAuthFetch('/api/wallet/bind-account', { method: 'DELETE' })
    const j = await r.json()
    if (j.success) { mobileToast('✅ 已解绑'); acct.value = null }
  } catch { /* ignore */ }
}
</script>

<style scoped>
.mb-balance-card { background: linear-gradient(135deg, #16b981, #10a37f); border-radius: 14px; padding: 22px 18px; color: #fff; position: relative; overflow: hidden; }
.mb-balance-label { font-size: 12px; opacity: .9; }
.mb-balance-num { font-size: 34px; font-weight: 800; margin-top: 6px; }
.mb-balance-actions { display: flex; gap: 10px; margin-top: 14px; }
.mb-btn-slim { background: #fff; color: #0f7a5f; border: none; border-radius: 999px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
.mb-btn-slim.ghost { background: rgba(255,255,255,.2); color: #fff; }
.mb-btn-slim:disabled { opacity: .5; }
.mb-balance-hint { font-size: 11px; opacity: .9; margin-top: 10px; }
.mb-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.mb-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mb-card-title { font-size: 14px; font-weight: 600; margin: 0; }
.mb-recharge-opts { display: flex; flex-wrap: wrap; gap: 8px; }
.mb-opt { flex: 1; min-width: 70px; padding: 10px 0; border: 1px solid #e5e5e5; border-radius: 8px; background: #fff; font-size: 14px; }
.mb-opt.on { border-color: #10a37f; color: #10a37f; background: #f0fdf9; }
.mb-btn { width: 100%; margin-top: 10px; padding: 11px; border: none; border-radius: 8px; background: #f2f3f5; color: #333; font-size: 14px; }
.mb-btn.primary { background: #10a37f; color: #fff; }
.mb-btn:disabled { opacity: .5; }
.mb-pay-msg { margin-top: 10px; font-size: 13px; color: #e5484d; }
.mb-pay-msg.ok { color: #22c55e; }
.mb-input { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; outline: none; background: #fff; }
.mb-hint { font-size: 12px; color: #999; margin: 6px 0 0; }
.mb-hint.warn { color: #e5484d; }
.mb-empty { text-align: center; color: #999; font-size: 13px; padding: 14px 0; }
.mb-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f4; font-size: 13px; }
.mb-item:last-child { border-bottom: none; }
.mb-item-main { display: flex; flex-direction: column; gap: 2px; }
.mb-item-amt { font-weight: 600; }
.mb-item-amt.plus { color: #10a37f; }
.mb-item-sub { color: #999; font-size: 12px; }
.mb-item-time { color: #aaa; font-size: 12px; }
.mb-mini-btn { border: 1px solid #e5e5e5; border-radius: 6px; background: #fff; padding: 4px 10px; font-size: 12px; color: #666; }
.mb-qr-thumb { width: 88px; height: 88px; object-fit: cover; border-radius: 8px; margin-top: 6px; border: 1px solid #eee; }
.mb-qr-upload { margin-top: 10px; }
.mb-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 99; padding: 20px; }
.mb-bind-modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 340px; position: relative; }
.mb-balance-close { position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 15px; color: #9ca3af; cursor: pointer; }
.mb-balance-title { font-size: 17px; font-weight: 700; color: #111827; margin-bottom: 6px; }
</style>
