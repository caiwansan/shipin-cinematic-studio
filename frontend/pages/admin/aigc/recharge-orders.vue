<template>
  <div class="orders-page">
    <div class="page-header">
      <h2 class="page-title">💎 钻石充值管理</h2>
      <p class="page-subtitle">四类业务隔离：钻石充值 / VIP 订阅 / 工作台套餐（商城购物见商城管理页），实时同步支付回调</p>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar">
      <div class="tabs">
        <button
          v-for="t in typeTabs" :key="t.value"
          class="tab" :class="{ active: type === t.value }"
          @click="type = t.value; page = 1; fetchOrders()"
        >{{ t.label }}</button>
      </div>
      <div class="tabs tabs--status">
        <button
          v-for="s in statusTabs" :key="s.value"
          class="tab" :class="{ active: status === s.value }"
          @click="status = s.value; page = 1; fetchOrders()"
        >{{ s.label }}</button>
      </div>
      <div class="search-row">
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索订单号 / 用户名 / 邮箱"
          @keyup.enter="page = 1; fetchOrders()"
        />
        <button class="btn btn-search" @click="page = 1; fetchOrders()">搜索</button>
      </div>
    </div>

    <div v-if="error" class="msg msg--err">{{ error }}</div>
    <div v-if="loading" class="msg msg--loading">加载中...</div>
    <div v-else-if="orders.length === 0" class="msg msg--empty">暂无订单</div>

    <div v-else class="orders-table-wrap">
      <table class="orders-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>用户</th>
            <th>类型</th>
            <th>金额</th>
            <th>钻石</th>
            <th>支付方式</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>支付时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id" :class="statusRowClass(o.status)">
            <td class="td-orderno" :title="o.orderNo">{{ shortNo(o.orderNo) }}</td>
            <td>
              <div class="td-user">{{ o.user?.username || '-' }}</div>
              <div class="td-user-sub">{{ o.user?.email || o.user?.phone || '' }}</div>
            </td>
            <td>{{ o.typeLabel }}</td>
            <td class="td-amount">¥{{ o.amount.toFixed(2) }}</td>
            <td class="td-coins">{{ o.planKind === 'credit' && o.coins ? '+' + o.coins.toLocaleString() : '-' }}</td>
            <td>{{ methodLabel(o.method) }}</td>
            <td>
              <span class="status-badge" :class="`status-badge--${o.status}`">
                {{ statusLabel(o.status) }}
              </span>
            </td>
            <td class="td-time">{{ formatTime(o.createdAt) }}</td>
            <td class="td-time">{{ formatTime(o.payTime) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pager">
      <button class="btn" :disabled="page <= 1" @click="page--; fetchOrders()">上一页</button>
      <span class="pager-info">{{ page }} / {{ totalPages }}</span>
      <button class="btn" :disabled="page >= totalPages" @click="page++; fetchOrders()">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

const typeTabs = [
  { value: 'all', label: '全部订单' },
  { value: 'credit', label: '💎 钻石充值' },
  { value: 'vip', label: '👑 VIP订阅' },
  { value: 'workspace', label: '🖥️ 工作台套餐' },
]
// MEMBER-CENTER-03.3 隔离：credit 走 type 参数；vip/workspace 走 planKind（同属 subscription 按 productType 细分）
const statusTabs = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'cancelled', label: '已取消' },
  { value: 'failed', label: '失败' },
]

const type = ref('all')
const planKind = ref('all')
const status = ref('all')
const keyword = ref('')
const orders = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(true)
const error = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    cancelled: '已取消',
    failed: '失败',
    expired: '已过期',
    refunded: '已退款',
  }
  return map[s] || s
}
function statusRowClass(s: string): string {
  if (s === 'paid') return 'row-paid'
  if (s === 'pending') return 'row-pending'
  if (s === 'failed' || s === 'cancelled') return 'row-failed'
  return ''
}
function methodLabel(m: string): string {
  const map: Record<string, string> = { wechat: '微信支付', alipay: '支付宝', balance: '余额支付', offline: '线下转账' }
  return map[m] || m || '-'
}
function formatTime(t: string | null): string {
  if (!t) return '-'
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function shortNo(no: string): string {
  if (!no) return '-'
  return no.length > 16 ? no.slice(0, 8) + '…' + no.slice(-6) : no
}

async function fetchOrders() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const qs = new URLSearchParams({ type: type.value === 'credit' ? 'credit' : 'all', planKind: type.value === 'all' ? 'all' : type.value, status: status.value, page: String(page.value), pageSize: String(pageSize) })
    if (keyword.value.trim()) qs.set('keyword', keyword.value.trim())
    const res = await fetch(`/api/admin/payment/orders?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    orders.value = data.data.items
    total.value = data.data.total
  } catch (e: any) {
    error.value = '获取订单失败: ' + e.message
  }
  loading.value = false
}

onMounted(fetchOrders)
</script>

<style scoped>
.orders-page { padding: 24px; max-width: 1180px; margin: 0 auto; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 1.2rem; font-weight: 700; color: #e4e4e7; margin: 0 0 4px; }
.page-subtitle { font-size: 0.75rem; color: #71717a; margin: 0; }

.filter-bar { margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.03); padding: 3px; border-radius: 8px; }
.tab {
  padding: 5px 12px; border: none; border-radius: 6px; background: transparent;
  color: #71717a; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.tab:hover { color: #d4d4d8; }
.tab.active { background: rgba(255,255,255,0.08); color: #e4e4e7; }
.search-row { display: flex; gap: 6px; margin-left: auto; }
.search-input {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 6px 12px; font-size: 0.75rem; color: #d4d4d8; width: 230px; outline: none;
}
.search-input:focus { border-color: rgba(59,130,246,0.4); }

.msg { padding: 10px 16px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 16px; }
.msg--err { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
.msg--loading { color: #71717a; }
.msg--empty { color: #71717a; text-align: center; padding: 40px; }

.orders-table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
.orders-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.orders-table th {
  text-align: left; padding: 10px 14px; background: rgba(255,255,255,0.02);
  color: #71717a; font-weight: 600; font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.03em; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.orders-table td { padding: 10px 14px; color: #d4d4d8; border-bottom: 1px solid rgba(255,255,255,0.03); }
.row-pending { background: rgba(234,179,8,0.02); }
.row-paid { background: rgba(34,197,94,0.02); }
.row-failed { background: rgba(239,68,68,0.02); }
.td-orderno { font-family: monospace; font-size: 0.7rem; color: #71717a; white-space: nowrap; }
.td-user { font-weight: 500; }
.td-user-sub { font-size: 0.68rem; color: #71717a; }
.td-amount { font-weight: 600; white-space: nowrap; }
.td-coins { color: #fbbf24; font-weight: 600; white-space: nowrap; }
.td-time { white-space: nowrap; color: #71717a; font-size: 0.7rem; }

.status-badge { font-size: 0.65rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.status-badge--pending { background: rgba(234,179,8,0.1); color: #eab308; }
.status-badge--paid { background: rgba(34,197,94,0.1); color: #22c55e; }
.status-badge--cancelled { background: rgba(255,255,255,0.04); color: #71717a; }
.status-badge--failed { background: rgba(239,68,68,0.08); color: #ef4444; }
.status-badge--expired { background: rgba(255,255,255,0.04); color: #71717a; }

.pager { display: flex; align-items: center; gap: 12px; margin-top: 16px; justify-content: flex-end; }
.pager-info { font-size: 0.75rem; color: #71717a; }
.btn { padding: 5px 14px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #d4d4d8; transition: all 0.15s; }
.btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
