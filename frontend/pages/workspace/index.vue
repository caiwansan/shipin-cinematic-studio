<template>
  <div style="width:100%;height:100%">
    <WorkspaceShell
      v-if="projectType"
      :project-type="projectType"
      :project-id="projectId"
    />
    <div v-else class="loading">
      <div class="loading-text">加载工作台中...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * /workspace/:type/:projectId — 统一工作台路由
 *
 * 所有领域（短剧/音乐/广告/MV）都通过这一个入口进入。
 * WorkspaceShell 根据 projectType 自动选择对应布局。
 */
import { ref, onMounted } from 'vue'
import WorkspaceShell from '~/studio-v2/layout/WorkspaceShell.vue'

const route = useRoute()

const projectType = ref<string>('')
const projectId = ref<string>('')

onMounted(async () => {
  const params = route.params as any
  const query = route.query as any

  // 路由参数：/workspace/:type/:projectId
  // 或者查询参数：/workspace?type=AD&projectId=xxx
  projectType.value = params?.type?.toUpperCase() || query?.type?.toUpperCase() || ''
  projectId.value = params?.projectId || query?.projectId || query?.project || ''

  // 短剧类型映射到 StudioWorkspaceLayout（通过 /studio/v2 兼容）
  if (['SHORT_DRAMA', 'SHORT_VIDEO'].includes(projectType.value) && projectId.value) {
    window.location.href = `/studio/v2?project=${projectId.value}`
    return
  }

  // 无参数时直接返回首页
  if (!projectType.value) {
    window.location.href = '/'
  }
})
</script>

<style>
html, body, #__nuxt {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0a0a0a;
  color: #666;
}
.loading-text {
  font-size: 16px;
}
</style>
