<template>
  <div class="orders-page">
    <div class="page-header">
      <h2 class="page-title">📋 VIP 订单管理</h2>
      <p class="page-subtitle">审核用户提交的VIP付款订单</p>
    </div>

    <!-- 提示 -->
    <div v-if="error" class="msg msg--err">{{ error }}</div>
    <div v-if="success" class="msg msg--ok">{{ success }}</div>

    <!-- 加载中 -->
    <div v-if="loading" class="msg msg--loading">加载中...</div>

    <!-- 订单列表 -->
    <div v-else-if="orders.length === 0" class="msg msg--empty">暂无订单</div>

    <div v-else class="orders-table-wrap">
      <table class="orders-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>账号名称</th>
            <th>套餐</th>
            <th>金额</th>
            <th>当前等级</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id" :class="statusRowClass(o.status)">
            <td class="td-time">{{ formatTime(o.createdAt) }}</td>
            <td>{{ o.username }}</td>
            <td>{{ o.accountName || '-' }}</td>
            <td>{{ o.planName }}</td>
            <td>¥{{ o.amount }}</td>
            <td>{{ o.currentTier || 'free' }}</td>
            <td>
              <span class="status-badge" :class="`status-badge--${o.status}`">
                {{ statusLabel(o.status) }}
              </span>
            </td>
            <td class="td-actions">
              <button
                v-if="o.status === 'pending_verify'"
                class="btn btn-approve"
                :disabled="processingId === o.id"
                @click="approveOrder(o)"
              >通过</button>
              <button
                v-if="o.status === 'pending_verify'"
                class="btn btn-reject"
                :disabled="processingId === o.id"
                @click="rejectOrder(o)"
              >拒绝</button>
              <span v-if="o.status === 'paid'" class="td-done">✅ 已激活</span>
              <span v-if="o.status === 'pending'" class="td-done">⏳ 待提交</span>
              <span v-if="o.status === 'failed'" class="td-done">❌ 已拒绝</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const orders = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const processingId = ref('')

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: '待提交',
    pending_verify: '待审核',
    paid: '已激活',
    failed: '已拒绝',
  }
  return map[s] || s
}

function statusRowClass(s: string): string {
  if (s === 'pending_verify') return 'row-pending'
  if (s === 'paid') return 'row-paid'
  if (s === 'failed') return 'row-failed'
  return ''
}

function formatTime(t: string): string {
  if (!t) return '-'
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fetchOrders() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/vip-orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    orders.value = await res.json()
  } catch (e: any) {
    error.value = '获取订单失败: ' + e.message
  }
  loading.value = false
}

async function approveOrder(o: any) {
  if (!confirm(`确认通过「${o.accountName || o.username}」的 ${o.planName} 订单？`)) return
  processingId.value = o.id
  error.value = ''
  success.value = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/vip-orders/${o.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) {
      success.value = data.message || '✅ 已激活'
      setTimeout(() => { success.value = '' }, 3000)
      await fetchOrders()
    } else {
      error.value = data.error || '操作失败'
    }
  } catch (e: any) {
    error.value = e.message
  }
  processingId.value = ''
}

async function rejectOrder(o: any) {
  if (!confirm(`确认拒绝「${o.accountName || o.username}」的 ${o.planName} 订单？`)) return
  processingId.value = o.id
  error.value = ''
  success.value = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/vip-orders/${o.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) {
      success.value = data.message || '✅ 已拒绝'
      setTimeout(() => { success.value = '' }, 3000)
      await fetchOrders()
    } else {
      error.value = data.error || '操作失败'
    }
  } catch (e: any) {
    error.value = e.message
  }
  processingId.value = ''
}

onMounted(fetchOrders)
</script>

<style scoped>
.orders-page {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
}
.page-header { margin-bottom: 20px; }
.page-title { font-size: 1.2rem; font-weight: 700; color: #e4e4e7; margin: 0 0 4px; }
.page-subtitle { font-size: 0.75rem; color: #71717a; margin: 0; }

.msg { padding: 10px 16px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 16px; }
.msg--err { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
.msg--ok { background: rgba(34,197,94,0.08); color: #22c55e; border: 1px solid rgba(34,197,94,0.15); }
.msg--loading { color: #71717a; }
.msg--empty { color: #71717a; text-align: center; padding: 40px; }

.orders-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}

.orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.orders-table th {
  text-align: left;
  padding: 10px 14px;
  background: rgba(255,255,255,0.02);
  color: #71717a;
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.orders-table td {
  padding: 10px 14px;
  color: #d4d4d8;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}

.row-pending { background: rgba(234,179,8,0.02); }
.row-paid { background: rgba(34,197,94,0.02); }
.row-failed { background: rgba(239,68,68,0.02); }

.td-time { white-space: nowrap; color: #71717a; font-size: 0.72rem; }
.td-actions { white-space: nowrap; display: flex; gap: 6px; }
.td-done { font-size: 0.72rem; color: #52525b; }

.status-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}
.status-badge--pending { background: rgba(255,255,255,0.04); color: #71717a; }
.status-badge--pending_verify { background: rgba(234,179,8,0.1); color: #eab308; }
.status-badge--paid { background: rgba(34,197,94,0.1); color: #22c55e; }
.status-badge--failed { background: rgba(239,68,68,0.08); color: #ef4444; }

.btn {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-approve { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
.btn-approve:hover:not(:disabled) { background: rgba(34,197,94,0.2); }
.btn-reject { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
.btn-reject:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
</style>
