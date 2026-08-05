<template>
  <div class="diamonds-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/user/center')">← 会员中心</button>
      <h1>我的钻石</h1>
      <p class="page-sub">充值钻石 · 收益钻石 · 消费流水</p>
    </div>

    <div class="page-body">
      <!-- 钻石总览卡 -->
      <div class="diamond-hero">
        <div class="diamond-hero-icon">💎</div>
        <div class="diamond-hero-info">
          <div class="diamond-hero-label">我的钻石</div>
          <div class="diamond-hero-value">{{ diamonds.totalDiamonds || 0 }}</div>
          <div class="diamond-hero-legend">
            <span class="legend-item"><i class="legend-dot legend-dot--recharge" />充值钻石 {{ diamonds.rechargeDiamonds || 0 }}</span>
            <span class="legend-item"><i class="legend-dot legend-dot--earn" />收益钻石 {{ diamonds.earnDiamonds || 0 }}</span>
          </div>
        </div>
        <router-link to="/user/wallet" class="exchange-btn">余额兑换 →</router-link>
      </div>

      <div class="diamond-tip">
        💡 充值钻石用于红包/礼物等消费，不可提现；收益钻石（礼物分成 65%）可兑换余额（1 钻石 = 0.1 元）
      </div>

      <!-- 钻石流水 -->
      <div class="logs-section">
        <h2 class="section-title">💎 钻石流水</h2>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!logs.length" class="empty">暂无流水记录</div>
        <div v-else class="logs-list">
          <div v-for="log in logs" :key="log.id" class="log-row">
            <div class="log-info">
              <div class="log-remark">{{ log.remark || log.type }}</div>
              <div class="log-time">{{ formatTime(log.createdAt) }}</div>
            </div>
            <div class="log-amount" :class="log.amount > 0 ? 'log-amount--plus' : 'log-amount--minus'">
              {{ log.amount > 0 ? '+' : '' }}{{ log.amount }}
            </div>
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

const diamonds = ref<any>({ totalDiamonds: 0, rechargeDiamonds: 0, earnDiamonds: 0 })
const logs = ref<any[]>([])
const loading = ref(true)

function formatTime(t: string) {
  try {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return t || '' }
}

onMounted(async () => {
  try {
    const res = await fetch('/api/user/diamonds', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const data = await res.json()
      diamonds.value = data.data || {}
      logs.value = diamonds.value.logs || []
    }
  } catch (e) {
    console.warn('[Diamonds] failed', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.diamonds-page {
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

.diamond-hero {
  display: flex; align-items: center; gap: 20px;
  padding: 28px;
  background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12));
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 16px;
  margin-bottom: 16px;
}
.diamond-hero-icon { font-size: 3rem; }
.diamond-hero-info { flex: 1; }
.diamond-hero-label { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
.diamond-hero-value { font-size: 2.4rem; font-weight: 800; color: #fff; margin-bottom: 8px; }
.diamond-hero-legend { display: flex; gap: 16px; flex-wrap: wrap; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.legend-dot--recharge { background: #60a5fa; }
.legend-dot--earn { background: #34d399; }
.exchange-btn {
  flex-shrink: 0;
  padding: 10px 18px;
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: #fff; border-radius: 10px; font-size: 0.82rem; font-weight: 600;
  text-decoration: none;
}

.diamond-tip {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.03);
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 24px;
}

.logs-section { }
.section-title { font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.55); margin: 0 0 12px; }
.empty { padding: 40px; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.85rem; }
.logs-list {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  overflow: hidden;
}
.log-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.log-row:last-child { border-bottom: none; }
.log-remark { font-size: 0.85rem; color: #e0e0e0; margin-bottom: 3px; }
.log-time { font-size: 0.7rem; color: rgba(255,255,255,0.3); }
.log-amount { font-size: 0.95rem; font-weight: 700; }
.log-amount--plus { color: #34d399; }
.log-amount--minus { color: #f87171; }
</style>
