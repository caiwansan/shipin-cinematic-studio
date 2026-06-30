<!-- @deprecated — GEO v3 Legacy, use brand-geo-v2 -->
<template>
  <GeoWorkspaceLayout
    ref="layoutRef"
    :active-panel-id="activePanelId"
    :show-status-bar="true"
    :brand-count="store.projects.length"
    :ko-count="store.knowledgeObjects.length"
    :last-sync="lastSyncTime"
    @navigation="onNavigate"
  >
    <!-- Product Pages -->
    <GeoDashboard
      v-if="activePanelId === 'dashboard'"
      @navigate="onNavigate"
      @select-brand="onSelectBrand"
    />
    <BrandWizardPage
      v-else-if="activePanelId === 'wizard'"
      @navigate="onNavigate"
      @select-brand="onSelectBrand"
    />
    <BrandListPage
      v-else-if="activePanelId === 'brands'"
      @navigate="onNavigate"
      @select-brand="onSelectBrand"
    />
    <BrandDetailPage
      v-else-if="activePanelId === 'brand-detail'"
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
      :project-id="store.selectedV2ProjectId"
    />
    <SettingsPage
      v-else-if="activePanelId === 'settings'"
    />

    <!-- Sprint 3: Workflow Pages -->
    <EvidenceListPage
      v-else-if="activePanelId === 'evidence'"
    />
    <EvidenceDetailPage
      v-else-if="activePanelId === 'evidence-detail'"
    />
    <ClaimTreePage
      v-else-if="activePanelId === 'claim'"
    />
    <ClaimDetailPage
      v-else-if="activePanelId === 'claim-detail'"
    />
    <HistoryPage
      v-else-if="activePanelId === 'history'"
    />
    <ReportPage
      v-else-if="activePanelId === 'report'"
    />

    <!-- Developer Pages -->
    <ExecutionStudioPage
      v-else-if="activePanelId === 'execution-studio'"
      :project-id="store.selectedV2ProjectId"
    />
    <SystemLensPage
      v-else-if="activePanelId === 'system-lens'"
      :project-id="store.selectedV2ProjectId"
    />
    <SystemControlPage
      v-else-if="activePanelId === 'system-control'"
      :project-id="store.selectedV2ProjectId"
    />
    <SystemMetadataPage
      v-else-if="activePanelId === 'system-metadata'"
      :project-id="store.selectedV2ProjectId"
    />
    <ExecutionTraceViewer
      v-else-if="activePanelId === 'execution-trace'"
    />

    <!-- GEO Workspace v1 -->
    <GeoWorkspaceV1 v-else-if="activePanelId === 'workspace-v1'" />

    <!-- Fallback -->
    <div v-else class="geo-empty-state">
      <div class="geo-empty-state-icon">🚧</div>
      <div class="geo-empty-state-title">功能开发中</div>
      <div class="geo-empty-state-desc">敬请期待</div>
    </div>
  </GeoWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import GeoWorkspaceLayout from '~/studio-v2/workspace/brand-geo/components/GeoWorkspaceLayout.vue'
import GeoDashboard from '~/studio-v2/workspace/brand-geo/components/GeoDashboard.vue'
import BrandWizardPage from '~/studio-v2/workspace/brand-geo/pages/BrandWizardPage.vue'
import BrandListPage from '~/studio-v2/workspace/brand-geo/pages/BrandListPage.vue'
import BrandDetailPage from '~/studio-v2/workspace/brand-geo/pages/BrandDetailPage.vue'
import KeywordPage from '~/studio-v2/workspace/brand-geo/pages/KeywordPage.vue'
import KnowledgeCenterPage from '~/studio-v2/workspace/brand-geo/pages/KnowledgeCenterPage.vue'
import KnowledgeGraphPage from '~/studio-v2/workspace/brand-geo/pages/KnowledgeGraphPage.vue'
import SettingsPage from '~/studio-v2/workspace/brand-geo/pages/SettingsPage.vue'
// Sprint 3: Workflow page imports
import EvidenceListPage from '~/studio-v2/workspace/brand-geo/pages/EvidenceListPage.vue'
import EvidenceDetailPage from '~/studio-v2/workspace/brand-geo/pages/EvidenceDetailPage.vue'
import ClaimTreePage from '~/studio-v2/workspace/brand-geo/pages/ClaimTreePage.vue'
import ClaimDetailPage from '~/studio-v2/workspace/brand-geo/pages/ClaimDetailPage.vue'
import HistoryPage from '~/studio-v2/workspace/brand-geo/pages/HistoryPage.vue'
import ReportPage from '~/studio-v2/workspace/brand-geo/pages/ReportPage.vue'
import ExecutionStudioPage from '~/studio-v2/workspace/brand-geo/pages/ExecutionStudioPage.vue'
import SystemLensPage from '~/studio-v2/workspace/brand-geo/pages/SystemLensPage.vue'
import SystemControlPage from '~/studio-v2/workspace/brand-geo/pages/SystemControlPage.vue'
import SystemMetadataPage from '~/studio-v2/workspace/brand-geo/pages/SystemMetadataPage.vue'
import ExecutionTraceViewer from '~/studio-v2/workspace/brand-geo/components/runtime/ExecutionTraceViewer.vue'
import GeoWorkspaceV1 from '~/studio-v2/workspace/brand-geo-v2/GeoWorkspaceV1.vue'
import { brandService } from '~/studio-v2/workspace/brand-geo/services/brandService'
import type { GeoPanelId } from '~/studio-v2/types/geo'

const store = useBrandGeoStore()
const layoutRef = ref()
const activePanelId = ref<GeoPanelId>('dashboard')
const selectedProjectIdForDetail = ref<string | null>(null)
const lastSyncTime = ref<string | undefined>()

function onNavigate(panelId: string) {
  // Map legacy 'website' → wizard (one-click entry)
  if (panelId === 'website') panelId = 'brand-detail'
  activePanelId.value = panelId as GeoPanelId
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('panel', panelId)
    window.history.replaceState({}, '', url.toString())
  } catch {}
}

function onSelectBrand(brandId: string) {
  selectedProjectIdForDetail.value = brandId
  onNavigate('brand-detail')
}

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const panel = params.get('panel') as GeoPanelId | null
    if (panel && panel !== 'website') {
      // Map legacy 'website' → 'brand-detail'
      activePanelId.value = panel === 'website' ? 'brand-detail' : panel
    } else {
      // No panel param — check if brands exist
      try {
        const brands = await brandService.list()
        if (!brands || brands.length === 0) {
          // No brands → auto-redirect to wizard
          activePanelId.value = 'wizard'
        } else {
          activePanelId.value = 'dashboard'
        }
      } catch {
        // If we can't fetch brands, show dashboard
        activePanelId.value = 'dashboard'
      }
    }
  } catch {}
})
</script>
