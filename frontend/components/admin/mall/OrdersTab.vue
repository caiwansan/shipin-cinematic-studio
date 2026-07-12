<template>
  <div class="space-y-4">
    <!-- 搜索 + 筛选 -->
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
        <input v-model="localSearch" type="text" placeholder="搜索订单号/收件人/电话..."
          class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none focus:border-blue-500/50 w-64"
          @keyup.enter="$emit('search')" />
        <button @click="$emit('search')"
          class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">搜索</button>
      </div>
      <div class="flex gap-1">
        <button v-for="s in statusFilters" :key="s.value" @click="$emit('filterStatus', s.value)"
          class="px-2.5 py-1 rounded-lg text-[10px] border-none cursor-pointer transition"
          :class="localStatus === s.value ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300 bg-transparent'">
          {{ s.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">{{ error }}</div>

    <template v-else>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">订单号</th>
              <th class="text-left px-4 py-3 font-medium">收件人</th>
              <th class="text-left px-4 py-3 font-medium">金额</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">下单时间</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in orders" :key="o.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-gray-400 font-mono text-[10px]">{{ (o.orderNo || o.id || '').substring(0, 16) }}...</td>
              <td class="px-4 py-3 text-white/80">{{ o.addressName || '—' }}</td>
              <td class="px-4 py-3 text-white/90">¥{{ o.totalAmount || o.amount || 0 }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]" :class="statusBadge(o.status)">
                  {{ statusLabel(o.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ formatDate(o.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <button @click="$emit('viewDetail', o.orderNo || o.id)"
                    class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-600/30 transition cursor-pointer border-none">详情</button>
                  <button v-if="o.status === 'paid'" @click="$emit('openShip', o.orderNo || o.id)"
                    class="px-2 py-1 bg-green-600/20 text-green-400 rounded-lg text-[10px] hover:bg-green-600/30 transition cursor-pointer border-none">发货</button>
                  <button v-if="o.status === 'pending' || o.status === 'paid'" @click="$emit('cancel', o.orderNo || o.id)"
                    class="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px] hover:bg-red-600/30 transition cursor-pointer border-none">取消</button>
                  <button v-if="o.status === 'paid' || o.status === 'shipped'" @click="$emit('refund', o.orderNo || o.id)"
                    class="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg text-[10px] hover:bg-yellow-600/30 transition cursor-pointer border-none">退款</button>
                </div>
              </td>
            </tr>
            <tr v-if="orders.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-gray-600">暂无订单</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between text-[10px] text-gray-600">
        <span>共 {{ total }} 条订单，第 {{ page }}/{{ totalPages }} 页</span>
        <div class="flex gap-2">
          <button @click="$emit('prevOrderPage')" :disabled="page <= 1"
            class="px-3 py-1 rounded border border-[#1A2240] text-gray-500 hover:text-white/70 disabled:opacity-30 cursor-pointer disabled:cursor-default bg-transparent text-[11px]">上一页</button>
          <button @click="$emit('nextOrderPage')" :disabled="page >= totalPages"
            class="px-3 py-1 rounded border border-[#1A2240] text-gray-500 hover:text-white/70 disabled:opacity-30 cursor-pointer disabled:cursor-default bg-transparent text-[11px]">下一页</button>
        </div>
      </div>
    </template>

    <!-- Order Detail Modal -->
    <Transition name="modal-fade">
      <div v-if="detail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="$emit('closeDetail')">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[560px] max-h-[90vh] overflow-y-auto shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">订单详情</h3>
          <div class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div><span class="text-gray-500">订单号：</span><span class="text-white/70">{{ detail.orderNo || detail.id }}</span></div>
              <div><span class="text-gray-500">状态：</span><span class="px-2 py-0.5 rounded-full text-[10px]" :class="statusBadge(detail.status)">{{ statusLabel(detail.status) }}</span></div>
              <div><span class="text-gray-500">金额：</span><span class="text-white/80">¥{{ detail.totalAmount || detail.amount || 0 }}</span></div>
              <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatDate(detail.createdAt) }}</span></div>
            </div>
            <div class="border-t border-[#1A2240] pt-3 mt-3">
              <div class="text-gray-500 mb-2">收货信息</div>
              <div class="grid grid-cols-3 gap-2 text-white/70">
                <div>{{ detail.addressName || '—' }}</div>
                <div>{{ detail.addressPhone || '—' }}</div>
                <div class="col-span-3">{{ detail.addressDetail || detail.address || '—' }}</div>
              </div>
            </div>
            <div v-if="detail.trackingNo" class="border-t border-[#1A2240] pt-3 mt-3">
              <div class="text-gray-500 mb-1">物流单号：<span class="text-white/70">{{ detail.trackingNo }}</span></div>
            </div>
            <div class="border-t border-[#1A2240] pt-3 mt-3">
              <div class="text-gray-500 mb-2">商品明细</div>
              <div v-for="item in detail.items" :key="item.id" class="flex items-center gap-3 py-2 border-b border-[#1A2240]/50 last:border-0">
                <img v-if="item.product?.cover" :src="item.product.cover" class="w-10 h-10 rounded object-cover" />
                <div class="flex-1">
                  <div class="text-white/80">{{ item.product?.name || item.productName || '商品' }}</div>
                  <div class="text-gray-500 text-[10px]">¥{{ item.price }} x {{ item.quantity }}</div>
                </div>
                <div class="text-white/80">¥{{ (item.price || 0) * (item.quantity || 0) }}</div>
              </div>
            </div>
            <div class="flex justify-end pt-2">
              <button @click="$emit('closeDetail')"
                class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg bg-transparent cursor-pointer">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ship Form Modal -->
    <Transition name="modal-fade">
      <div v-if="showShip" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="$emit('closeShip')">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[360px] shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">填写物流单号</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">物流单号 *</label>
              <input v-model="form.trackingNo" type="text" placeholder="快递单号"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div class="flex gap-2 justify-end pt-2">
              <button @click="$emit('closeShip')"
                class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg bg-transparent cursor-pointer">取消</button>
              <button @click="$emit('ship')"
                class="px-4 py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer border-none">确认发货</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loading: boolean
  error: string
  orders: any[]
  total: number
  page: number
  totalPages: number
  orderSearch: string
  orderStatus: string
  detail: any
  showShip: boolean
  shipForm: any
}>()

const emit = defineEmits<{
  search: []
  prevOrderPage: []
  nextOrderPage: []
  filterStatus: [s: string]
  viewDetail: [orderNo: string]
  openShip: [orderNo: string]
  ship: []
  cancel: [orderNo: string]
  refund: [orderNo: string]
  closeDetail: []
  closeShip: []
}>()

const localSearch = defineModel<string>('orderSearch')
const localStatus = defineModel<string>('orderStatus')

const statusFilters = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: '待支付', paid: '已支付', shipped: '已发货',
    completed: '已完成', cancelled: '已取消', refunding: '退款中',
  }
  return map[s] || s
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    paid: 'bg-blue-500/10 text-blue-400',
    shipped: 'bg-purple-500/10 text-purple-400',
    completed: 'bg-green-500/10 text-green-400',
    cancelled: 'bg-gray-500/10 text-gray-400',
    refunding: 'bg-red-500/10 text-red-400',
  }
  return map[s] || 'bg-gray-500/10 text-gray-400'
}

function formatDate(d: string | Date) {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
