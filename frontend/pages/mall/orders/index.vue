<template>
  <div class="min-h-screen bg-[#050A15]">
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-4xl mx-auto px-4">
        <NuxtLink to="/mall" class="text-sm text-gray-400 hover:text-white">← 返回商城</NuxtLink>
        <h1 class="text-xl font-bold text-white mt-2">📋 我的订单</h1>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 py-4">
      <!-- 未登录 -->
      <div v-if="!isLoggedIn" class="text-center py-20">
        <p class="text-gray-400 text-lg mb-4">请先登录后查看订单</p>
        <button @click="goLogin" class="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">去登录</button>
      </div>

      <!-- 加载中 -->
      <div v-else-if="loading" class="text-center py-20 text-gray-400">加载中...</div>

      <template v-else>
        <!-- 状态 tabs -->
        <div class="flex gap-1 mb-6 overflow-x-auto bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-1">
          <button v-for="tab in statusTabs" :key="tab.key" @click="activeStatus = tab.key; currentPage = 1"
            class="px-4 py-2 rounded-lg text-xs whitespace-nowrap transition"
            :class="activeStatus === tab.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'">
            {{ tab.label }}
          </button>
        </div>

        <!-- 空状态 -->
        <div v-if="orders.length === 0" class="text-center py-20 text-gray-500">暂无订单</div>

        <!-- 订单列表 -->
        <div v-else class="space-y-4">
          <div v-for="order in orders" :key="order.id"
            class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] overflow-hidden hover:border-indigo-500/30 transition cursor-pointer"
            @click="router.push(`/mall/orders/${order.orderNo}`)">
            <!-- 头部 -->
            <div class="flex items-center justify-between px-4 py-3 bg-[#0A1628] border-b border-[#1A2D4A]">
              <span class="text-xs text-gray-500">订单号：{{ order.orderNo }}</span>
              <span class="text-xs px-2 py-0.5 rounded" :class="statusClass(order.status)">{{ statusLabel(order.status) }}</span>
            </div>
            <!-- 商品预览 -->
            <div class="px-4 py-3">
              <div v-for="item in order.items?.slice(0, 3)" :key="item.id" class="flex items-center gap-3 py-2">
                <div class="w-12 h-12 shrink-0 bg-[#13233E] rounded-lg overflow-hidden flex items-center justify-center">
                  <img v-if="item.productCover" :src="item.productCover" alt="" class="w-full h-full object-cover" />
                  <span v-else class="text-lg text-gray-600">📦</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-white truncate">{{ item.productName }}</div>
                  <div class="text-xs text-gray-500">¥{{ item.price.toFixed(2) }} x {{ item.quantity }}</div>
                </div>
                <div class="text-sm font-bold text-red-400">¥{{ item.subtotal.toFixed(2) }}</div>
              </div>
              <div v-if="order.items?.length > 3" class="text-xs text-gray-500 mt-1">...还有 {{ order.items.length - 3 }} 件商品</div>
            </div>
            <!-- 底部 -->
            <div class="flex items-center justify-between px-4 py-3 bg-[#0A1628] border-t border-[#1A2D4A]">
              <span class="text-xs text-gray-500">{{ formatTime(order.createdAt) }}</span>
              <div class="flex items-center gap-3">
                <span class="text-sm">合计：<span class="font-bold text-red-400">¥{{ order.payAmount.toFixed(2) }}</span></span>
                <!-- 操作按钮 -->
                <button v-if="order.status === 'pending'" @click.stop="cancelOrder(order.orderNo)" class="text-xs text-gray-500 hover:text-red-400">取消</button>
                <button v-if="order.status === 'pending'" @click.stop="goPay(order.orderNo)" class="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">去支付</button>
                <button v-if="order.status === 'shipped'" @click.stop="confirmReceive(order.orderNo)" class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">确认收货</button>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-6">
            <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage <= 1"
              class="px-3 py-1.5 rounded-lg text-xs border border-[#1A2D4A] text-gray-400 hover:text-white disabled:opacity-30">上一页</button>
            <span class="text-sm text-gray-400">{{ currentPage }} / {{ totalPages }}</span>
            <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage >= totalPages"
              class="px-3 py-1.5 rounded-lg text-xs border border-[#1A2D4A] text-gray-400 hover:text-white disabled:opacity-30">下一页</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoggedIn = ref(false)
const loading = ref(true)
const orders = ref<any[]>([])
const currentPage = ref(1)
const totalPages = ref(1)
const activeStatus = ref('')
const pageSize = 10

function authHeaders() { return { Authorization: `Bearer ${getToken()}` } }
async function authFetch(url: string, opts?: any) {
  return $fetch(url, { ...opts, headers: { ...authHeaders(), ...opts?.headers } })
}

const statusTabs = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'paid', label: '待发货' },
  { key: 'shipped', label: '待收货' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: '待付款', paid: '待发货', shipped: '待收货', completed: '已完成', cancelled: '已取消' }
  return map[s] || s
}
function statusClass(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-600/20 text-yellow-400',
    paid: 'bg-blue-600/20 text-blue-400',
    shipped: 'bg-purple-600/20 text-purple-400',
    completed: 'bg-green-600/20 text-green-400',
    cancelled: 'bg-gray-600/20 text-gray-400',
  }
  return map[s] || 'bg-gray-600/20 text-gray-400'
}

function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function checkLogin() {
  isLoggedIn.value = !!getToken()
}

async function fetchOrders() {
  if (!isLoggedIn.value) { loading.value = false; return }
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(currentPage.value))
    params.set('pageSize', String(pageSize))
    if (activeStatus.value) params.set('status', activeStatus.value)
    const res = await authFetch(`/api/mall/orders?${params.toString()}`)
    if (res?.success) {
      orders.value = res.data?.items || []
      totalPages.value = res.data?.totalPages || 1
    }
  } catch (e) { console.error('订单加载失败', e) }
  finally { loading.value = false }
}

function goLogin() { router.push('/director-os/aigc/login') }
function goPay(orderNo: string) { router.push(`/mall/pay/${orderNo}`) }

async function cancelOrder(orderNo: string) {
  if (!confirm('确定取消订单？')) return
  try {
    const res = await authFetch(`/api/mall/orders/${orderNo}/cancel`, { method: 'PUT' })
    if (res?.success) fetchOrders()
  } catch (e: any) { alert(e?.data?.error || '取消失败') }
}

async function confirmReceive(orderNo: string) {
  if (!confirm('确定已收到商品？')) return
  try {
    const res = await authFetch(`/api/mall/orders/${orderNo}/confirm`, { method: 'POST' })
    if (res?.success) fetchOrders()
  } catch (e: any) { alert(e?.data?.error || '确认收货失败') }
}

watch(currentPage, fetchOrders)
watch(activeStatus, fetchOrders)

onMounted(() => { checkLogin(); fetchOrders() })
</script>
