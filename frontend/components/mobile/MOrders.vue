<template>
  <MPageShell title="我的订单" @close="$emit('close')">
    <div class="mo-tabs">
      <span v-for="t in tabs" :key="t" class="mo-tab" :class="{ on: tab === t }" @click="tab = t; load()">{{ t }}</span>
    </div>
    <div v-if="!orders.length" class="mo-empty">{{ loading ? '加载中…' : '暂无订单' }}</div>
    <div v-for="o in filtered" :key="o.id" class="mo-card">
      <div class="mo-head">
        <span class="mo-type">{{ o.typeLabel || typeLabel(o.type) }}</span>
        <span class="mo-status" :class="'s-' + o.status">{{ o.statusLabel || statusLabel(o.status) }}</span>
      </div>
      <div class="mo-row"><span class="mo-k">订单号</span><span class="mo-v">{{ o.orderNo || o.id }}</span></div>
      <div class="mo-row"><span class="mo-k">金额</span><span class="mo-v">¥{{ Number(o.amount || 0).toFixed(2) }}</span></div>
      <div class="mo-row"><span class="mo-k">时间</span><span class="mo-v">{{ (o.createdAt || '').slice(0, 19).replace('T', ' ') }}</span></div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, computed, onMounted } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const tabs = ['全部', '待支付', '已支付', '已取消']
const tab = ref('全部')
const orders = ref<any[]>([])
const loading = ref(true)

const filtered = computed(() => {
  if (tab.value === '全部') return orders.value
  return orders.value.filter((o) => statusLabel(o.status) === tab.value)
})

function typeLabel(t?: string) {
  const map: Record<string, string> = { recharge: '充值', vip: 'VIP', order: '订单' }
  return map[t || ''] || t || '订单'
}
function statusLabel(s?: string) {
  const map: Record<string, string> = { pending: '待支付', paid: '已支付', success: '已支付', completed: '已完成', cancelled: '已取消', canceled: '已取消', failed: '失败' }
  return map[s || ''] || s || ''
}

async function load() {
  loading.value = true
  try {
    const r = await mobileAuthFetch('/api/user/orders')
    const j = await r.json()
    orders.value = j.data?.orders || []
  } catch { orders.value = [] } finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.mo-tabs { display: flex; gap: 6px; background: #fff; border-radius: 10px; padding: 6px; margin-bottom: 10px; }
.mo-tab { flex: 1; text-align: center; padding: 8px 0; font-size: 13px; border-radius: 8px; color: #666; }
.mo-tab.on { background: #4f7df9; color: #fff; font-weight: 600; }
.mo-empty { text-align: center; color: #999; padding: 40px 0; font-size: 14px; }
.mo-card { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.mo-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.mo-type { font-size: 14px; font-weight: 600; }
.mo-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #f2f3f5; color: #666; }
.mo-status.s-paid, .mo-status.s-success, .mo-status.s-completed { background: #e8f8ee; color: #22c55e; }
.mo-status.s-cancelled, .mo-status.s-canceled, .mo-status.s-failed { background: #fdeaea; color: #e5484d; }
.mo-status.s-pending { background: #fff5e0; color: #d97706; }
.mo-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.mo-k { color: #999; }
.mo-v { color: #333; }
</style>
