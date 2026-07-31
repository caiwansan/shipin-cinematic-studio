<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">📊 核心经营指标</h3>
      <span class="text-[9px] text-gray-600">CEO 视角 · 真实 DB 聚合</span>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <MetricCard label="用户总量" icon="👥" :value="m?.users.total" color="#60a5fa"
        :sub="`今日 +${m?.users.todayNew ?? 0} · 本周 +${m?.users.weekNew ?? 0}`"
        :sub-highlight="`7日增长 ${m?.users.growthRate7d ?? 0}%`" :loading="loading" />
      <MetricCard label="活跃用户 DAU" icon="🔥" :value="m?.users.dau" color="#f97316"
        :sub="`7日活跃 ${m?.users.active7 ?? 0}`"
        :sub-highlight="`30日 ${m?.users.active30 ?? 0}`" :loading="loading" />
      <MetricCard label="VIP 会员" icon="💎" :value="m?.vip?.total" color="#fbbf24"
        :sub="`企业版 ${(m?.vip?.total ?? 0)} 位会员`"
        :sub-highlight="`本月 +${m?.vip?.monthNew ?? 0}`" :loading="loading" />
      <MetricCard label="企业客户" icon="🏢" :value="m?.enterprises?.total" color="#34d399"
        :sub="`活跃 ${m?.enterprises?.active ?? 0} 家`"
        :sub-highlight="`订阅 ${m?.enterprises?.subscriptions ?? 0}`" :loading="loading" />
      <MetricCard label="AI 员工" icon="🤖" :value="m?.agents?.total" color="#a78bfa"
        :sub="`运行中 ${m?.agents?.active ?? 0} 个`"
        :sub-highlight="`本月调用 ${fmt(m?.ai?.monthCalls)}`" :loading="loading" />
      <MetricCard label="累计收入" icon="💰" :value="`¥${fmtMoney(m?.revenue?.total)}`" color="#22d3ee"
        :sub="`本月 ¥${fmtMoney(m?.revenue?.month)}`"
        :sub-highlight="`年 ¥${fmtMoney(m?.revenue?.year)}`" :loading="loading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MetricCard from '~/components/admin/dashboard/MetricCard.vue'

defineProps<{
  m: any
  loading?: boolean
}>()

const fmt = (n: any) => (n == null ? '0' : Number(n).toLocaleString('zh-CN'))
const fmtMoney = (n: any) => {
  const v = Number(n || 0)
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e4) return (v / 1e4).toFixed(1) + 'w'
  return v.toFixed(0)
}
</script>
