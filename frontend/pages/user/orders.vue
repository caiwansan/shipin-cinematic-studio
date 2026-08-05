<template>
  <div class="orders-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/user/center')">← 会员中心</button>
      <h1>我的订单</h1>
      <p class="page-sub">充值 · VIP · 消费记录</p>
    </div>

    <div class="page-body">
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="!orders.length" class="empty">暂无订单记录</div>
      <div v-else class="orders-list">
        <div v-for="o in orders" :key="o.id" class="order-row">
          <div class="order-icon" :class="`order-icon--${o.type}`">
            {{ o.type === 'vip' ? '👑' : '💎' }}
          </div>
          <div class="order-info">
            <div class="order-title">
              {{ o.typeLabel }}
              <span class="order-no">{{ o.orderNo }}</span>
            </div>
            <div class="order-time">{{ formatTime(o.createdAt) }}</div>
          </div>
          <div class="order-right">
            <div class="order-amount">¥{{ (o.amount || 0).toFixed(2) }}</div>
            <div class="order-status" :class="`order-status--${o.status}`">{{ o.statusLabel }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const token = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }

const orders = ref<any[]>([])
const loading = ref(true)

function formatTime(t: string) {
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return t || '' }
}

onMounted(async () => {
  try {
    const res = await fetch('/api/user/orders', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const data = await res.json()
      orders.value = data.data?.orders || []
    }
  } catch (e) {
    console.warn('[Orders] failed', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  background: #0B1320;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  padding: 24px;
  box-sizing: border-box;
}
.page-header { max-width: 720px; margin: 0 auto 24px; }
.back-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
  padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; margin-bottom: 16px;
}
.back-btn:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
.page-header h1 { font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0 0 6px; }
.page-sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0; }
.page-body { max-width: 720px; margin: 0 auto; }
.empty { padding: 60px; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.85rem; }

.orders-list {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  overflow: hidden;
}
.order-row {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.order-row:last-child { border-bottom: none; }
.order-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; flex-shrink: 0;
}
.order-icon--vip { background: rgba(245,158,11,0.12); }
.order-icon--credit { background: rgba(59,130,246,0.12); }
.order-icon--recharge { background: rgba(16,185,129,0.12); }
.order-info { flex: 1; min-width: 0; }
.order-title { font-size: 0.88rem; font-weight: 600; color: #e0e0e0; margin-bottom: 3px; }
.order-no { font-size: 0.68rem; color: rgba(255,255,255,0.3); margin-left: 6px; font-weight: 400; }
.order-time { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
.order-right { text-align: right; flex-shrink: 0; }
.order-amount { font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 3px; }
.order-status { font-size: 0.7rem; padding: 2px 8px; border-radius: 6px; display: inline-block; }
.order-status--paid, .order-status--approved { background: rgba(52,211,153,0.12); color: #34d399; }
.order-status--pending { background: rgba(251,191,36,0.12); color: #fbbf24; }
.order-status--rejected { background: rgba(248,113,113,0.12); color: #f87171; }
.order-status--expired { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }
.order-status--refunded { background: rgba(147,51,234,0.12); color: #c084fc; }
</style>
