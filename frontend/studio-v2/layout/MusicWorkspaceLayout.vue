<template>
  <div class="music-workspace-layout">
    <!-- 创作区（左栏 Pipeline + 中间音乐创作） -->
    <div class="music-workspace-main">
      <!-- 左栏：Pipeline -->
      <PipelineSidebar
        v-if="pipelineStages.length > 0"
        :stages="pipelineStages"
        :active-stage-id="activeStageId"
        @select="goToStage"
      />

      <!-- 中间：音乐创作 -->
      <div class="music-workspace-content">
        <MusicGenerationWorkspace />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * MusicWorkspaceLayout.vue — 音乐创作工作台布局
 *
 * 包装 MusicGenerationWorkspace，添加共享的：
 * - PipelineSidebar
 * - AssetSidebar
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getPipelineStages } from '~/studio-v2/config/workspace-config'
import PipelineSidebar from '~/studio-v2/pipeline/PipelineSidebar.vue'
import MusicGenerationWorkspace from '~/studio-v2/workspace/music-generation/MusicGenerationWorkspace.vue'

const route = useRoute()

const projectId = ref<string>('')
const projectType = ref<string>('MUSIC')
const activeStageId = ref<string>('music-generation')

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
.music-workspace-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
}

.music-workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.music-workspace-content {
  flex: 1;
  overflow: hidden;
}
</style>
