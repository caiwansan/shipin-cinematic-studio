<template>
  <div class="asset-center">
    <div class="asset-center-header">
      <div>
        <h2 class="asset-center-title">📦 资产中心</h2>
        <p class="asset-center-subtitle">统一资产管理 — 所有工作空间的资产中央仓库</p>
      </div>
      <button v-if="projectId" class="asset-refresh-btn" @click="refresh">
        🔄 刷新
      </button>
    </div>

    <!-- Stats cards -->
    <div v-if="projectId" class="asset-stats-row">
      <div
        v-for="card in statsCards"
        :key="card.label"
        class="asset-stat-card"
        :style="{ borderLeftColor: card.color }"
      >
        <span class="asset-stat-icon">{{ card.icon }}</span>
        <div class="asset-stat-body">
          <span class="asset-stat-number">{{ card.value }}</span>
          <span class="asset-stat-label">{{ card.label }}</span>
        </div>
      </div>
    </div>

    <!-- Asset list (uses AssetList component) -->
    <div v-if="projectId" class="asset-center-content">
      <AssetList
        ref="assetListRef"
        :project-id="projectId"
        @select="onSelectAsset"
        @loaded="onAssetsLoaded"
      />
    </div>

    <!-- No project selected -->
    <div v-else class="asset-center-no-project">
      <div class="asset-empty-icon">📂</div>
      <p class="asset-empty-text">请先选择一个项目</p>
      <p class="asset-empty-hint">在 Dashboard 中选择或创建一个项目后，即可查看资产</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import AssetList from '~/modules/asset/components/AssetList.vue'
import type { UnifiedAsset } from '~/modules/asset/types/index'
import { assetService } from '~/modules/asset/services/asset.service'

const props = defineProps<{
  projectId?: string
}>()

const emit = defineEmits<{
  select: [asset: UnifiedAsset]
  navigate: [panelId: string]
}>()

const assetListRef = ref<InstanceType<typeof AssetList> | null>(null)
const statsCards = ref<{ icon: string; label: string; value: number | string; color: string }[]>([])

function onSelectAsset(asset: UnifiedAsset) {
  emit('select', asset)
}

function onAssetsLoaded(_items: UnifiedAsset[], _total: number) {
  loadStats()
}

async function loadStats() {
  if (!props.projectId) return
  const stats = await assetService.getStats(props.projectId)
  const cards: { icon: string; label: string; value: number | string; color: string }[] = [
    { icon: '📦', label: '总资产数', value: stats.total || 0, color: '#6366f1' },
    { icon: '📄', label: '文章', value: (stats as any).Article || 0, color: '#06b6d4' },
    { icon: '❓', label: 'FAQ', value: (stats as any).FAQ || 0, color: '#10b981' },
    { icon: '📚', label: '文档/API', value: ((stats as any).Document || 0) + ((stats as any).API || 0), color: '#8b5cf6' },
    { icon: '🖼️', label: '图片', value: (stats as any).Image || 0, color: '#f59e0b' },
    { icon: '🎬', label: '视频', value: (stats as any).Video || 0, color: '#ef4444' },
    { icon: '🤖', label: '提示词', value: (stats as any).Prompt || 0, color: '#ec4899' },
    { icon: '🌐', label: '网站', value: (stats as any).Website || 0, color: '#14b8a6' },
    { icon: '🏷️', label: '品牌', value: (stats as any).Brand || 0, color: '#a855f7' },
  ]
  statsCards.value = cards
}

function refresh() {
  assetListRef.value?.refresh()
  loadStats()
}

watch(() => props.projectId, () => {
  if (props.projectId) refresh()
})

onMounted(() => {
  if (props.projectId) loadStats()
})
</script>

<style scoped>
.asset-center { padding: 24px; height: 100%; overflow-y: auto; }
.asset-center-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 24px;
}
.asset-center-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 4px; }
.asset-center-subtitle { font-size: 13px; color: #6b7280; margin: 0; }
.asset-refresh-btn {
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
  color: #a5b4fc; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer;
}
.asset-stats-row {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;
}
.asset-stat-card {
  background: #11151c; border-radius: 12px; padding: 14px;
  display: flex; align-items: center; gap: 12px; border-left: 3px solid;
}
.asset-stat-icon { font-size: 24px; }
.asset-stat-body { display: flex; flex-direction: column; }
.asset-stat-number { font-size: 18px; font-weight: 700; color: #e2e8f0; }
.asset-stat-label { font-size: 11px; color: #6b7280; }
.asset-center-content { min-height: 200px; }
.asset-center-no-project {
  text-align: center; padding: 80px 0; color: #6b7280;
}
.asset-empty-icon { font-size: 48px; margin-bottom: 16px; }
.asset-empty-text { font-size: 16px; color: #9ca3af; margin-bottom: 8px; }
.asset-empty-hint { font-size: 13px; color: #4b5563; }
</style>
