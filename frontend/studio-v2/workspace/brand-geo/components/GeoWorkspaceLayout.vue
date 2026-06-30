<template>
  <div class="geo-workspace-layout">
    <!-- Left Sidebar -->
    <BrandGEOSidebar
      :active-panel-id="activePanelId"
      @navigate="onNavigate"
    />

    <!-- Main Content Area -->
    <main class="geo-main-area">
      <!-- Unified Top Bar -->
      <GeoTopBar
        :title="panelTitle"
        :loading="store.loading"
        :error="displayError"
        :project-name="store.selectedV2Project?.name"
        @dismiss-error="displayError = null"
      />

      <!-- Unified Content Body -->
      <div class="geo-content-body">
        <slot />
      </div>

      <!-- Unified Status Bar -->
      <GeoStatusBar
        v-if="showStatusBar"
        :project-id="store.selectedV2ProjectId"
        :brand-count="brandCount"
        :ko-count="koCount"
        :last-sync="lastSync"
      />
    </main>

    <!-- Unified Toast -->
    <GeoToast
      v-if="toastMessage"
      :message="toastMessage"
      :type="toastType"
      @close="toastMessage = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BrandGEOSidebar from '~/studio-v2/workspace/brand-geo/components/BrandGEOSidebar.vue'
import GeoTopBar from '~/studio-v2/workspace/brand-geo/components/GeoTopBar.vue'
import GeoStatusBar from '~/studio-v2/workspace/brand-geo/components/GeoStatusBar.vue'
import GeoToast from '~/studio-v2/workspace/brand-geo/components/GeoToast.vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'

const store = useBrandGeoStore()
const emit = defineEmits<{
  navigation: [panelId: string]
  error: [message: string]
}>()

const props = defineProps<{
  activePanelId: string
  showStatusBar?: boolean
  brandCount?: number
  koCount?: number
  lastSync?: string
}>()

const displayError = ref<string | null>(null)
const toastMessage = ref<string | null>(null)
const toastType = ref<'success' | 'error' | 'info'>('info')

const panelMeta: Record<string, { title: string; icon: string }> = {
  dashboard: { title: '工作台', icon: '📊' },
  wizard: { title: '品牌分析', icon: '🚀' },
  brands: { title: '品牌', icon: '🏢' },
  'brand-detail': { title: '品牌详情', icon: '📋' },
  website: { title: '官网管理', icon: '🌐' },
  keywords: { title: '搜索词', icon: '🔑' },
  knowledge: { title: '知识内容', icon: '📚' },
  'knowledge-graph': { title: '关系图', icon: '🔗' },
  evidence: { title: '来源', icon: '📄' },
  claim: { title: '事实', icon: '📋' },
  history: { title: '历史', icon: '📜' },
  report: { title: '报告', icon: '📄' },
  settings: { title: '设置', icon: '⚙️' },
  // Developer panels
  'execution-studio': { title: '执行工作室', icon: '🎬' },
  'execution-trace': { title: '分析记录', icon: '📋' },
  'system-lens': { title: '系统镜头', icon: '🔬' },
  'system-control': { title: '系统控制', icon: '⚙️' },
  'system-metadata': { title: '配置信息', icon: '🌐' },
}

const panelTitle = computed(() => panelMeta[props.activePanelId]?.title || '品牌GEO')

function onNavigate(panelId: string) {
  emit('navigation', panelId)
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => { toastMessage.value = null }, 4000)
}

function showError(message: string) {
  displayError.value = message
  emit('error', message)
  showToast(message, 'error')
}

defineExpose({ showToast, showError })
</script>

<style scoped>
.geo-workspace-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--geo-bg, #0b0f14);
  color: var(--geo-text, #e2e8f0);
}

.geo-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.geo-content-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 24px;
}
</style>
