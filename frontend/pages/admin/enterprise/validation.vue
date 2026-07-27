<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">客户验证看板</h1>
        <p class="text-sm text-gray-400 mt-1">Beta Customer Validation — 企业购买→使用→价值→续费</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">Beta Active</span>
        <button @click="fetchAll" class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">刷新</button>
      </div>
    </div>

    <!-- 核心指标 -->
    <div class="grid grid-cols-6 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ overview.enterprises?.total || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">注册企业</div>
        <div class="text-xs text-green-400 mt-1">+{{ overview.enterprises?.new7d || 0 }} 本周</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-blue-400">{{ overview.subscriptions?.active || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">活跃订阅</div>
        <div class="text-xs text-yellow-400 mt-1">{{ overview.subscriptions?.pending || 0 }} 待支付</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-purple-400">{{ overview.employees?.total || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">AI 员工</div>
        <div class="text-xs text-green-400 mt-1">{{ overview.employees?.active || 0 }} 活跃</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">{{ overview.outcomes?.total || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">业务结果</div>
        <div class="text-xs text-green-400 mt-1">{{ overview.outcomes?.verified || 0 }} 已验证</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-emerald-400">¥{{ Math.round((overview.revenue?.totalCents || 0) / 100).toLocaleString() }}</div>
        <div class="text-xs text-gray-400 mt-1">总收入</div>
        <div class="text-xs text-gray-500 mt-1">累计</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-orange-400">{{ conversionRate }}%</div>
        <div class="text-xs text-gray-400 mt-1">注册→订阅</div>
        <div class="text-xs text-gray-500 mt-1">转化率</div>
      </div>
    </div>

    <!-- 漏斗 + 趋势 -->
    <div class="grid grid-cols-3 gap-6">
      <!-- 转化漏斗 -->
      <div class="col-span-1 bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">企业漏斗</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else class="space-y-2">
          <div v-for="item in funnelData.funnel" :key="item.key" class="flex items-center gap-2">
            <div class="w-20 text-xs text-gray-400 truncate">{{ item.label }}</div>
            <div class="flex-1 h-5 bg-[#1A2240] rounded overflow-hidden">
              <div class="h-full bg-blue-500/40" :style="{ width: Math.min(item.rate, 100) + '%' }"></div>
            </div>
            <div class="w-14 text-xs text-gray-300 text-right">{{ item.count }}</div>
            <div class="w-10 text-xs text-gray-500 text-right">{{ item.rate }}%</div>
          </div>
        </div>
      </div>

      <!-- 每日趋势 -->
      <div class="col-span-2 bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">30 日趋势</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else class="flex items-end gap-1 h-32">
          <div v-for="(d, i) in trendData.trends" :key="i" class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full flex flex-col items-center gap-0.5">
              <div class="w-full bg-blue-500/30 rounded-t" :style="{ height: Math.max(trendHeight(d.enterprises), 2) + 'px' }" :title="d.enterprises + ' 企业'"></div>
              <div class="w-full bg-green-500/30 rounded-t" :style="{ height: Math.max(trendHeight(d.subscriptions), 2) + 'px' }" :title="d.subscriptions + ' 订阅'"></div>
              <div class="w-full bg-purple-500/30 rounded-t" :style="{ height: Math.max(trendHeight(d.outcomes), 2) + 'px' }" :title="d.outcomes + ' 结果'"></div>
            </div>
            <div v-if="i % 5 === 0" class="text-[9px] text-gray-500">{{ d.date.slice(5) }}</div>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-500/30 rounded"></span>企业</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-green-500/30 rounded"></span>订阅</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-purple-500/30 rounded"></span>结果</span>
        </div>
      </div>
    </div>

    <!-- AI 员工排行 + 企业健康度 -->
    <div class="grid grid-cols-2 gap-6">
      <!-- AI 员工价值排行 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">AI 员工价值排行</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else-if="!rankingData.ranking?.length" class="text-xs text-gray-500">暂无数据</div>
        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div v-for="emp in rankingData.ranking" :key="emp.rank" class="flex items-center gap-3 p-2 rounded hover:bg-[#1A2240]/50">
            <div class="w-6 text-center text-xs font-bold" :class="emp.rank <= 3 ? 'text-yellow-400' : 'text-gray-500'">{{ emp.rank }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-xs text-white truncate">{{ emp.name }}</div>
              <div class="text-[10px] text-gray-500">{{ emp.role }} · {{ emp.organizationId?.slice(0, 8) }}...</div>
            </div>
            <div class="text-xs text-green-400">{{ emp.outcomeCount }} 结果</div>
          </div>
        </div>
      </div>

      <!-- 企业健康度 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">企业健康度</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else>
          <div class="grid grid-cols-4 gap-2 mb-4">
            <div class="text-center">
              <div class="text-lg font-bold text-green-400">{{ healthData.summary?.healthy || 0 }}</div>
              <div class="text-[10px] text-gray-500">健康</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-yellow-400">{{ healthData.summary?.atRisk || 0 }}</div>
              <div class="text-[10px] text-gray-500">风险</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-gray-400">{{ healthData.summary?.dormant || 0 }}</div>
              <div class="text-[10px] text-gray-500">休眠</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-red-400">{{ healthData.summary?.churned || 0 }}</div>
              <div class="text-[10px] text-gray-500">流失</div>
            </div>
          </div>
          <div class="space-y-1 max-h-40 overflow-y-auto">
            <div v-for="h in healthData.health?.slice(0, 10)" :key="h.id" class="flex items-center gap-2 text-xs">
              <span class="w-2 h-2 rounded-full" :class="healthColor(h.status)"></span>
              <span class="flex-1 text-gray-300 truncate">{{ h.name }}</span>
              <span class="text-gray-500">{{ h.employeeCount }}员工</span>
              <span class="text-gray-500">{{ h.outcomeCount }}结果</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 转化案例 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
      <h3 class="text-sm font-medium text-white mb-4">潜在 Case Study</h3>
      <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
      <div v-else-if="!casesData.cases?.length" class="text-xs text-gray-500">暂无已验证的 Outcome 案例</div>
      <div v-else class="grid grid-cols-2 gap-3">
        <div v-for="c in casesData.cases" :key="c.id" class="p-3 bg-[#1A2240]/50 rounded-lg">
          <div class="text-xs text-white font-medium">{{ c.organizationName }}</div>
          <div class="text-[10px] text-gray-400 mt-1">{{ c.outcomeType }} · {{ c.createdAt?.slice(0, 10) }}</div>
          <div class="text-xs text-gray-300 mt-2 line-clamp-2">{{ c.description || '无描述' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const overview = ref<any>({})
const funnelData = ref<any>({ funnel: [] })
const trendData = ref<any>({ trends: [] })
const rankingData = ref<any>({ ranking: [] })
const healthData = ref<any>({ health: [], summary: {} })
const casesData = ref<any>({ cases: [] })

const conversionRate = computed(() => {
  const enterprises = overview.value.enterprises?.total || 0
  const subscriptions = overview.value.subscriptions?.active || 0
  if (!enterprises) return 0
  return Math.round((subscriptions / enterprises) * 100)
})

function trendHeight(val: number): number {
  const maxVal = Math.max(...trendData.value.trends.map((d: any) => Math.max(d.enterprises, d.subscriptions, d.outcomes)), 1)
  return (val / maxVal) * 80
}

function healthColor(status: string): string {
  const map: Record<string, string> = {
    healthy: 'bg-green-400',
    at_risk: 'bg-yellow-400',
    dormant: 'bg-gray-400',
    churned: 'bg-red-400',
  }
  return map[status] || 'bg-gray-500'
}

async function fetchAll() {
  loading.value = true
  try {
    const token = getAdminToken()
    const headers = { Authorization: `Bearer ${token}` }
    const [overviewRes, funnelRes, trendRes, rankingRes, healthRes, casesRes] = await Promise.all([
      fetch('/api/admin/enterprise/validation/overview', { headers }),
      fetch('/api/admin/enterprise/validation/funnel', { headers }),
      fetch('/api/admin/enterprise/validation/trend', { headers }),
      fetch('/api/admin/enterprise/validation/employee-ranking', { headers }),
      fetch('/api/admin/enterprise/validation/health', { headers }),
      fetch('/api/admin/enterprise/validation/case-studies', { headers }),
    ])
    overview.value = (await overviewRes.json())?.data || {}
    funnelData.value = (await funnelRes.json())?.data || { funnel: [] }
    trendData.value = (await trendRes.json())?.data || { trends: [] }
    rankingData.value = (await rankingRes.json())?.data || { ranking: [] }
    healthData.value = (await healthRes.json())?.data || { health: [], summary: {} }
    casesData.value = (await casesRes.json())?.data || { cases: [] }
  } catch (err) {
    console.error('Failed to fetch validation data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)
</script>
