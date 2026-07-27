<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div>
      <h1 class="text-xl font-bold text-white">收入分析</h1>
      <p class="text-sm text-gray-400 mt-1">AI新媒体运营部门核心商业指标</p>
    </div>

    <!-- 收入总览 -->
    <div class="grid grid-cols-5 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">¥{{ (overview.mrr || 0).toLocaleString() }}</div>
        <div class="text-xs text-gray-400 mt-1">MRR 月经常性收入</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-blue-400">¥{{ (overview.arr || 0).toLocaleString() }}</div>
        <div class="text-xs text-gray-400 mt-1">ARR 年经常性收入</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ overview.activeSubscriptions || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">活跃订阅</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-purple-400">{{ overview.newSubscriptionsThisMonth || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">本月新增</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-red-400">{{ overview.churnThisMonth || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">本月流失</div>
      </div>
    </div>

    <!-- 转化漏斗 + TTFV -->
    <div class="grid grid-cols-2 gap-6">
      <!-- 转化漏斗 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">Beta 转化漏斗</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else class="space-y-2">
          <div
            v-for="item in funnelData.funnel"
            :key="item.stage"
            class="flex items-center gap-3"
          >
            <div class="w-28 text-xs text-gray-400 truncate">{{ stageLabel(item.stage) }}</div>
            <div class="flex-1 h-5 bg-[#1A2240] rounded overflow-hidden">
              <div
                class="h-full bg-blue-500/40"
                :style="{ width: Math.min(item.rate, 100) + '%' }"
              ></div>
            </div>
            <div class="w-16 text-xs text-gray-300 text-right">{{ item.count }} ({{ item.rate }}%)</div>
          </div>
        </div>
      </div>

      <!-- TTFV 分析 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">TTFV 分析</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-2xl font-bold text-green-400">{{ ttfvData.averageTTFV || 0 }}分</div>
              <div class="text-xs text-gray-400">平均 TTFV</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-blue-400">{{ ttfvData.medianTTFV || 0 }}分</div>
              <div class="text-xs text-gray-400">中位数 TTFV</div>
            </div>
          </div>
          <div v-if="ttfvData.fastest" class="text-xs text-gray-400">
            最快: <span class="text-green-400">{{ ttfvData.fastest.ttfvMinutes }}分</span>
          </div>
          <div v-if="ttfvData.slowest" class="text-xs text-gray-400">
            最慢: <span class="text-red-400">{{ ttfvData.slowest.ttfvMinutes }}分</span>
          </div>
          <div v-if="!ttfvData.fastest" class="text-xs text-gray-500">
            暂无完成的 TTFV 数据
          </div>
        </div>
      </div>
    </div>

    <!-- 套餐分析 + 流失风险 -->
    <div class="grid grid-cols-2 gap-6">
      <!-- 套餐分析 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">套餐分析</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else class="space-y-3">
          <div
            v-for="plan in plansData"
            :key="plan.name"
            class="flex items-center justify-between p-3 bg-[#1A2240]/40 rounded-lg"
          >
            <div class="text-sm text-white">{{ plan.name }}</div>
            <div class="flex gap-4 text-xs">
              <span class="text-gray-400">{{ plan.subscriberCount }} 企业</span>
              <span class="text-green-400">¥{{ (plan.mrrContribution / 100).toFixed(0) }}/月</span>
            </div>
          </div>
          <div v-if="plansData.length === 0" class="text-xs text-gray-500 text-center py-4">
            暂无订阅数据
          </div>
        </div>
      </div>

      <!-- 流失风险 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h3 class="text-sm font-medium text-white mb-4">流失风险预警</h3>
        <div v-if="loading" class="text-xs text-gray-500">加载中...</div>
        <div v-else class="space-y-2">
          <div
            v-for="item in churnData.highRisk"
            :key="'h-' + item.organizationId"
            class="p-3 bg-red-900/10 border border-red-800/20 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-white">{{ item.organizationName }}</span>
              <span class="text-xs text-red-400">{{ item.daysRemaining }}天后到期</span>
            </div>
            <div class="text-xs text-gray-400 mt-1">{{ item.riskReason }}</div>
          </div>
          <div
            v-for="item in churnData.mediumRisk"
            :key="'m-' + item.organizationId"
            class="p-3 bg-yellow-900/10 border border-yellow-800/20 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-white">{{ item.organizationName }}</span>
              <span class="text-xs text-yellow-400">{{ item.daysRemaining }}天后到期</span>
            </div>
          </div>
          <div v-if="churnData.highRisk.length === 0 && churnData.mediumRisk.length === 0" class="text-xs text-gray-500 text-center py-4">
            暂无流失风险
          </div>
        </div>
      </div>
    </div>

    <!-- 关键比率 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
      <h3 class="text-sm font-medium text-white mb-3">关键比率</h3>
      <div class="grid grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-lg font-bold text-blue-400">{{ overview.conversionRate || 0 }}%</div>
          <div class="text-xs text-gray-400">Beta→付费转化</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-red-400">{{ overview.churnRate || 0 }}%</div>
          <div class="text-xs text-gray-400">月流失率</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-white">{{ overview.totalOrganizations || 0 }}</div>
          <div class="text-xs text-gray-400">总企业数</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-white">{{ overview.totalSubscriptions || 0 }}</div>
          <div class="text-xs text-gray-400">总订阅数</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const overview = ref<any>({})
const funnelData = ref<any>({ funnel: [] })
const ttfvData = ref<any>({})
const plansData = ref<any[]>([])
const churnData = ref<any>({ highRisk: [], mediumRisk: [], lowRisk: [] })

const stageLabel = (stage: string) => {
  const map: any = {
    'enterprise.lifecycle.signup': '注册',
    'enterprise.lifecycle.pricing_viewed': '浏览套餐',
    'enterprise.lifecycle.payment_created': '创建订单',
    'enterprise.lifecycle.payment_success': '支付成功',
    'enterprise.lifecycle.subscription_active': '订阅激活',
    'enterprise.employee.created': '创建AI员工',
    'enterprise.employee.first_task_started': '首次任务',
    'enterprise.employee.first_outcome_created': '首次价值',
  }
  return map[stage] || stage
}

const fetchAll = async () => {
  loading.value = true
  try {
    const token = getAdminToken()
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const [overviewRes, funnelRes, ttfvRes, plansRes, churnRes] = await Promise.all([
      fetch('/api/admin/enterprise/revenue/overview', { headers }),
      fetch('/api/admin/enterprise/revenue/funnel', { headers }),
      fetch('/api/admin/enterprise/revenue/ttfv', { headers }),
      fetch('/api/admin/enterprise/revenue/plans', { headers }),
      fetch('/api/admin/enterprise/revenue/churn-risk', { headers }),
    ])

    overview.value = (await overviewRes.json())?.data || {}
    funnelData.value = (await funnelRes.json())?.data || { funnel: [] }
    ttfvData.value = (await ttfvRes.json())?.data || {}
    plansData.value = (await plansRes.json())?.data || []
    churnData.value = (await churnRes.json())?.data || { highRisk: [], mediumRisk: [], lowRisk: [] }
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAll()
})
</script>
