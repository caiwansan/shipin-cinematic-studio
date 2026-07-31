<!-- Commercial Gate: AI 招聘 ROI 展示卡片 -->
<!-- 展示 AI 招聘团队的月度产出与成本，直接关联付费价值感知 -->
<template>
  <div class="rec-roi-card">
    <div class="rec-roi-header">
      <h3 class="rec-roi-title">📊 AI 招聘成果</h3>
      <span class="rec-roi-period">本月</span>
    </div>
    <div class="rec-roi-loading" v-if="loading">
      <div class="rec-roi-skel"></div>
      <div class="rec-roi-skel rec-roi-skel--short"></div>
    </div>
    <div v-else class="rec-roi-grid">
      <div class="rec-roi-metric">
        <span class="rec-roi-value">{{ metrics.tasks }}</span>
        <span class="rec-roi-label">完成任务</span>
      </div>
      <div class="rec-roi-metric">
        <span class="rec-roi-value">{{ metrics.candidates }}</span>
        <span class="rec-roi-label">分析候选人</span>
      </div>
      <div class="rec-roi-metric">
        <span class="rec-roi-value">{{ metrics.jds }}</span>
        <span class="rec-roi-label">生成 JD</span>
      </div>
      <div class="rec-roi-metric">
        <span class="rec-roi-value">¥{{ metrics.cost }}</span>
        <span class="rec-roi-label">AI 执行成本</span>
      </div>
      <div class="rec-roi-metric rec-roi-metric--highlight">
        <span class="rec-roi-value">{{ metrics.hoursSaved }}h</span>
        <span class="rec-roi-label">节省 HR 工时</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

const loading = ref(true)
const metrics = reactive({
  tasks: 0,
  candidates: 0,
  jds: 0,
  cost: '0.00',
  hoursSaved: 0,
})

async function fetchMetrics() {
  try {
    const token = getAuthToken()
    const [tasksRes, homeRes] = await Promise.all([
      fetch('/api/enterprise/agent-tasks', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
      fetch('/api/enterprise/home', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    ])

    if (tasksRes.ok) {
      const body = await tasksRes.json()
      if (body?.code === 0 && Array.isArray(body?.data)) {
        const tasks = body.data as any[]
        metrics.tasks = tasks.length
        metrics.jds = tasks.filter((t: any) =>
          (t.type || '').toLowerCase().includes('jd') ||
          (t.description || '').toLowerCase().includes('jd') ||
          (t.taskType || '').toLowerCase().includes('jd')
        ).length
        const total = tasks.reduce((s, t) => s + (parseFloat(t.cost) || 0), 0)
        metrics.cost = total.toFixed(4)
        // 估算 HR 时间：每个任务平均节省 ~45 分钟
        metrics.hoursSaved = Math.round(tasks.length * 0.75)
      }
    }

    if (homeRes.ok) {
      const body = await homeRes.json()
      if (body?.todayMetrics?.pendingCandidates) {
        metrics.candidates = (metrics.candidates || 0) + body.todayMetrics.pendingCandidates
      }
      if (body?.funnel) {
        const totalCandidates = body.funnel.reduce((s: number, f: any) => s + (f.value || 0), 0)
        metrics.candidates = Math.max(metrics.candidates, totalCandidates)
      }
      if (body?.todayMetrics?.conversations) {
        metrics.candidates = Math.max(metrics.candidates, body.todayMetrics.conversations)
      }
    }
  } catch {
    // 静默失败，组件可缺失
  }
  loading.value = false
}

onMounted(() => { fetchMetrics() })
</script>

<style scoped>
.rec-roi-card {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1e293b);
  border-radius: 12px;
  padding: 16px 20px;
}

.rec-roi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.rec-roi-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #f1f5f9);
}

.rec-roi-period {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-bg-secondary, #1e293b);
  color: var(--color-text-secondary, #94a3b8);
}

/* Skeleton */
.rec-roi-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rec-roi-skel {
  height: 12px;
  background: var(--color-bg-secondary, #1e293b);
  border-radius: 6px;
}
.rec-roi-skel--short {
  width: 50%;
}

/* Grid */
.rec-roi-grid {
  display: flex;
  gap: 0;
  justify-content: space-between;
}

.rec-roi-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  border-right: 1px solid var(--color-border-primary, #1e293b);
  padding: 0 8px;
}
.rec-roi-metric:last-child {
  border-right: none;
}

.rec-roi-metric--highlight .rec-roi-value {
  color: #34d399;
}

.rec-roi-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary, #f1f5f9);
  line-height: 1.2;
}

.rec-roi-label {
  font-size: 11px;
  color: var(--color-text-secondary, #94a3b8);
  white-space: nowrap;
}
</style>
