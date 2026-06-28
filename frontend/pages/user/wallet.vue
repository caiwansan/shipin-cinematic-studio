<template>
  <div class="wallet-page">
    <div class="bg-grid" />
    <div class="bg-glow top-left" />
    <div class="bg-glow bottom-right" />

    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon">💰</span>
          <span class="logo-text">我的钱包</span>
        </div>
        <div class="nav-links">
          <router-link to="/" class="nav-link">首页</router-link>
          <router-link to="/user/center" class="nav-link">会员中心</router-link>
        </div>
      </div>
    </nav>

    <div class="wallet-content">
      <!-- 余额卡片 -->
      <div class="balance-card">
        <div class="balance-label">钱包余额</div>
        <div class="balance-amount">¥{{ balance.toFixed(2) }}</div>
        <div class="balance-actions">
          <button class="btn-action" @click="showWithdraw = true" :disabled="balance < 100">申请提现</button>
          <button class="btn-action btn-action-secondary" @click="showUpgrade = true">升级VIP</button>
        </div>
        <div class="balance-hint" v-if="balance < 100">提示：满 ¥100 可申请提现</div>
      </div>

      <!-- 收款账号绑定 -->
      <div class="section-card">
        <div class="section-header">
          <h3>收款账号</h3>
          <button class="btn-edit" @click="showBindAccount = true">
            {{ paymentAccount ? '修改' : '绑定' }}
          </button>
        </div>
        <div v-if="paymentAccount" class="account-info">
          <div class="account-row">
            <span class="account-label">方式：</span>
            <span>{{ paymentAccount.accountType === 'alipay' ? '支付宝' : '微信支付' }}</span>
          </div>
          <div class="account-row">
            <span class="account-label">收款人：</span>
            <span>{{ paymentAccount.accountName }}</span>
          </div>
          <div class="account-row" v-if="paymentAccount.accountNo">
            <span class="account-label">账号：</span>
            <span>{{ paymentAccount.accountNo }}</span>
          </div>
          <div class="account-row" v-if="paymentAccount.qrCodeUrl">
            <span class="account-label">收款码：</span>
            <img :src="paymentAccount.qrCodeUrl" class="qr-thumb" @click="previewQr = paymentAccount.qrCodeUrl" />
          </div>
        </div>
        <div v-else class="no-account">
          尚未绑定收款账号，提现前请先绑定支付宝或微信收款码
        </div>
      </div>

      <!-- 最近佣金流水 -->
      <div class="section-card">
        <h3>佣金流水</h3>
        <div v-if="commissions.length === 0" class="empty-state">暂无佣金记录</div>
        <div v-else class="commission-list">
          <div v-for="c in commissions" :key="c.id" class="commission-item">
            <div class="commission-left">
              <span class="commission-amount">+¥{{ Number(c.commissionAmount).toFixed(2) }}</span>
              <span class="commission-desc">{{ c.remark || '推荐佣金' }}</span>
            </div>
            <span class="commission-date">{{ formatDate(c.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- 提现记录 -->
      <div class="section-card">
        <h3>提现记录</h3>
        <div v-if="withdraws.length === 0" class="empty-state">暂无提现记录</div>
        <div v-else class="commission-list">
          <div v-for="w in withdraws" :key="w.id" class="commission-item">
            <div class="commission-left">
              <span class="withdraw-amount">-¥{{ Number(w.amount).toFixed(2) }}</span>
              <span :class="'withdraw-status withdraw-status--' + w.status">
                {{ w.status === 'pending' ? '审核中' : w.status === 'approved' ? '已通过' : '已拒绝' }}
              </span>
            </div>
            <span class="commission-date">{{ formatDate(w.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 提现弹窗 -->
    <div v-if="showWithdraw" class="modal-overlay" @click.self="showWithdraw = false">
      <div class="modal-card">
        <button class="modal-close" @click="showWithdraw = false">✕</button>
        <h3>申请提现</h3>
        <div class="modal-form">
          <div class="form-group">
            <label>提现金额（元）</label>
            <input v-model.number="withdrawAmount" type="number" min="100" :max="balance" class="form-input" />
            <p class="form-hint">可提现余额 ¥{{ balance.toFixed(2) }}，最低 ¥100</p>
          </div>
          <p v-if="withdrawError" class="form-error">{{ withdrawError }}</p>
          <button class="btn btn-primary btn-full" @click="doWithdraw" :disabled="withdrawLoading">
            {{ withdrawLoading ? '提交中...' : '提交提现申请' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 绑定收款码弹窗 -->
    <div v-if="showBindAccount" class="modal-overlay" @click.self="showBindAccount = false">
      <div class="modal-card">
        <button class="modal-close" @click="showBindAccount = false">✕</button>
        <h3>{{ paymentAccount ? '修改' : '绑定' }}收款账号</h3>
        <div class="modal-form">
          <div class="form-group">
            <label>收款方式</label>
            <select v-model="bindForm.accountType" class="form-input">
              <option value="alipay">支付宝</option>
              <option value="wechat">微信支付</option>
            </select>
          </div>
          <div class="form-group">
            <label>收款人全名</label>
            <input v-model="bindForm.accountName" type="text" placeholder="填写身份证上的姓名" class="form-input" />
          </div>
          <div class="form-group">
            <label>{{ bindForm.accountType === 'alipay' ? '支付宝账号' : '微信账号（选填）' }}</label>
            <input v-model="bindForm.accountNo" type="text" placeholder="选填" class="form-input" />
          </div>
          <div class="form-group">
            <label>收款码图片</label>
            <div class="qr-upload-area">
              <input type="file" accept="image/*" @change="onQrCodeFileChange" class="file-input" ref="qrFileInput" />
              <div v-if="bindForm.qrCodeUrl" class="qr-preview">
                <img :src="bindForm.qrCodeUrl" class="qr-preview-img" @click="previewQr = bindForm.qrCodeUrl" />
                <button class="qr-remove-btn" @click="bindForm.qrCodeUrl = ''; qrFileInput.value = ''">✕ 移除</button>
              </div>
              <div v-else class="qr-placeholder">
                <span>📷 点击选择收款码图片</span>
                <span class="text-gray-500 text-xs">支持 JPG/PNG/WebP</span>
              </div>
            </div>
          </div>
          <p v-if="bindError" class="form-error">{{ bindError }}</p>
          <button class="btn btn-primary btn-full" @click="doBindAccount" :disabled="bindLoading">
            {{ bindLoading ? '保存中...' : '保存收款信息' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 收款码大图预览 -->
    <div v-if="previewQr" class="modal-overlay" @click.self="previewQr = ''">
      <div class="modal-card qr-preview-modal">
        <button class="modal-close" @click="previewQr = ''">✕</button>
        <h3>收款码</h3>
        <img :src="previewQr" class="qr-full-img" />
      </div>
    </div>

    <!-- 余额升级VIP弹窗 -->
    <div v-if="showUpgrade" class="modal-overlay" @click.self="showUpgrade = false">
      <div class="modal-card">
        <button class="modal-close" @click="showUpgrade = false">✕</button>
        <h3>使用余额升级VIP</h3>
        <div v-if="plans.length === 0" class="empty-state">加载中...</div>
        <div v-else class="plan-list">
          <div v-for="p in plans" :key="p.id" class="plan-item" :class="{ 'plan-item--selected': selectedPlan === p.id }" @click="selectedPlan = p.id">
            <div class="plan-name">{{ p.name || p.level }}</div>
            <div class="plan-price">¥{{ Number(p.price).toFixed(2) }}</div>
            <div class="plan-months">{{ p.months }}个月</div>
          </div>
        </div>
        <p v-if="upgradeError" class="form-error">{{ upgradeError }}</p>
        <button class="btn btn-primary btn-full" @click="doUpgrade" :disabled="upgradeLoading || !selectedPlan">
          {{ upgradeLoading ? '处理中...' : '使用余额开通' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'user' })
import { ref, onMounted } from 'vue'
import { getToken, setToken } from '~/utils/token-cache'

const router = useRouter()
const balance = ref(0)
const commissions = ref<any[]>([])
const withdraws = ref<any[]>([])
const paymentAccount = ref<any>(null)
const plans = ref<any[]>([])

// 提现
const showWithdraw = ref(false)
const withdrawAmount = ref(100)
const withdrawLoading = ref(false)
const withdrawError = ref('')

// 绑定收款
const showBindAccount = ref(false)
const bindLoading = ref(false)
const bindError = ref('')
const bindForm = ref({ accountType: 'alipay', accountName: '', accountNo: '', qrCodeUrl: '' })
const qrFileInput = ref<HTMLInputElement | null>(null)
const previewQr = ref('')
const qrUploading = ref(false)

// 收款码文件上传
async function onQrCodeFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  qrUploading.value = true
  try {
    const token = getToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      bindError.value = err.error || '上传失败'
      return
    }
    const d = await res.json()
    const url = d.data?.url || d.url
    if (url) bindForm.value.qrCodeUrl = url
    else bindError.value = '上传返回异常'
  } catch (err: any) {
    bindError.value = '上传失败: ' + (err.message || '网络错误')
  } finally {
    qrUploading.value = false
  }
}

// 升级VIP
const showUpgrade = ref(false)
const selectedPlan = ref('')
const upgradeLoading = ref(false)
const upgradeError = ref('')

const token = getToken()

async function fetchWallet() {
  try {
    const res = await fetch('/api/wallet', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) { 
      const err = await res.json().catch(() => ({}))
      console.error('钱包API错误:', err)
      return 
    }
    const d = await res.json()
    if (d.data) {
      balance.value = d.data.balance || 0
      commissions.value = d.data.commissions || []
      withdraws.value = d.data.withdraws || []
    }
  } catch {}
}

async function fetchAccount() {
  try {
    const res = await fetch('/api/wallet/account', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      paymentAccount.value = d.data
      if (d.data) {
        bindForm.value = {
          accountType: d.data.accountType || 'alipay',
          accountName: d.data.accountName || '',
          accountNo: d.data.accountNo || '',
        }
      }
    }
  } catch {}
}

async function fetchPlans() {
  try {
    const res = await fetch('/api/member/plans', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      plans.value = d.data || []
    }
  } catch {}
}

async function doWithdraw() {
  withdrawError.value = ''
  if (!withdrawAmount.value || withdrawAmount.value < 100) {
    withdrawError.value = '提现金额不能小于100元'
    return
  }
  if (withdrawAmount.value > balance.value) {
    withdrawError.value = '余额不足'
    return
  }
  withdrawLoading.value = true
  try {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ amount: withdrawAmount.value }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || '提现失败')
    showWithdraw.value = false
    await fetchWallet()
  } catch (e: any) {
    withdrawError.value = e.message
  } finally {
    withdrawLoading.value = false
  }
}

async function doBindAccount() {
  bindError.value = ''
  if (!bindForm.value.accountName || bindForm.value.accountName.length < 2) {
    bindError.value = '请填写收款人全名'
    return
  }
  bindLoading.value = true
  try {
    const res = await fetch('/api/wallet/bind-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(bindForm.value),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || '绑定失败')
    showBindAccount.value = false
    await fetchAccount()
  } catch (e: any) {
    bindError.value = e.message
  } finally {
    bindLoading.value = false
  }
}

async function doUpgrade() {
  upgradeError.value = ''
  if (!selectedPlan.value) { upgradeError.value = '请选择套餐'; return }
  upgradeLoading.value = true
  try {
    const res = await fetch('/api/wallet/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ planId: selectedPlan.value }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || '升级失败')
    showUpgrade.value = false
    await fetchWallet()
    // 刷新用户信息
    try {
      const userRes = await fetch('/api/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (userRes.ok) {
        const userData = (await userRes.json()).data || (await userRes.json())
        const { setUser } = await import('~/utils/token-cache')
        setUser(userData)
      }
    } catch {}
  } catch (e: any) {
    upgradeError.value = e.message
  } finally {
    upgradeLoading.value = false
  }
}

function formatDate(d: string) {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

onMounted(() => {
  fetchWallet()
  fetchAccount()
  fetchPlans()
})
</script>

<style scoped>
.wallet-page { min-height: 100vh; background: #0b0b0d; color: white; font-family: -apple-system, BlinkMacSystemFont, sans-serif; position: relative; overflow-x: hidden; }
.bg-grid { position: fixed; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; }
.bg-glow { position: fixed; width: 400px; height: 400px; border-radius: 50%; filter: blur(120px); pointer-events: none; opacity: 0.15; }
.bg-glow.top-left { top: -100px; left: -100px; background: #3b82f6; }
.bg-glow.bottom-right { bottom: -100px; right: -100px; background: #10b981; }
.nav-bar { position: sticky; top: 0; z-index: 50; background: rgba(11,11,13,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.06); }
.nav-inner { max-width: 960px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; }
.nav-logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 20px; }
.logo-text { font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.nav-links { display: flex; gap: 20px; }
.nav-link { font-size: 12px; color: rgba(255,255,255,0.5); text-decoration: none; transition: color 0.2s; }
.nav-link:hover { color: rgba(255,255,255,0.9); }
.wallet-content { max-width: 640px; margin: 0 auto; padding: 32px 24px 80px; display: flex; flex-direction: column; gap: 20px; }
.balance-card { background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15)); border: 1px solid rgba(16,185,129,0.2); border-radius: 16px; padding: 32px; text-align: center; }
.balance-label { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
.balance-amount { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }
.balance-actions { display: flex; gap: 12px; justify-content: center; }
.btn-action { padding: 10px 24px; border-radius: 10px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; background: linear-gradient(135deg, #10b981, #059669); color: white; transition: opacity 0.2s; }
.btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-action-secondary { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
.btn-action-secondary:hover { background: rgba(255,255,255,0.12); }
.balance-hint { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 12px; }
.section-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h3, .section-card h3 { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: rgba(255,255,255,0.8); }
.section-card h3 { margin-bottom: 12px; }
.btn-edit { padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(59,130,246,0.3); background: transparent; color: #60a5fa; font-size: 11px; cursor: pointer; }
.no-account { font-size: 12px; color: rgba(255,255,255,0.3); padding: 12px 0; }
.account-info { display: flex; flex-direction: column; gap: 8px; }
.account-row { font-size: 13px; color: rgba(255,255,255,0.7); }
.account-label { color: rgba(255,255,255,0.4); }
.commission-list { display: flex; flex-direction: column; }
.commission-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.commission-item:last-child { border-bottom: none; }
.commission-left { display: flex; flex-direction: column; gap: 2px; }
.commission-amount { font-size: 14px; font-weight: 600; color: #10b981; }
.withdraw-amount { font-size: 14px; font-weight: 600; color: #ef4444; }
.commission-desc { font-size: 11px; color: rgba(255,255,255,0.3); }
.commission-date { font-size: 11px; color: rgba(255,255,255,0.25); }
.withdraw-status { font-size: 10px; padding: 2px 8px; border-radius: 999px; }
.withdraw-status--pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
.withdraw-status--approved { background: rgba(16,185,129,0.1); color: #10b981; }
.withdraw-status--rejected { background: rgba(239,68,68,0.1); color: #ef4444; }
.empty-state { padding: 24px 0; text-align: center; font-size: 12px; color: rgba(255,255,255,0.2); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-card { background: #0D1328; border: 1px solid #1A2240; border-radius: 16px; padding: 24px; width: 90%; max-width: 400px; max-height: 80vh; overflow-y: auto; position: relative; }
.modal-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: rgba(255,255,255,0.4); font-size: 18px; cursor: pointer; }
.modal-card h3 { font-size: 16px; font-weight: 600; margin: 0 0 20px; }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 11px; color: rgba(255,255,255,0.4); }
.form-input { background: #0B1020; border: 1px solid #1A2240; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: rgba(255,255,255,0.7); outline: none; }
.form-input:focus { border-color: rgba(16,185,129,0.5); }
.form-hint { font-size: 10px; color: rgba(255,255,255,0.2); margin: 4px 0 0; }
.form-error { font-size: 11px; color: #ef4444; }
.btn-full { width: 100%; }
.plan-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.plan-item { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; cursor: pointer; transition: all 0.2s; }
.plan-item--selected { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.05); }
.plan-name { flex: 1; font-size: 13px; color: rgba(255,255,255,0.8); }
.plan-price { font-size: 16px; font-weight: 600; color: #10b981; }
.plan-months { font-size: 11px; color: rgba(255,255,255,0.3); }

/* 收款码上传 */
.qr-upload-area { position: relative; border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; text-align: center; }
.qr-upload-area .file-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.qr-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; font-size: 12px; color: rgba(255,255,255,0.4); }
.qr-preview { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.qr-preview-img { width: 120px; height: 120px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
.qr-remove-btn { font-size: 11px; color: #ef4444; background: none; border: none; cursor: pointer; }
.qr-thumb { width: 36px; height: 36px; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; vertical-align: middle; }
.qr-thumb-xs { width: 32px; height: 32px; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); }
.qr-full-img { max-width: 100%; max-height: 60vh; border-radius: 8px; }
.qr-preview-modal { max-width: 400px; text-align: center; }
</style>
