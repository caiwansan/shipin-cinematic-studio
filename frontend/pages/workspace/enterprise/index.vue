<!-- UX-03A: 企业招聘中心首页 -->
<!-- 位置：/workspace/enterprise/index.vue -->
<!-- 第一屏回答：今天发生了什么？需要决定什么？运行得怎么样？ -->
<!-- EP-01: 所有数字来自真实 API，不写死 -->
<!-- EP-03: Health Banner 5 秒内知道正常还是异常 -->
<!-- EP-05: 第一屏看到全部核心信息，不滚动 -->
<template>
  <div class="rec-page">
    <div class="rec-page-header">
      <div>
        <h1 class="rec-page-title">招聘中心</h1>
        <p class="rec-page-subtitle">实时掌握招聘全局</p>
      </div>
      <div class="rec-page-actions">
        <div class="rec-time-switcher">
          <button
            v-for="opt in timeOptions"
            :key="opt.value"
            :class="['rec-time-btn', { active: timeRange === opt.value }]"
            @click="timeRange = opt.value; loadData()"
          >
            {{ opt.label }}
          </button>
        </div>
        <button class="rec-refresh-btn" @click="loadData">刷新</button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="rec-loading">
      加载中...
    </div>

    <!-- No Enterprise State: 无企业成员关系 -->
    <div v-else-if="hasNoEnterprise" class="rec-empty">
      <div class="rec-empty-icon">🏢</div>
      <h2>请先创建或加入企业</h2>
      <p>{{ data?.message || '您需要创建或加入一个企业才能使用招聘中心' }}</p>
    </div>

    <!-- Empty State: 有企业但暂无数据 -->
    <div v-else-if="isEmpty" class="rec-empty">
      <div class="rec-empty-icon">📊</div>
      <h2>暂无招聘数据</h2>
      <p>企业开始招聘后，数据将自动显示在这里</p>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Health Banner: EP-03 -->
      <HealthBanner
        :status="data!.departmentHealth.status"
        :message="data!.departmentHealth.message"
        :summary="data!.departmentHealth.activeCount + ' 个 AI 员工运行中'"
      />

      <!-- 今日概览: EP-02 可点击跳转 -->
      <div class="rec-metrics-grid">
        <MetricCard
          label="今日沟通"
          :value="data!.todayMetrics.conversations"
          href="/workspace/enterprise/conversations"
        />
        <MetricCard
          label="今日面试"
          :value="data!.todayMetrics.interviews"
          href="/workspace/enterprise/interviews"
        />
        <MetricCard
          label="今日简历"
          :value="data!.todayMetrics.newResumes"
          href="/workspace/enterprise/candidates"
        />
        <MetricCard
          label="今日 Offer"
          :value="data!.todayMetrics.offers"
          href="/workspace/enterprise/interviews"
        />
      </div>

      <!-- 招聘漏斗 + 需要处理: 两栏 -->
      <div class="rec-split-row">
        <SectionCard title="招聘漏斗">
          <RecruitmentFunnel :stages="funnelStages" />
        </SectionCard>

        <SectionCard title="需要处理">
          <PendingList :items="pendingItems" />
        </SectionCard>
      </div>

      <!-- 招聘动态 -->
      <SectionCard title="招聘动态">
        <ActivityFeed :items="data!.activityFeed" />
      </SectionCard>
    </template>
  </div>
</template>

<script setup lang="ts">
// EP-01: 所有数字来自真实 API
// EP-04: 统一时间范围切换（今天/本周/本月）
// EP-05: 第一屏展示全部核心信息

interface EnterpriseHomeDTO {
  hasEnterprise?: boolean
  message?: string
  todayMetrics: { conversations: number; interviews: number; campaigns: number; newResumes: number; offers: number; hires: number }
  funnel: Array<{ label: string; value: number }>
  needsAttention: Array<{ label: string; count: number }>
  activityFeed: Array<{ time: string; text: string; type: string }>
  departmentHealth: { status: 'healthy' | 'warning' | 'critical' | 'unknown'; message: string; activeCount: number; pausedCount: number }
}

