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
          <h2 class="geo-topbar-title">{{ panelTitle }}</h2>
        </div>
        <div class="geo-topbar-right">
          <span v-if="selectedV2Project" class="geo-topbar-brand-tag">
            📦 {{ selectedV2Project.name }}
          </span>
          <button v-if="error" class="geo-topbar-error-btn" @click="error = null">
            ⚠️ {{ error }}
          </button>
          <div v-if="loading" class="geo-topbar-loading">
            <span class="geo-loading-spinner"></span>
            <span>加载中...</span>
          </div>
        </div>
      </header>

      <!-- 内容区 -->
      <div class="geo-content-area">
        <!-- 产品导航页面 -->
        <GeoDashboard
          v-if="activePanelId === 'dashboard'"
          @navigate="onNavigate"
        />

        <BrandListPage
          v-else-if="activePanelId === 'brands'"
          @navigate="onNavigate"
          @select-brand="onSelectBrand"
        />

        <BrandDetailPage
          v-else-if="activePanelId === 'website' && selectedProjectIdForDetail"
          :brand-id="selectedProjectIdForDetail"
          @back="onNavigate('brands')"
          @navigate="onNavigate"
        />

        <KeywordPage
          v-else-if="activePanelId === 'keywords'"
        />

        <KnowledgeCenterPage
          v-else-if="activePanelId === 'knowledge'"
        />

        <KnowledgeGraphPage
          v-else-if="activePanelId === 'knowledge-graph'"
          :project-id="selectedV2ProjectId"
        />

        <SettingsPage
          v-else-if="activePanelId === 'settings'"
        />

        <!-- 开发者导航页面 -->
        <ExecutionStudioPage
          v-else-if="activePanelId === 'execution-studio'"
          :project-id="selectedV2ProjectId"
        />

        <SystemLensPage
          v-else-if="activePanelId === 'system-lens'"
          :project-id="selectedV2ProjectId"
        />

        <SystemControlPage
          v-else-if="activePanelId === 'system-control'"
          :project-id="selectedV2ProjectId"
        />

        <SystemMetadataPage
          v-else-if="activePanelId === 'system-metadata'"
          :project-id="selectedV2ProjectId"
        />

        <ExecutionTraceViewer
          v-else-if="activePanelId === 'execution-trace'"
        />

        <GeoPlaceholderPanel
          v-else
          title="功能开发中"
          description="敬请期待"
          icon="🚧"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import BrandGEOSidebar from '~/studio-v2/workspace/brand-geo/components/BrandGEOSidebar.vue'
import GeoDashboard from '~/studio-v2/workspace/brand-geo/components/GeoDashboard.vue'
import GeoPlaceholderPanel from '~/studio-v2/workspace/brand-geo/components/GeoPlaceholderPanel.vue'
// Product pages (Sprint P1)
import BrandListPage from '~/studio-v2/workspace/brand-geo/pages/BrandListPage.vue'
import BrandDetailPage from '~/studio-v2/workspace/brand-geo/pages/BrandDetailPage.vue'
import KeywordPage from '~/studio-v2/workspace/brand-geo/pages/KeywordPage.vue'
import KnowledgeCenterPage from '~/studio-v2/workspace/brand-geo/pages/KnowledgeCenterPage.vue'
import SettingsPage from '~/studio-v2/workspace/brand-geo/pages/SettingsPage.vue'
// Legacy pages (keep as-is)
import KnowledgeGraphPage from '~/studio-v2/workspace/brand-geo/pages/KnowledgeGraphPage.vue'
// Developer pages
import ExecutionStudioPage from '~/studio-v2/workspace/brand-geo/pages/ExecutionStudioPage.vue'
import SystemLensPage from '~/studio-v2/workspace/brand-geo/pages/SystemLensPage.vue'
import SystemControlPage from '~/studio-v2/workspace/brand-geo/pages/SystemControlPage.vue'
import SystemMetadataPage from '~/studio-v2/workspace/brand-geo/pages/SystemMetadataPage.vue'
import ExecutionTraceViewer from '~/studio-v2/workspace/brand-geo/components/runtime/ExecutionTraceViewer.vue'
import type { GeoPanelId } from '~/studio-v2/types/geo'

const store = useBrandGeoStore()
const activePanelId = ref<GeoPanelId>('dashboard')
const selectedProjectIdForDetail = ref<string | null>(null)

// Local loading/error for topbar display
const loading = computed(() => store.loading)
const error = ref<string | null>(null)

const panelMeta: Record<string, { title: string; icon: string }> = {
  dashboard: { title: 'Dashboard', icon: '📊' },
  brands: { title: '品牌管理', icon: '🏢' },
  website: { title: '官网管理', icon: '🌐' },
  keywords: { title: '关键词管理', icon: '🔑' },
  knowledge: { title: 'Knowledge', icon: '📚' },
  'knowledge-graph': { title: '知识图谱', icon: '🔗' },
  settings: { title: '设置', icon: '⚙️' },
  // Developer pages
  'execution-studio': { title: '执行工作室', icon: '🎬' },
  'execution-trace': { title: '执行轨迹', icon: '📋' },
  'system-lens': { title: '系统镜头', icon: '🔬' },
  'system-control': { title: '系统控制', icon: '⚙️' },
  'system-metadata': { title: '系统元数据', icon: '🌐' },
}

const panelTitle = computed(() => panelMeta[activePanelId.value]?.title || '品牌GEO')

const selectedV2Project = computed(() => store.selectedV2Project)
const selectedV2ProjectId = computed(() => store.selectedV2ProjectId)

function onNavigate(panelId: string) {
  activePanelId.value = panelId as GeoPanelId
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('panel', panelId)
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

function onSelectBrand(brandId: string) {
  selectedProjectIdForDetail.value = brandId
  onNavigate('website')
}

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const panel = params.get('panel') as GeoPanelId | null
    if (panel) {
      activePanelId.value = panel
    }
  } catch {}
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
