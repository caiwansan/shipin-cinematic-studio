<template>
  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
    <!-- 用户 -->
    <MetricCard label="用户" icon="👥" :value="m?.users.total" color="#60a5fa" badge="存量"
      :sub="`窗口新增 ${fmt(w?.newUsers)}`" :sub-highlight="`DAU ${m?.users.dau}`" :loading="loading" />
    <!-- 企业 -->
    <MetricCard label="企业" icon="🏢" :value="m?.enterprises?.total" color="#34d399" badge="存量"
      :sub="`活跃 ${m?.enterprises?.active ?? 0} 家`" :sub-highlight="`订阅 ${m?.enterprises?.subscriptions ?? 0}`" :loading="loading" />
    <!-- VIP -->
    <MetricCard label="VIP" icon="💎" :value="m?.vip?.total" color="#fbbf24" badge="存量"
      :sub="`窗口新增 ${fmt(w?.vipNew ?? m?.vip?.monthNew)}`" :sub-highlight="`企业版 ${m?.vip?.total ?? 0}`" :loading="loading" />
    <!-- 收入（窗口联动） -->
    <MetricCard label="收入" icon="💰" :value="`¥${fmtMoney(w?.revenue ?? m?.revenue?.total)}`" color="#22d3ee"
      :badge="rangeLabel" badge-tone="info"
      :sub="`累计 ¥${fmtMoney(m?.revenue?.total)}`" :sub-highlight="`本月 ¥${fmtMoney(m?.revenue?.month)}`" :loading="loading" />
    <!-- AI 员工 -->
    <MetricCard label="AI员工" icon="🤖" :value="m?.agents?.total" color="#a78bfa" badge="存量"
      :sub="`运行中 ${m?.agents?.active ?? 0} 个`" :sub-highlight="`本月调用 ${fmt(m?.ai?.monthCalls)}`" :loading="loading" />
    <!-- 调用（窗口联动） -->
    <MetricCard label="调用" icon="📡" :value="fmt(w?.calls ?? m?.ai?.monthCalls)" color="#f472b6"
      :badge="rangeLabel" badge-tone="info"
      :sub="`成本 ¥${(w?.cost ?? 0).toFixed(2)}`" :sub-highlight="`Token ${fmtW(w?.tokens)}`" :loading="loading" />
  </div>
</template>

<script setup lang="ts">
import MetricCard from '~/components/admin/dashboard/MetricCard.vue'

defineProps<{
  m: any
  w?: any
  rangeLabel?: string
  loading?: boolean
}>()

const fmt = (n: any) => (n == null ? '0' : Number(n).toLocaleString('zh-CN'))
const fmtW = (n: any) => {
  const v = Number(n || 0)
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e4) return (v / 1e4).toFixed(1) + 'w'
  return fmt(v)
}
const fmtMoney = (n: any) => {
  const v = Number(n || 0)
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e4) return (v / 1e4).toFixed(1) + 'w'
  return v.toFixed(0)
}
</script>
