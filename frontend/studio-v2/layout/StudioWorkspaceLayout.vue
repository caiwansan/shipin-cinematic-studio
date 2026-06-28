<template>
  <div class="studio-v2-layout">
    <!-- FRE v1: First Run Wizard -->
    <FirstRunWizard
      :visible="showWizard"
      @complete="onWizardComplete"
      @skip="onWizardSkip"
    />

    <!-- 左栏：Pipeline -->
    <PipelineSidebar
      :stages="state.pipeline.stages"
      :active-stage-id="state.pipeline.activeStageId"
      @select="goToStage"
      @open-video-editor="openVideoEditor"
    />

    <!-- 中栏：Workspace / 视频编辑器 -->
    <VideoEditorWorkspace
      v-if="showVideoEditor"
      @back="closeVideoEditor"
    />
    <WorkspaceRenderer
      v-else
      :workspace-id="state.workspace.activeWorkspaceId"
      :segments="state.workspace.segments"
      class="flex-1"
    />

    <!-- 右栏：Asset OS（仅非编辑器模式显示） -->
    <AssetSidebar
      v-if="!showVideoEditor"
      :assets="filteredAssets"
      :collapsed="state.assets.collapsed"
      :active-category="state.assets.activeCategory"
      @toggle="toggleAssetSidebar"
      @set-category="setAssetCategory"
      @delete-asset="deleteAsset"
      @select-asset="onAssetSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import PipelineSidebar from '~/studio-v2/pipeline/PipelineSidebar.vue'
import WorkspaceRenderer from '~/studio-v2/workspace/WorkspaceRenderer.vue'
import VideoEditorWorkspace from '~/studio-v2/workspace/video-editor/VideoEditorWorkspace.vue'
import AssetSidebar from '~/studio-v2/assets/AssetSidebar.vue'
import FirstRunWizard from '~/components/wizard/FirstRunWizard.vue'

const showVideoEditor = ref(false)
const showWizard = ref(false)
const { state, goToStage, toggleAssetSidebar, setAssetCategory, filteredAssets, removeAsset } = useStudioStore()

function openVideoEditor() {
  showVideoEditor.value = true
}

function closeVideoEditor() {
  showVideoEditor.value = false
}

function getToken(): string {
  try {
    const getCachedToken = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }
    return getCachedToken()
  } catch { return '' }
}

function deleteAsset(asset: any) {
  removeAsset(asset.id)
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (asset.dbId && asset.type === 'character') {
    fetch('/api/execution-images/characters/' + asset.dbId, { method: 'DELETE', headers }).catch(() => {})
  } else if (asset.dbId && asset.type === 'scene') {
    fetch('/api/execution-images/scenes/' + asset.dbId, { method: 'DELETE', headers }).catch(() => {})
  }
}

function onAssetSelected(asset: any) {
  if (typeof window.__onAssetPickCallback === 'function') {
    window.__onAssetPickCallback(asset)
  }
}

onMounted(async () => {
  // FRE v1: 检测用户是否已配置 Provider
  try {
    const token = localStorage.getItem('auth_token')
    if (token) {
      const res = await fetch('/api/providers/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (!data.configured) {
          showWizard.value = true
        }
      } else {
        showWizard.value = true
      }
    } else {
      // 未登录用户不弹 Wizard
    }
  } catch {
    showWizard.value = true
  }

  function onWizardComplete() {
    showWizard.value = false
  }

  function onWizardSkip() {
    showWizard.value = false
  }

  // 监听 AI 导演工作区发来的打开编辑器事件
  window.addEventListener('open-video-editor', () => {
    openVideoEditor()
  })

  const params = new URLSearchParams(window.location.search)
  const projectId = params.get('projectId') || params.get('project')
  if (projectId) {
    const { loadFromServer, setProjectId, goToStage } = useStudioStore()
    setProjectId(projectId)
    const loaded = await loadFromServer(projectId)
    if (!loaded) {
      console.warn('[StudioWorkspaceLayout] 项目加载失败，跳转回项目列表')
      window.location.href = '/projects'
      return
    }
    const stage = params.get('stage')
    if (stage) goToStage(stage as any)
  } else {
    try {
      const pid = localStorage.getItem('last_project_id')
      if (pid) {
        const { loadFromServer, setProjectId } = useStudioStore()
        try {
          await loadFromServer(pid)
          setProjectId(pid)
        } catch {
          localStorage.removeItem('last_project_id')
          localStorage.removeItem('pipeline_state')
        }
      }
    } catch { }
  }
})
</script>

<style scoped>
.studio-v2-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
}

.editor-main-area {
  flex: 1;
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.editor-toolbar-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: #11151c;
  border-left: 1px solid #1f2937;
  overflow-y: auto;
}

.flex-1 { flex: 1; }
</style>
