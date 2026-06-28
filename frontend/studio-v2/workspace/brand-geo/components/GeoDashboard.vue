<template>
  <div class="geo-dashboard">
    <!-- 欢迎区域 -->
    <div class="geo-dashboard-welcome">
      <div class="geo-welcome-left">
        <h1 class="geo-welcome-title">品牌GEO 工作台</h1>
        <p class="geo-welcome-subtitle">
          品牌搜索引擎优化（GEO） — 提升品牌在全网的可见性与影响力
        </p>
      </div>
      <div class="geo-welcome-right">
        <div class="geo-quick-stat" v-for="stat in quickStats" :key="stat.label">
          <span class="geo-quick-stat-value">{{ stat.value }}</span>
          <span class="geo-quick-stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- 统计概览行 -->
    <div class="geo-stats-row">
      <div
        v-for="s in statsCards"
        :key="s.label"
        class="geo-stat-card"
        :style="{ borderLeftColor: s.color }"
      >
        <div class="geo-stat-icon">{{ s.icon }}</div>
        <div class="geo-stat-body">
          <span class="geo-stat-number">{{ s.value }}</span>
          <span class="geo-stat-label">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- 8 功能卡片网格 -->
    <div class="geo-card-grid">
      <div
        v-for="card in cards"
        :key="card.id"
        class="geo-function-card"
        :style="{ '--card-accent': card.color }"
        @click="navigateToPanel(card.panelId)"
      >
        <div class="geo-card-icon-wrapper" :style="{ background: card.color + '20' }">
          <span class="geo-card-icon">{{ card.icon }}</span>
        </div>
        <div class="geo-card-body">
          <h3 class="geo-card-title">{{ card.title }}</h3>
          <p class="geo-card-desc">{{ card.description }}</p>
        </div>
        <div class="geo-card-arrow">→</div>
      </div>
    </div>

    <!-- 右侧面板（最近动态 / 待办任务） -->
    <div class="geo-dashboard-panels">
      <div class="geo-panel geo-panel-recent">
        <div class="geo-panel-header">
          <h3 class="geo-panel-title">📌 最近动态</h3>
        </div>
        <div class="geo-panel-body">
          <div v-if="recentActivities.length === 0" class="geo-panel-empty">
            暂无动态，开始使用后这里将显示最新活动
          </div>
          <div
            v-for="activity in recentActivities"
            :key="activity.id"
            class="geo-activity-item"
          >
            <span class="geo-activity-icon">{{ activity.icon }}</span>
            <div class="geo-activity-content">
              <span class="geo-activity-text">{{ activity.text }}</span>
              <span class="geo-activity-time">{{ activity.time }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="geo-panel geo-panel-tasks">
        <div class="geo-panel-header">
          <h3 class="geo-panel-title">📋 待办任务</h3>
          <span v-if="pendingTaskCount > 0" class="geo-panel-badge">{{ pendingTaskCount }}</span>
        </div>
        <div class="geo-panel-body">
          <div v-if="pendingTaskCount === 0" class="geo-panel-empty">
            没有待办任务，一切就绪
          </div>
          <div
            v-for="task in pendingTasks"
            :key="task.id"
            class="geo-task-item"
            @click="navigateToPanel('tasks')"
          >
            <div class="geo-task-priority" :class="'priority-' + task.priority"></div>
            <div class="geo-task-content">
              <span class="geo-task-title">{{ task.title }}</span>
              <span class="geo-task-project">{{ task.projectName || '' }}</span>
            </div>
            <span class="geo-task-due" v-if="task.dueDate">{{ formatDate(task.dueDate) }}</span>
          </div>
        </div>
        <div v-if="pendingTaskCount > 0" class="geo-panel-footer" @click="navigateToPanel('tasks')">
          查看全部任务 →
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GeoPanelId, GeoTask } from '~/studio-v2/types/geo'
import { DASHBOARD_CARDS } from '~/studio-v2/workspace/brand-geo/config/dashboard-cards'
import type { DashboardCard } from '~/studio-v2/workspace/brand-geo/config/dashboard-cards'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'

interface Activity {
  id: string
  icon: string
  text: string
  time: string
}

const store = useBrandGeoStore()

const emit = defineEmits<{
  navigate: [panelId: GeoPanelId]
}>()

const props = defineProps<{
  stats?: {
    totalBrands: number
    activeProjects: number
    pendingTasks: number
    averageVisibility: number
    totalMentions: number
    positiveSentiment: number
    coverageRate: number
    competitorCount: number
  }
  recentActivities?: Activity[]
}>()

const cards: DashboardCard[] = DASHBOARD_CARDS

const quickStats = computed(() => [
  { label: '品牌', value: props.stats?.totalBrands ?? store.dashboardStats.value.totalBrands },
  { label: '活跃项目', value: props.stats?.activeProjects ?? store.dashboardStats.value.activeProjects },
  { label: '待办', value: props.stats?.pendingTasks ?? store.dashboardStats.value.pendingTasks },
])

