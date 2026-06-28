<template>
  <div class="brand-geo-workspace">
    <!-- 左侧 Sidebar -->
    <BrandGEOSidebar
      :active-panel-id="activePanelId"
      @navigate="onNavigate"
    />

    <!-- 主工作区 -->
    <main class="geo-main-area">
      <!-- 顶栏 -->
      <header class="geo-topbar">
        <div class="geo-topbar-left">
          <h2 class="geo-topbar-title">{{ runtime.currentPanelTitle.value }}</h2>
        </div>
        <div class="geo-topbar-right">
          <!-- Workspace Flow Stage Badge -->
          <span v-if="selectedV2Project" class="geo-topbar-stage-badge">
            📋 {{ runtime.stageLabel(runtime.workspaceFlow.value.currentStage) }}
          </span>

          <span v-if="selectedV2Project" class="geo-topbar-brand-tag">
            📦 {{ selectedV2Project.name }}
          </span>

          <span v-if="runtime.selectedBrandId.value" class="geo-topbar-brand-tag">
            🏷️ {{ selectedBrandName }}
          </span>

          <button v-if="runtime.error.value" class="geo-topbar-error-btn" @click="runtime.setError(null)">
            ⚠️ {{ runtime.error.value }}
          </button>

          <div v-if="runtime.loading.value" class="geo-topbar-loading">
            <span class="geo-loading-spinner"></span>
            <span>加载中...</span>
          </div>
        </div>
      </header>

      <!-- 内容区 -->
      <div class="geo-content-area">
        <!-- Dashboard (V2) -->
        <GeoDashboard
          v-if="activePanelId === 'dashboard'"
          :stats="runtime.dashboardStats.value"
          @navigate="onNavigate"
        />

        <!-- V2 Pages -->
        <ProjectSelectPage
          v-else-if="activePanelId === 'project-select'"
          @create="onNavigate('project-create')"
          @select="onProjectSelected"
        />

        <ProjectCreatePage
          v-else-if="activePanelId === 'project-create'"
          @created="onProjectCreated"
          @cancel="onNavigate('dashboard')"
        />

        <BrandProfilePage
          v-else-if="activePanelId === 'brand-profile'"
          :project-id="selectedV2ProjectId"
          @saved="onBrandProfileSaved"
          @skipped="onNavigate('website-scanner')"
        />

        <WebsiteScannerPage
          v-else-if="activePanelId === 'website-scanner'"
          :project-id="selectedV2ProjectId"
          @scanned="onWebsiteScanned"
        />

        <KnowledgeGraphPage
          v-else-if="activePanelId === 'knowledge-graph'"
          :project-id="selectedV2ProjectId"
        />

        <!-- Phase 2.5: Asset Center -->
        <AssetCenterPage
          v-else-if="activePanelId === 'asset-center'"
          :project-id="selectedV2ProjectId"
          @select="onAssetSelected"
          @navigate="onNavigate"
        />

        <!-- Phase 3: Semantic Explorer -->
        <SemanticExplorer
          v-else-if="activePanelId === 'semantic-explorer'"
          :project-id="selectedV2ProjectId"
        />

        <!-- Phase 4: Goal Runtime (Growth Execution Layer) -->
        <GrowthDashboard
          v-else-if="activePanelId === 'growth-dashboard'"
          :project-id="selectedV2ProjectId || ''"
        />

        <GoalTimeline
          v-else-if="activePanelId === 'goal-timeline'"
        />

        <!-- Placeholder panels for Phase 1 items -->
        <GeoPlaceholderPanel
          v-else
          :title="panelTitle"
          :description="panelDescription"
          :icon="panelIcon"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBrandGEORuntime } from '~/studio-v2/workspace/brand-geo/composables/useBrandGEORuntime'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import BrandGEOSidebar from '~/studio-v2/workspace/brand-geo/components/BrandGEOSidebar.vue'
import GeoDashboard from '~/studio-v2/workspace/brand-geo/components/GeoDashboard.vue'
import GeoPlaceholderPanel from '~/studio-v2/workspace/brand-geo/components/GeoPlaceholderPanel.vue'
import ProjectSelectPage from '~/studio-v2/workspace/brand-geo/pages/ProjectSelectPage.vue'
import ProjectCreatePage from '~/studio-v2/workspace/brand-geo/pages/ProjectCreatePage.vue'
import BrandProfilePage from '~/studio-v2/workspace/brand-geo/pages/BrandProfilePage.vue'
import WebsiteScannerPage from '~/studio-v2/workspace/brand-geo/pages/WebsiteScannerPage.vue'
import KnowledgeGraphPage from '~/studio-v2/workspace/brand-geo/pages/KnowledgeGraphPage.vue'
import AssetCenterPage from '~/studio-v2/workspace/brand-geo/pages/AssetCenterPage.vue'
import SemanticExplorer from '~/studio-v2/workspace/brand-geo/pages/SemanticExplorer.vue'
import GrowthDashboard from '~/modules/goal/components/GrowthDashboard.vue'
import GoalTimeline from '~/modules/goal/components/GoalTimeline.vue'
import type { GeoPanelId } from '~/studio-v2/types/geo'

