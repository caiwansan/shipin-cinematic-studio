<template>
  <div class="ad-workspace-layout">
    <!-- 创作区（左栏 Pipeline + 中间广告创作） -->
    <div class="ad-workspace-main">
      <!-- 左栏：Pipeline -->
      <PipelineSidebar
        v-if="pipelineStages.length > 0"
        :stages="pipelineStages"
        :active-stage-id="activeStageId"
        @select="goToStage"
      />

      <!-- 中间：广告创作 -->
      <div class="ad-workspace-content">
        <AdvertisementWorkspace />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * AdWorkspaceLayout.vue — 广告制作工作台布局
 *
 * 包装 AdvertisementWorkspace，添加共享的：
 * - PipelineSidebar
 * - AssetSidebar
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getPipelineStages } from '~/studio-v2/config/workspace-config'
import PipelineSidebar from '~/studio-v2/pipeline/PipelineSidebar.vue'
import AdvertisementWorkspace from '~/studio-v2/workspace/advertisement/AdvertisementWorkspace.vue'

const route = useRoute()

const projectId = ref<string>('')
const projectType = ref<string>('AD')
const activeStageId = ref<string>('storyboard')

const pipelineStages = computed(() =>
  getPipelineStages(projectType.value)
)

function goToStage(stageKey: string) {
  activeStageId.value = stageKey
}

onMounted(async () => {
  const params = route.params as any
  if (params.projectId) {
    projectId.value = params.projectId
  }
})
</script>

<style scoped>
.ad-workspace-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
}

.ad-workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.ad-workspace-content {
  flex: 1;
  overflow: hidden;
}
</style>
