<template>
  <div class="min-h-screen bg-[#050A15]">
    <div class="bg-gradient-to-b from-[#0A1628] to-[#050A15] py-4">
      <div class="max-w-4xl mx-auto px-4">
        <NuxtLink to="/mall/orders" class="text-sm text-gray-400 hover:text-white">← 返回订单列表</NuxtLink>
      </div>
    </div>

    <div v-if="loading" class="text-center py-20 text-gray-400">加载中...</div>

    <div v-else-if="order" class="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-12">
      <!-- ===== 订单状态 ===== -->
      <div class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-lg font-bold text-white">订单详情</span>
            <span class="ml-3 text-xs px-2 py-0.5 rounded" :class="statusClass(order.status)">{{ statusLabel(order.status) }}</span>
          </div>
          <span class="text-sm text-gray-400">订单号：{{ order.orderNo }}</span>
        </div>

        <!-- 状态时间线 -->
        <div class="mt-4 flex items-center gap-1 text-xs">
          <div class="flex items-center">
            <div class="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px]">✓</div>
            <span class="ml-1 text-green-400">已下单</span>
          </div>
          <div class="h-px w-8 bg-gray-600"></div>
          <div class="flex items-center" :class="order.status === 'pending' ? 'opacity-40' : ''">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
              :class="order.status === 'cancelled' ? 'bg-red-600' : (order.status !== 'pending' ? 'bg-green-600' : 'bg-gray-600')">
              {{ order.status === 'cancelled' ? '✕' : (order.status !== 'pending' ? '✓' : '○') }}
            </div>
            <span class="ml-1" :class="order.status === 'cancelled' ? 'text-red-400' : 'text-gray-400'">
              {{ order.status === 'cancelled' ? '已取消' : '已付款' }}
            </span>
          </div>
          <div class="h-px w-8 bg-gray-600" :class="{ 'opacity-30': !['shipped', 'completed'].includes(order.status) }"></div>
          <div class="flex items-center" :class="{ 'opacity-40': !['shipped', 'completed'].includes(order.status) }">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
              :class="['shipped', 'completed'].includes(order.status) ? 'bg-green-600' : 'bg-gray-600'">
              {{ ['shipped', 'completed'].includes(order.status) ? '✓' : '○' }}
            </div>
            <span class="ml-1 text-gray-400">已发货</span>
          </div>
          <div class="h-px w-8 bg-gray-600" :class="{ 'opacity-30': order.status !== 'completed' }"></div>
          <div class="flex items-center" :class="{ 'opacity-40': order.status !== 'completed' }">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]"
              :class="order.status === 'completed' ? 'bg-green-600' : 'bg-gray-600'">
              {{ order.status === 'completed' ? '✓' : '○' }}
            </div>
            <span class="ml-1 text-gray-400">已完成</span>
          </div>
        </div>

        <!-- 时间信息 -->
        <div class="mt-3 text-xs text-gray-500 space-y-1">
          <div>下单时间：{{ formatTime(order.createdAt) }}</div>
          <div v-if="order.paidAt">付款时间：{{ formatTime(order.paidAt) }}</div>
          <div v-if="order.shippedAt">发货时间：{{ formatTime(order.shippedAt) }}</div>
          <div v-if="order.completedAt">完成时间：{{ formatTime(order.completedAt) }}</div>
          <div v-if="order.cancelledAt">取消时间：{{ formatTime(order.cancelledAt) }}</div>
        </div>
      </div>

      <!-- ===== 商品列表 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">📦 商品信息</h2>
        <div v-for="item in order.items" :key="item.id" class="flex items-center gap-4 py-3 border-b border-[#1A2D4A] last:border-0">
          <div class="w-16 h-16 shrink-0 bg-[#13233E] rounded-lg overflow-hidden flex items-center justify-center">
            <img v-if="item.productCover" :src="item.productCover" :alt="item.productName" class="w-full h-full object-cover" />
            <span v-else class="text-xl text-gray-600">📦</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white truncate">{{ item.productName }}</div>
            <div class="text-xs text-gray-500">¥{{ item.price.toFixed(2) }} x {{ item.quantity }}</div>
          </div>
          <div class="text-sm font-bold text-red-400">¥{{ item.subtotal.toFixed(2) }}</div>
        </div>
      </section>

      <!-- ===== 收货信息 ===== -->
      <section v-if="order.addressName" class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">📍 收货信息</h2>
        <div class="text-sm text-white">{{ order.addressName }} <span class="text-gray-500 ml-2">{{ order.addressPhone }}</span></div>
        <div class="text-xs text-gray-400 mt-1">{{ order.addressFull }}</div>
      </section>

      <!-- ===== 物流信息 ===== -->
      <section v-if="order.trackingNo" class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">🚚 物流信息</h2>
        <div class="text-sm text-gray-300">快递单号：{{ order.trackingNo }}</div>
      </section>

      <!-- ===== 价格明细 ===== -->
      <section class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-3">💰 价格明细</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-gray-400">
            <span>商品总额</span>
            <span>¥{{ order.totalAmount.toFixed(2) }}</span>
          </div>
          <div v-if="order.discountAmount > 0" class="flex justify-between text-green-400">
            <span>优惠减免</span>
            <span>-¥{{ order.discountAmount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-white font-semibold border-t border-[#1A2D4A] pt-2 mt-2">
            <span>实付金额</span>
            <span class="text-lg font-bold text-red-400">¥{{ order.payAmount.toFixed(2) }}</span>
          </div>
        </div>
      </section>

      <!-- ===== 备注 ===== -->
      <section v-if="order.remark" class="bg-[#0D1B33] rounded-xl border border-[#1A2D4A] p-4">
        <h2 class="text-sm font-semibold text-white mb-2">📝 备注</h2>
        <p class="text-sm text-gray-400">{{ order.remark }}</p>
      </section>

      <!-- ===== 操作按钮 ===== -->
      <div class="flex gap-3 justify-end">
        <button v-if="order.status === 'pending'" @click="cancelOrder(order.orderNo)"
          class="border border-[#1A2D4A] text-gray-400 px-4 py-2 rounded-lg text-sm hover:border-red-500 hover:text-red-400">
          取消订单
        </button>
        <button v-if="order.status === 'pending'" @click="goPay(order.orderNo)"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm">
          去支付
        </button>
        <button v-if="['paid', 'shipped'].includes(order.status)" @click="cancelOrder(order.orderNo)"
          class="border border-[#1A2D4A] text-gray-400 px-4 py-2 rounded-lg text-sm hover:border-red-500 hover:text-red-400">
          取消订单
        </button>
        <button v-if="order.status === 'shipped'" @click="confirmReceive(order.orderNo)"
          class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm">
          确认收货
        </button>
      </div>
    </div>

    <div v-else class="text-center py-20 text-gray-500">订单不存在</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const order = ref<any>(null)
const loading = ref(true)

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

async function fetchOrder() {
  try {
    const res = await authFetch(`/api/mall/orders/${route.params.orderNo}`)
    if (res?.success) order.value = res.data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function goPay(orderNo: string) { router.push(`/mall/pay/${orderNo}`) }

async function cancelOrder(orderNo: string) {
  if (!confirm('确定取消订单？')) return
  try {
    const res = await authFetch(`/api/mall/orders/${orderNo}/cancel`, { method: 'PUT' })
    if (res?.success) fetchOrder()
  } catch (e: any) { alert(e?.data?.error || '取消失败') }
}

async function confirmReceive(orderNo: string) {
  if (!confirm('确定已收到商品？')) return
  try {
    const res = await authFetch(`/api/mall/orders/${orderNo}/confirm`, { method: 'POST' })
    if (res?.success) fetchOrder()
  } catch (e: any) { alert(e?.data?.error || '确认收货失败') }
}

onMounted(fetchOrder)
</script>
