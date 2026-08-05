<template>
  <div class="orders-page">
    <div class="page-header">
      <h2 class="page-title">💰 会员提现管理</h2>
      <p class="page-subtitle">审核会员提现申请（通过后线下打款，拒绝自动退回余额）</p>
    </div>

    <!-- 状态筛选 -->
    <div class="filter-bar">
      <div class="tabs">
        <button
          v-for="s in statusTabs" :key="s.value"
          class="tab" :class="{ active: status === s.value }"
          @click="status = s.value; page = 1; fetchWithdraws()"
        >{{ s.label }}</button>
      </div>
    </div>

    <div v-if="error" class="msg msg--err">{{ error }}</div>
    <div v-if="success" class="msg msg--ok">{{ success }}</div>
    <div v-if="loading" class="msg msg--loading">加载中...</div>
    <div v-else-if="withdraws.length === 0" class="msg msg--empty">暂无提现记录</div>

    <div v-else class="orders-table-wrap">
      <table class="orders-table">
        <thead>
          <tr>
            <th>申请时间</th>
            <th>用户</th>
            <th>提现金额</th>
            <th>手续费</th>
            <th>收款方式</th>
            <th>收款账号</th>
            <th>收款人</th>
            <th>状态</th>
            <th>备注</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in withdraws" :key="w.id" :class="statusRowClass(w.status)">
            <td class="td-time">{{ formatTime(w.createdAt) }}</td>
            <td>
              <div class="td-user">{{ w.user?.username || '-' }}</div>
              <div class="td-user-sub">{{ w.user?.email || w.user?.phone || '' }}</div>
            </td>
            <td class="td-amount">¥{{ Number(w.amount).toFixed(2) }}</td>
            <td class="td-fee">
              <span v-if="w.fee">¥{{ Number(w.fee).toFixed(2) }}</span><span v-else>-</span>
              <div class="td-fee-sub" v-if="w.fee">到账 ¥{{ Number(w.amount - (w.fee || 0)).toFixed(2) }}</div>
            </td>
            <td>{{ accountTypeLabel(w.accountType) }}</td>
            <td class="td-account">{{ w.accountNo || '-' }}</td>
            <td>{{ w.accountName || '-' }}</td>
            <td>
              <span class="status-badge" :class="`status-badge--${w.status}`">
                {{ statusLabel(w.status) }}
              </span>
            </td>
            <td class="td-remark" :title="w.remark">{{ w.remark || '-' }}</td>
            <td class="td-actions">
              <template v-if="w.status === 'pending'">
                <button class="btn btn-approve" :disabled="processingId === w.id" @click="approve(w)">通过</button>
                <button class="btn btn-reject" :disabled="processingId === w.id" @click="reject(w)">拒绝</button>
              </template>
              <span v-else class="td-done">{{ w.approvedAt ? formatTime(w.approvedAt) : '' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pager">
      <button class="btn" :disabled="page <= 1" @click="page--; fetchWithdraws()">上一页</button>
      <span class="pager-info">{{ page }} / {{ totalPages }}</span>
      <button class="btn" :disabled="page >= totalPages" @click="page++; fetchWithdraws()">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

const status = ref('all')
const withdraws = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(true)
const error = ref('')
const success = ref('')
const processingId = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

function statusLabel(s: string): string {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }
  return map[s] || s
}
function statusRowClass(s: string): string {
  if (s === 'pending') return 'row-pending'
  if (s === 'approved') return 'row-paid'
  if (s === 'rejected') return 'row-failed'
  return ''
}
function accountTypeLabel(t: string): string {
  const map: Record<string, string> = { alipay: '支付宝', wechat: '微信', bank: '银行卡' }
  return map[t] || t || '-'
}
function formatTime(t: string | null): string {
  if (!t) return '-'
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fetchWithdraws() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const qs = new URLSearchParams({ status: status.value, page: String(page.value), pageSize: String(pageSize) })
    const res = await fetch(`/api/admin/wallet/withdraws?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    withdraws.value = data.data.items
    total.value = data.data.total
  } catch (e: any) {
    error.value = '获取提现列表失败: ' + e.message
  }
  loading.value = false
}

async function approve(w: any) {
  if (!confirm(`确认通过 ${w.user?.username || w.userId} 的 ¥${Number(w.amount).toFixed(2)} 提现申请？通过后请线下打款至「${accountTypeLabel(w.accountType)} ${w.accountNo}」`)) return
  processingId.value = w.id
  error.value = ''
  success.value = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/wallet/withdraw/${w.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) {
      success.value = '✅ 已审核通过'
      setTimeout(() => { success.value = '' }, 3000)
      await fetchWithdraws()
    } else {
      error.value = data.error || '操作失败'
    }
  } catch (e: any) {
    error.value = e.message
  }
  processingId.value = ''
}

async function reject(w: any) {
  const reason = prompt(`确认拒绝 ${w.user?.username || w.userId} 的 ¥${Number(w.amount).toFixed(2)} 提现申请？\n填写拒绝原因（余额将自动退回用户钱包）：`, '信息有误，请重新提交')
  if (reason === null) return
  processingId.value = w.id
  error.value = ''
  success.value = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/wallet/withdraw/${w.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ remark: reason.trim() || '审核拒绝' }),
    })
    const data = await res.json()
    if (res.ok) {
      success.value = '✅ 已拒绝，余额已退回'
      setTimeout(() => { success.value = '' }, 3000)
      await fetchWithdraws()
    } else {
      error.value = data.error || '操作失败'
    }
  } catch (e: any) {
    error.value = e.message
  }
  processingId.value = ''
}

onMounted(fetchWithdraws)
</script>

<style scoped>
.orders-page { padding: 24px; max-width: 1180px; margin: 0 auto; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 1.2rem; font-weight: 700; color: #e4e4e7; margin: 0 0 4px; }
.page-subtitle { font-size: 0.75rem; color: #71717a; margin: 0; }

.filter-bar { margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.03); padding: 3px; border-radius: 8px; }
.tab { padding: 5px 12px; border: none; border-radius: 6px; background: transparent; color: #71717a; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.tab:hover { color: #d4d4d8; }
.tab.active { background: rgba(255,255,255,0.08); color: #e4e4e7; }

.msg { padding: 10px 16px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 16px; }
.msg--err { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
.msg--ok { background: rgba(34,197,94,0.08); color: #22c55e; border: 1px solid rgba(34,197,94,0.15); }
.msg--loading { color: #71717a; }
.msg--empty { color: #71717a; text-align: center; padding: 40px; }

.orders-table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
.orders-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.orders-table th { text-align: left; padding: 10px 14px; background: rgba(255,255,255,0.02); color: #71717a; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1px solid rgba(255,255,255,0.04); }
.orders-table td { padding: 10px 14px; color: #d4d4d8; border-bottom: 1px solid rgba(255,255,255,0.03); }
.row-pending { background: rgba(234,179,8,0.02); }
.row-paid { background: rgba(34,197,94,0.02); }
.row-failed { background: rgba(239,68,68,0.02); }
.td-user { font-weight: 500; }
.td-user-sub { font-size: 0.68rem; color: #71717a; }
.td-amount { font-weight: 600; white-space: nowrap; color: #fbbf24; }
.td-fee { color: #fbbf24; font-weight: 600; white-space: nowrap; }
.td-fee-sub { font-size: 11px; color: rgba(255, 255, 255, 0.45); font-weight: 400; }
.td-account { font-family: monospace; font-size: 0.74rem; }
.td-remark { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.72rem; color: #71717a; }
.td-time { white-space: nowrap; color: #71717a; font-size: 0.7rem; }
.td-actions { white-space: nowrap; display: flex; gap: 6px; }
.td-done { font-size: 0.7rem; color: #52525b; white-space: nowrap; }

.status-badge { font-size: 0.65rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.status-badge--pending { background: rgba(234,179,8,0.1); color: #eab308; }
.status-badge--approved { background: rgba(34,197,94,0.1); color: #22c55e; }
.status-badge--rejected { background: rgba(239,68,68,0.08); color: #ef4444; }

.btn { padding: 4px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-approve { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.btn-approve:hover:not(:disabled) { background: rgba(34,197,94,0.2); }
.btn-reject { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
.btn-reject:hover:not(:disabled) { background: rgba(239,68,68,0.15); }

.pager { display: flex; align-items: center; gap: 12px; margin-top: 16px; justify-content: flex-end; }
.pager-info { font-size: 0.75rem; color: #71717a; }
</style>
