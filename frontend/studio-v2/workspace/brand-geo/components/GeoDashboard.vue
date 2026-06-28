<template>
  <div class="geo-dashboard">
    <!-- Welcome -->
    <div class="geo-dashboard-welcome">
      <div class="geo-welcome-left">
        <h1 class="geo-welcome-title">品牌GEO 工作台</h1>
        <p class="geo-welcome-subtitle">
          品牌搜索引擎优化（GEO）— 提升品牌在全网的可见性与影响力
        </p>
      </div>
      <div class="geo-welcome-right">
        <div class="geo-quick-stat" v-for="stat in quickStats" :key="stat.label">
          <span class="geo-quick-stat-value">{{ stat.value }}</span>
          <span class="geo-quick-stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- Workspace Flow Progress -->
    <div class="geo-flow-bar">
      <div class="geo-flow-label">
        <span>工作流进度</span>
        <span class="geo-flow-percent">{{ flowProgress.percentage }}%</span>
      </div>
      <div class="geo-flow-track">
        <div
          v-for="(stage, i) in flowStages"
          :key="stage"
          class="geo-flow-step"
          :class="{
            active: flowProgress.current === stage,
            completed: getStageStatus(stage) === 'completed',
          }"
          @click="navigateToFlowStage(stage)"
        >
          <div class="geo-flow-dot">
            <span v-if="getStageStatus(stage) === 'completed'">✓</span>
            <span v-else-if="flowProgress.current === stage">●</span>
            <span v-else>○</span>
          </div>
          <span class="geo-flow-step-label">{{ stageLabel(stage) }}</span>
        </div>
      </div>
    </div>

    <!-- Current Project Info -->
    <div v-if="currentProject" class="geo-project-info">
      <div class="geo-project-info-left">
        <span class="geo-project-info-label">当前项目</span>
        <span class="geo-project-info-name">{{ currentProject.name }}</span>
        <span v-if="currentProject.website" class="geo-project-info-url">{{ currentProject.website }}</span>
      </div>
      <div class="geo-project-info-right">
        <span class="geo-project-info-status" :class="currentProject.status">{{ currentProject.status }}</span>
        <button class="geo-btn-small" @click="navigateToPanel('project-select')">切换</button>
      </div>
    </div>
    <div v-else class="geo-no-project">
      <p>还没有选择项目，请先创建或选择一个项目</p>
      <button class="geo-btn geo-btn-primary" @click="navigateToPanel('project-select')">
        📁 选择或创建项目
      </button>
    </div>

    <!-- Stats Row (Phase 1) -->
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

    <!-- V2 Feature Cards (Two Rows) -->
    <div class="geo-dashboard-section">
      <h3 class="geo-section-title">核心功能</h3>
      <div class="geo-card-grid">
        <div
          v-for="card in v2FeatureCards"
          :key="card.id"
          class="geo-function-card"
          :style="{ '--card-accent': card.color }"
          @click="navigateToPanel(card.panelId as GeoPanelId)"
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
    </div>

    <div class="geo-dashboard-section">
      <h3 class="geo-section-title">扩展能力</h3>
      <div class="geo-card-grid">
        <div
          v-for="card in comingSoonCards"
          :key="card.id"
          class="geo-function-card geo-card-coming"
          :style="{ '--card-accent': card.color }"
        >
          <div class="geo-card-icon-wrapper" :style="{ background: card.color + '20' }">
            <span class="geo-card-icon">{{ card.icon }}</span>
          </div>
          <div class="geo-card-body">
            <h3 class="geo-card-title">
              {{ card.title }}
              <span class="geo-card-badge">Coming Soon</span>
            </h3>
            <p class="geo-card-desc">{{ card.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Panels -->
    <div class="geo-dashboard-panels">
      <div class="geo-panel geo-panel-recent">
        <div class="geo-panel-header">
          <h3 class="geo-panel-title">📌 最近项目</h3>
        </div>
        <div class="geo-panel-body">
          <div v-if="v2Projects.length === 0" class="geo-panel-empty">
            还没有项目，快去创建一个
          </div>
          <div
            v-for="project in v2Projects.slice(0, 5)"
            :key="project.id"
            class="geo-activity-item"
            @click="selectAndNavigate(project.id)"
          >
            <span class="geo-activity-icon">📦</span>
            <div class="geo-activity-content">
              <span class="geo-activity-text">{{ project.name }}</span>
              <span class="geo-activity-time">{{ formatDate(project.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="geo-panel geo-panel-tasks">
        <div class="geo-panel-header">
          <h3 class="geo-panel-title">📋 运行任务</h3>
        </div>
        <div class="geo-panel-body">
          <div v-if="pendingTaskCount === 0" class="geo-panel-empty">
            没有运行中的任务
          </div>
          <div
            v-for="task in pendingTasks.slice(0, 5)"
            :key="task.id"
            class="geo-task-item"
          >
            <div class="geo-task-priority" :class="'priority-' + task.priority"></div>
            <div class="geo-task-content">
              <span class="geo-task-title">{{ task.title }}</span>
              <span class="geo-task-project">{{ task.projectName || '' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="geo-panel geo-panel-snapshot">
        <div class="geo-panel-header">
          <h3 class="geo-panel-title">📸 最新快照</h3>
        </div>
        <div class="geo-panel-body">
          <div v-if="!latestSnapshot" class="geo-panel-empty">
            还没有扫描数据
          </div>
          <div v-else class="geo-snapshot-preview">
            <div class="geo-snapshot-mini">
              <span class="geo-snapshot-mini-label">URL</span>
              <span class="geo-snapshot-mini-value">{{ latestSnapshot.url }}</span>
            </div>
            <div class="geo-snapshot-mini">
              <span class="geo-snapshot-mini-label">状态</span>
              <span class="geo-snapshot-mini-value" :class="latestSnapshot.status">
                {{ latestSnapshot.status }}
              </span>
            </div>
            <div class="geo-snapshot-mini">
              <span class="geo-snapshot-mini-label">标题</span>
              <span class="geo-snapshot-mini-value">{{ latestSnapshot.title || '—' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GeoPanelId, GeoTask, WebsiteSnapshot, WorkspaceFlowStage } from '~/studio-v2/types/geo'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import { useBrandGEORuntime } from '~/studio-v2/workspace/brand-geo/composables/useBrandGEORuntime'

interface FeatureCard {
  id: string
  title: string
  description: string
  icon: string
  panelId: string
  color: string
}

const store = useBrandGeoStore()
const runtime = useBrandGEORuntime()

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
}>()

const v2FeatureCards: FeatureCard[] = [
  { id: 'brand-profile', title: '品牌档案', description: '管理品牌信息和资料', icon: '🏷️', panelId: 'brand-profile', color: '#6366f1' },
  { id: 'website-scanner', title: '网站扫描', description: '扫描网站获取结构化数据', icon: '🔍', panelId: 'website-scanner', color: '#06b6d4' },
  { id: 'knowledge-graph', title: '知识图谱', description: '构建品牌关联实体网络', icon: '🔗', panelId: 'knowledge-graph', color: '#8b5cf6' },
  { id: 'snapshot', title: '网站快照', description: '查看网站完整快照数据', icon: '📸', panelId: 'website-scanner', color: '#10b981' },
]

const comingSoonCards: FeatureCard[] = [
  { id: 'ai-visibility', title: 'AI 可见性', description: 'AI 搜索引擎排名监控', icon: '🤖', panelId: 'visibility', color: '#f59e0b' },
  { id: 'citation', title: '引用追踪', description: '全网品牌提及追踪', icon: '📝', panelId: 'citations', color: '#ec4899' },
  { id: 'entity', title: '实体分析', description: '发现品牌潜在关联实体', icon: '🧩', panelId: 'entities', color: '#3b82f6' },
  { id: 'content', title: '内容策略', description: 'AI 驱动内容优化建议', icon: '✍️', panelId: 'topics', color: '#ef4444' },
]

const quickStats = computed(() => [
  { label: 'V2 项目', value: store.v2Projects.value.length },
  { label: '活跃项目', value: props.stats?.activeProjects ?? store.dashboardStats.value.activeProjects },
  { label: '待办', value: props.stats?.pendingTasks ?? store.dashboardStats.value.pendingTasks },
])

const statsCards = computed(() => [
  { icon: '👁️', label: '平均可见性', value: (props.stats?.averageVisibility ?? store.dashboardStats.value.averageVisibility).toFixed(0) + '%', color: '#06b6d4' },
  { icon: '📝', label: '全网提及', value: (props.stats?.totalMentions ?? store.dashboardStats.value.totalMentions).toLocaleString(), color: '#10b981' },
  { icon: '😊', label: '正面舆情', value: (props.stats?.positiveSentiment ?? store.dashboardStats.value.positiveSentiment).toFixed(0) + '%', color: '#f59e0b' },
  { icon: '📊', label: '覆盖比率', value: (props.stats?.coverageRate ?? store.dashboardStats.value.coverageRate).toFixed(1) + '%', color: '#6366f1' },
  { icon: '🎯', label: '竞品数量', value: props.stats?.competitorCount ?? store.dashboardStats.value.competitorCount, color: '#ef4444' },
  { icon: '🏷️', label: '品牌总数', value: props.stats?.totalBrands ?? store.dashboardStats.value.totalBrands, color: '#8b5cf6' },
])

const pendingTasks = computed(() => {
  const tasks = store.tasks.value
  return tasks.filter((t: GeoTask) => t.status === 'pending').slice(0, 5)
})

const pendingTaskCount = computed(() => pendingTasks.value.length)
const v2Projects = computed(() => store.v2Projects.value)
const currentProject = computed(() => store.selectedV2Project.value)

const latestSnapshot = computed<WebsiteSnapshot | null>(() => {
  return store.websiteSnapshot.value
})

const flowStages: WorkspaceFlowStage[] = ['create_project', 'edit_brand_profile', 'website_scan', 'generate_snapshot', 'build_graph', 'ready']

const flowProgress = computed(() => runtime.workspaceFlowProgress.value)

function getStageStatus(stage: WorkspaceFlowStage): string {
  return store.workspaceFlow.value.stages[stage]
}

function stageLabel(stage: WorkspaceFlowStage): string {
  return runtime.stageLabel(stage)
}

function navigateToPanel(panelId: string) {
  emit('navigate', panelId as GeoPanelId)
}

function navigateToFlowStage(stage: WorkspaceFlowStage) {
  const panelMap: Record<WorkspaceFlowStage, string> = {
    create_project: 'project-create',
    edit_brand_profile: 'brand-profile',
    website_scan: 'website-scanner',
    generate_snapshot: 'website-scanner',
    build_graph: 'knowledge-graph',
    ready: 'dashboard',
  }
  emit('navigate', panelMap[stage] as GeoPanelId)
}

function selectAndNavigate(projectId: string) {
  store.setSelectedV2ProjectId(projectId)
  emit('navigate', 'dashboard' as GeoPanelId)
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.geo-dashboard { padding: 24px; overflow-y: auto; height: 100%; }

/* Wait */
.geo-dashboard-welcome {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px; padding: 24px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05));
  border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.12);
}
.geo-welcome-title { font-size: 24px; font-weight: 700; color: #e2e8f0; margin: 0 0 6px; }
.geo-welcome-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
.geo-welcome-right { display: flex; gap: 20px; }
.geo-quick-stat { text-align: center; }
.geo-quick-stat-value { display: block; font-size: 22px; font-weight: 700; color: #c084fc; }
.geo-quick-stat-label { font-size: 12px; color: #6b7280; }

/* Flow Bar */
.geo-flow-bar {
  background: #11151c; border-radius: 12px; padding: 14px 20px;
  border: 1px solid rgba(255, 255, 255, 0.04); margin-bottom: 20px;
}
.geo-flow-label { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 10px; }
.geo-flow-percent { color: #a5b4fc; font-weight: 600; }
.geo-flow-track { display: flex; gap: 4px; justify-content: space-between; }
.geo-flow-step {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  padding: 4px 8px; border-radius: 6px; font-size: 11px; color: #4b5563;
  transition: all 0.15s;
}
.geo-flow-step:hover { background: rgba(255, 255, 255, 0.03); }
.geo-flow-step.active { color: #a5b4fc; }
.geo-flow-step.completed { color: #34d399; }
.geo-flow-dot { font-size: 12px; }

/* Project Info */
.geo-project-info {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 10px; padding: 12px 18px; margin-bottom: 20px;
}
.geo-project-info-left { display: flex; align-items: center; gap: 10px; }
.geo-project-info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
.geo-project-info-name { font-size: 15px; font-weight: 600; color: #e2e8f0; }
.geo-project-info-url { font-size: 12px; color: #6366f1; }
.geo-project-info-right { display: flex; align-items: center; gap: 10px; }
.geo-project-info-status {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  background: rgba(16, 185, 129, 0.1); color: #6ee7b7;
}
.geo-btn-small {
  background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 12px; border-radius: 6px; font-size: 12px; color: #9ca3af; cursor: pointer;
}
.geo-no-project {
  text-align: center; padding: 24px; background: #11151c; border-radius: 12px;
  border: 1px dashed rgba(255,255,255,0.08); margin-bottom: 20px;
}
.geo-no-project p { color: #6b7280; margin: 0 0 12px; }

/* Stats */
.geo-stats-row {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px;
}
.geo-stat-card {
  background: #11151c; border-radius: 12px; padding: 16px;
  display: flex; align-items: center; gap: 12px; border-left: 3px solid; transition: transform 0.15s;
}
.geo-stat-card:hover { transform: translateY(-2px); }
.geo-stat-icon { font-size: 24px; }
.geo-stat-body { display: flex; flex-direction: column; }
.geo-stat-number { font-size: 20px; font-weight: 700; color: #e2e8f0; }
.geo-stat-label { font-size: 11px; color: #6b7280; }

/* Section Titles */
.geo-dashboard-section { margin-bottom: 24px; }
.geo-section-title { font-size: 15px; font-weight: 600; color: #9ca3af; margin: 0 0 12px; }

/* Card Grid */
.geo-card-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}
.geo-function-card {
  background: #11151c; border-radius: 14px; padding: 20px;
  cursor: pointer; transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.04);
  display: flex; flex-direction: column; gap: 12px; position: relative;
}
.geo-function-card:hover {
  border-color: var(--card-accent); background: #161c26;
  transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.geo-card-coming { opacity: 0.7; cursor: default; }
.geo-card-coming:hover { background: #11151c; transform: none; box-shadow: none; }
.geo-card-icon-wrapper {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.geo-card-body { flex: 1; }
.geo-card-title { font-size: 15px; font-weight: 600; color: #e2e8f0; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
.geo-card-badge { font-size: 9px; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.geo-card-desc { font-size: 12px; color: #6b7280; margin: 0; line-height: 1.4; }
.geo-card-arrow {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  font-size: 18px; color: #374151; transition: all 0.2s;
}
.geo-function-card:hover .geo-card-arrow { color: var(--card-accent); right: 12px; }

/* Bottom Panels */
.geo-dashboard-panels { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.geo-panel { background: #11151c; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.04); overflow: hidden; }
.geo-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.geo-panel-title { font-size: 14px; font-weight: 600; color: #d1d5db; margin: 0; }
.geo-panel-body { padding: 12px 20px; min-height: 100px; }
.geo-panel-empty { text-align: center; padding: 20px 0; color: #4b5563; font-size: 13px; }
.geo-activity-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; }
.geo-activity-item:last-child { border-bottom: none; }
.geo-activity-item:hover { background: rgba(99, 102, 241, 0.03); margin: 0 -20px; padding: 8px 20px; }
.geo-activity-icon { font-size: 16px; margin-top: 1px; }
.geo-activity-content { display: flex; flex-direction: column; gap: 2px; }
.geo-activity-text { font-size: 13px; color: #d1d5db; }
.geo-activity-time { font-size: 11px; color: #4b5563; }
.geo-task-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03); }
.geo-task-item:last-child { border-bottom: none; }
.geo-task-priority { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.priority-low { background: #6b7280; }
.priority-medium { background: #f59e0b; }
.priority-high { background: #ef4444; }
.geo-task-content { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.geo-task-title { font-size: 13px; color: #d1d5db; }
.geo-task-project { font-size: 11px; color: #4b5563; }

.snapshot-mini { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12px; }
.geo-snapshot-preview { display: flex; flex-direction: column; gap: 8px; }
.geo-snapshot-mini { display: flex; gap: 8px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
.geo-snapshot-mini-label { color: #6b7280; min-width: 40px; }
.geo-snapshot-mini-value { color: #d1d5db; }
.geo-snapshot-mini-value.completed { color: #34d399; }
.geo-snapshot-mini-value.error { color: #f87171; }

.geo-btn { padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
.geo-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
</style>
