<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">💰 商业增长</h3>
      <span class="text-[9px] text-gray-600">PaymentOrder · Subscription</span>
    </div>

    <div v-if="!data" class="text-center py-10 text-[10px] text-gray-600">加载中...</div>

    <template v-else>
      <!-- 收入 -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">今日收入</div>
          <div class="text-base font-bold text-white/90 font-mono mt-0.5">¥{{ data.todayRevenue.toFixed(2) }}</div>
        </div>
        <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">本月收入</div>
          <div class="text-base font-bold text-white/90 font-mono mt-0.5">¥{{ data.monthRevenue.toFixed(2) }}</div>
        </div>
        <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">累计收入</div>
          <div class="text-base font-bold text-emerald-400 font-mono mt-0.5">¥{{ data.totalRevenue.toFixed(2) }}</div>
        </div>
      </div>

      <!-- 企业订阅 -->
      <div class="mb-4 px-3 py-2.5 rounded-lg bg-indigo-500/[0.05] border border-indigo-500/15">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-white/70">🏢 企业订阅</span>
          <span class="text-[9px] text-indigo-300/80 font-mono">{{ data.enterprise.active }} 活跃 / {{ data.enterprise.total }} 总</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2 text-center">
          <div class="px-2 py-1.5 rounded bg-white/[0.03]">
            <div class="text-sm font-bold text-emerald-400 font-mono">{{ data.enterprise.renewalRate }}%</div>
            <div class="text-[8px] text-gray-600 mt-0.5">续费率</div>
          </div>
          <div class="px-2 py-1.5 rounded bg-white/[0.03]">
            <div class="text-sm font-bold text-cyan-400 font-mono">{{ data.enterprise.avgLifecycleDays }}天</div>
            <div class="text-[8px] text-gray-600 mt-0.5">平均周期</div>
          </div>
          <div class="px-2 py-1.5 rounded bg-white/[0.03]">
            <div class="text-sm font-bold text-amber-400 font-mono">¥{{ data.enterprise.revenue.toFixed(0) }}</div>
            <div class="text-[8px] text-gray-600 mt-0.5">订阅收入</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <span v-for="p in data.enterprise.planBreakdown" :key="p.name"
            class="text-[9px] px-2 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/60">
            {{ p.name }} × {{ p.count }} · ¥{{ p.revenue.toFixed(0) }}
          </span>
        </div>
      </div>

      <!-- 订阅 -->
      <div class="mb-4">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">订阅 · 活跃 {{ data.subscriptions.active }} / 共 {{ data.subscriptions.total }}</div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="b in data.subscriptions.breakdown" :key="b.planCode"
            class="text-[9px] px-2 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/60">
            {{ b.planName }} × {{ b.activeCount }}
          </span>
          <span v-if="data.subscriptions.breakdown.length === 0" class="text-[9px] text-gray-600">暂无套餐订阅</span>
        </div>
      </div>

      <!-- VIP 套餐分布 -->
      <div v-if="data.memberPlans && data.memberPlans.length" class="mb-4">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">VIP 套餐</div>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="p in data.memberPlans" :key="p.level"
            class="text-[9px] px-2 py-1 rounded-full border border-amber-500/20 bg-amber-500/[0.05] text-amber-300/80">
            {{ p.name }} ¥{{ p.price }}
          </span>
        </div>
      </div>

      <!-- 转化漏斗 -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">转化漏斗</div>
        <div class="flex items-end gap-1.5 h-16">
          <div v-for="(f, i) in funnelSteps" :key="f.label" class="flex-1 flex flex-col items-center gap-1">
            <div class="text-[9px] text-white/70 font-mono">{{ f.value }}</div>
            <div class="w-full rounded-t-lg bg-gradient-to-t transition-all duration-500"
              :style="{ height: f.pct + '%', background: funnelColor(i) }"></div>
            <div class="text-[8px] text-gray-600">{{ f.label }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: any
}>()

const funnelSteps = computed(() => {
  if (!props.data) return []
  const max = Math.max(props.data.funnel.registered, 1)
  return [
    { label: '注册', value: props.data.funnel.registered, pct: (props.data.funnel.registered / max) * 100 },
    { label: '付费', value: props.data.funnel.paidUsers, pct: (props.data.funnel.paidUsers / max) * 100 },
    { label: 'VIP', value: props.data.funnel.vipUsers, pct: (props.data.funnel.vipUsers / max) * 100 },
  ]
})

const funnelColor = (i: number) => ['linear-gradient(180deg,#60a5fa,#3b82f6)', 'linear-gradient(180deg,#34d399,#10b981)', 'linear-gradient(180deg,#fbbf24,#f59e0b)'][i]
</script>