const loading = ref(true)
const data = ref<EnterpriseHomeDTO | null>(null)
const timeRange = ref<'today' | 'week' | 'month'>('today')

const timeOptions = [
  { label: '今天', value: 'today' as const },
  { label: '本周', value: 'week' as const },
  { label: '本月', value: 'month' as const },
]

const hasNoEnterprise = computed(() => data.value?.hasEnterprise === false)

const isEmpty = computed(() => {
  if (!data.value) return false
  if (data.value.hasEnterprise === false) return false
  const d = data.value
  return d.todayMetrics.conversations === 0 && d.todayMetrics.interviews === 0 && d.funnel.length === 0
})

const funnelStages = computed(() => {
  if (!data.value) return []
  return data.value.funnel
})

const pendingItems = computed(() => {
  if (!data.value) return []
  return data.value.needsAttention.map((item, i) => ({
    ...item,
    href: ['/workspace/enterprise/conversations?status=WAITING_HR_REVIEW', '/workspace/enterprise/interviews?status=PASSED', '/workspace/enterprise/interviews?status=PASSED'][i] || '/workspace/enterprise',
  }))
})

async function loadData() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/enterprise/home', { headers })
    if (res.status === 401) {
      console.warn('Auth required — redirecting to login')
      return
    }
    const json = await res.json()
    if (json.todayMetrics) {
      data.value = json as EnterpriseHomeDTO
    }
  } catch (e) {
    console.error('Failed to load enterprise home:', e)
  } finally {
    loading.value = false
  }
}

// 自动刷新（PB-04: 不打断用户，默默更新）
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadData()
  refreshTimer = setInterval(loadData, 60000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
@import '~/assets/styles/recruitment-tokens.css';

.rec-page {
  padding: var(--rec-space-8);
  max-width: 1100px;
  margin: 0 auto;
}

.rec-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--rec-space-8);
}

.rec-page-title {
  font-size: var(--rec-text-2xl);
  font-weight: 700;
  color: var(--rec-text-primary);
  margin: 0;
}

.rec-page-subtitle {
  font-size: var(--rec-text-md);
  color: var(--rec-text-secondary);
  margin: var(--rec-space-1) 0 0;
}

.rec-page-actions {
  display: flex;
  gap: var(--rec-space-3);
  align-items: center;
}

.rec-time-switcher {
  display: flex;
  background: var(--rec-bg-tertiary);
  border-radius: var(--rec-radius-md);
  padding: 2px;
}

.rec-time-btn {
  padding: var(--rec-space-2) var(--rec-space-4);
  border: none;
  background: transparent;
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
  border-radius: var(--rec-radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.rec-time-btn.active {
  background: var(--rec-bg-secondary);
  color: var(--rec-text-primary);
  font-weight: 500;
  box-shadow: var(--rec-shadow-sm);
}

.rec-refresh-btn {
  padding: var(--rec-space-2) var(--rec-space-4);
  border: 1px solid var(--rec-border-primary);
  background: var(--rec-bg-secondary);
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
  border-radius: var(--rec-radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.rec-refresh-btn:hover {
  background: var(--rec-bg-hover);
}

.rec-loading {
  text-align: center;
  padding: var(--rec-space-12);
  color: var(--rec-text-muted);
  font-size: var(--rec-text-md);
}

.rec-empty {
  text-align: center;
  padding: var(--rec-space-12);
}

.rec-empty-icon {
  font-size: 48px;
  margin-bottom: var(--rec-space-4);
}

.rec-empty h2 {
  font-size: var(--rec-text-xl);
  color: var(--rec-text-primary);
  margin: 0 0 var(--rec-space-2);
}

.rec-empty p {
  font-size: var(--rec-text-md);
  color: var(--rec-text-secondary);
  margin: 0;
}

.rec-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--rec-space-4);
  margin-bottom: var(--rec-space-6);
}

.rec-split-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--rec-space-4);
  margin-bottom: var(--rec-space-4);
}

@media (max-width: 768px) {
  .rec-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .rec-split-row {
    grid-template-columns: 1fr;
  }
}
</style>