const statsCards = computed(() => [
  {
    icon: '👁️',
    label: '平均可见性',
    value: (props.stats?.averageVisibility ?? store.dashboardStats.value.averageVisibility).toFixed(0) + '%',
    color: '#06b6d4',
  },
  {
    icon: '📝',
    label: '全网提及',
    value: (props.stats?.totalMentions ?? store.dashboardStats.value.totalMentions).toLocaleString(),
    color: '#10b981',
  },
  {
    icon: '😊',
    label: '正面舆情',
    value: (props.stats?.positiveSentiment ?? store.dashboardStats.value.positiveSentiment).toFixed(0) + '%',
    color: '#f59e0b',
  },
  {
    icon: '📊',
    label: '覆盖比率',
    value: (props.stats?.coverageRate ?? store.dashboardStats.value.coverageRate).toFixed(1) + '%',
    color: '#6366f1',
  },
  {
    icon: '🎯',
    label: '竞品数量',
    value: props.stats?.competitorCount ?? store.dashboardStats.value.competitorCount,
    color: '#ef4444',
  },
  {
    icon: '🏷️',
    label: '品牌总数',
    value: props.stats?.totalBrands ?? store.dashboardStats.value.totalBrands,
    color: '#8b5cf6',
  },
])

const pendingTasks = computed(() => {
  const tasks = store.tasks.value
  return tasks.filter((t: GeoTask) => t.status === 'pending').slice(0, 5)
})

const pendingTaskCount = computed(() => pendingTasks.value.length)

function navigateToPanel(panelId: string) {
  emit('navigate', panelId as GeoPanelId)
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.geo-dashboard {
  padding: 24px;
  overflow-y: auto;
  height: 100%;
}

/* ── Welcome Area ── */
.geo-dashboard-welcome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05));
  border-radius: 16px;
  border: 1px solid rgba(99, 102, 241, 0.12);
}
.geo-welcome-title {
  font-size: 24px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 6px;
}
.geo-welcome-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}
.geo-welcome-right {
  display: flex;
  gap: 20px;
}
.geo-quick-stat {
  text-align: center;
}
.geo-quick-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #c084fc;
}
.geo-quick-stat-label {
  font-size: 12px;
  color: #6b7280;
}

/* ── Stats Row ── */
.geo-stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.geo-stat-card {
  background: #11151c;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 3px solid;
  transition: transform 0.15s;
}
.geo-stat-card:hover {
  transform: translateY(-2px);
}
.geo-stat-icon {
  font-size: 24px;
}
.geo-stat-body {
  display: flex;
  flex-direction: column;
}
.geo-stat-number {
  font-size: 20px;
  font-weight: 700;
  color: #e2e8f0;
}
.geo-stat-label {
  font-size: 11px;
  color: #6b7280;
}

/* ── Card Grid ── */
.geo-card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.geo-function-card {
  background: #11151c;
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}
.geo-function-card:hover {
  border-color: var(--card-accent);
  background: #161c26;
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.geo-card-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.geo-card-body {
  flex: 1;
}
.geo-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0 0 4px;
}
.geo-card-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
}
.geo-card-arrow {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: #374151;
  transition: all 0.2s;
}
.geo-function-card:hover .geo-card-arrow {
  color: var(--card-accent);
  right: 12px;
}

/* ── Panels ── */
.geo-dashboard-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.geo-panel {
  background: #11151c;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
.geo-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.geo-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #d1d5db;
  margin: 0;
}
.geo-panel-badge {
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}
.geo-panel-body {
  padding: 12px 20px;
  min-height: 120px;
}
.geo-panel-empty {
  text-align: center;
  padding: 24px 0;
  color: #4b5563;
  font-size: 13px;
}
.geo-panel-footer {
  padding: 10px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  text-align: center;
  font-size: 12px;
  color: #6366f1;
  cursor: pointer;
  transition: background 0.15s;
}
.geo-panel-footer:hover {
  background: rgba(99, 102, 241, 0.05);
}

/* ── Activity Items ── */
.geo-activity-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.geo-activity-item:last-child {
  border-bottom: none;
}
.geo-activity-icon {
  font-size: 16px;
  margin-top: 1px;
}
.geo-activity-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.geo-activity-text {
  font-size: 13px;
  color: #d1d5db;
}
.geo-activity-time {
  font-size: 11px;
  color: #4b5563;
}

/* ── Task Items ── */
.geo-task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.1s;
}
.geo-task-item:hover {
  background: rgba(99, 102, 241, 0.03);
  margin: 0 -20px;
  padding: 10px 20px;
}
.geo-task-item:last-child {
  border-bottom: none;
}
.geo-task-priority {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.priority-low { background: #6b7280; }
.priority-medium { background: #f59e0b; }
.priority-high { background: #ef4444; }
.priority-critical { background: #dc2626; animation: pulse-priority 1.5s infinite; }
@keyframes pulse-priority {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.geo-task-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.geo-task-title {
  font-size: 13px;
  color: #d1d5db;
}
.geo-task-project {
  font-size: 11px;
  color: #4b5563;
}
.geo-task-due {
  font-size: 11px;
  color: #6b7280;
  flex-shrink: 0;
}
</style>