const runtime = useBrandGEORuntime()
const store = useBrandGeoStore()
const activePanelId = ref<GeoPanelId>('dashboard')

// Panel metadata for Phase 1 panels
const panelMeta: Record<string, { title: string; description: string; icon: string }> = {
  brands: { title: '品牌管理', description: '管理品牌档案与基础信息，追踪品牌健康度', icon: '🏷️' },
  entities: { title: '实体图谱', description: '构建品牌的关联实体网络，发现潜在影响力节点', icon: '🔗' },
  visibility: { title: '可见性分析', description: '追踪搜索引擎排名与品牌曝光度指标', icon: '👁️' },
  citations: { title: '引用追踪', description: '追踪全网品牌提及与引用来源分析', icon: '📝' },
  topics: { title: '热门话题', description: '发现行业趋势与热点话题，把握内容创作方向', icon: '🔥' },
  competitors: { title: '竞品分析', description: '分析竞争对手策略与市场定位', icon: '🎯' },
  projects: { title: '项目管理', description: '管理 GEO 优化项目，跟踪执行进度与成果', icon: '📋' },
  tasks: { title: '任务中心', description: '查看待办任务，管理执行队列', icon: '✅' },
  reports: { title: '报告中心', description: '生成和查看品牌 GEO 效果报告', icon: '📈' },
  settings: { title: '设置', description: '配置品牌 GEO 工作台偏好与通知', icon: '⚙️' },
  help: { title: '帮助与教程', description: '了解如何使用品牌 GEO 提升品牌影响力', icon: '❓' },
}

const panelTitle = computed(() => panelMeta[activePanelId.value]?.title || '品牌GEO')
const panelDescription = computed(() => panelMeta[activePanelId.value]?.description || '')
const panelIcon = computed(() => panelMeta[activePanelId.value]?.icon || '🌐')

const selectedBrandName = computed(() => {
  const brand = runtime.selectedBrand.value
  return brand ? brand.name : ''
})

const selectedV2Project = computed(() => store.selectedV2Project.value)
const selectedV2ProjectId = computed(() => store.selectedV2ProjectId.value)

function onNavigate(panelId: GeoPanelId) {
  activePanelId.value = panelId
  runtime.setActivePanel(panelId)

  // Update URL query
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('panel', panelId)
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

function onProjectSelected(projectId: string) {
  store.setSelectedV2ProjectId(projectId)
  store.setStageStatus('create_project', 'completed')
  store.setCurrentStage('edit_brand_profile')

  // Load project data
  runtime.loadV2ProjectData(projectId)
  onNavigate('dashboard')
}

function onProjectCreated(projectId: string) {
  store.setSelectedV2ProjectId(projectId)
  runtime.loadV2ProjectData(projectId)
  onNavigate('brand-profile')
}

function onBrandProfileSaved() {
  onNavigate('website-scanner')
}

function onWebsiteScanned() {
  store.setCurrentStage('build_graph')
  onNavigate('knowledge-graph')
}

function onAssetSelected(asset: any) {
  // Phase 2.5: Asset selection — future detail view
  console.log('[AssetCenter] Selected asset:', asset.id)
}

onMounted(async () => {
  // Parse panel from URL
  try {
    const params = new URLSearchParams(window.location.search)
    const panel = params.get('panel') as GeoPanelId | null
    if (panel) {
      activePanelId.value = runtime.resolvePanelFromRoute({ panel })
    }
  } catch {}

  // Initialize
  await runtime.initialize()

  // If no V2 project selected and we have projects, try to auto-select
  if (!selectedV2ProjectId.value && store.v2Projects.value.length > 0) {
    store.setSelectedV2ProjectId(store.v2Projects.value[0].id)
    runtime.loadV2ProjectData(store.v2Projects.value[0].id)
  }
})
</script>

<style scoped>
.brand-geo-workspace {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
  color: #e2e8f0;
}

.geo-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ── Topbar ── */
.geo-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 18, 0.6);
  backdrop-filter: blur(8px);
}
.geo-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.geo-topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
}
.geo-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.geo-topbar-brand-tag {
  font-size: 12px;
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
}
.geo-topbar-stage-badge {
  font-size: 11px;
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
  padding: 3px 8px;
  border-radius: 6px;
}
.geo-topbar-error-btn {
  font-size: 12px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.geo-topbar-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.geo-loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Content Area ── */
.geo-content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
