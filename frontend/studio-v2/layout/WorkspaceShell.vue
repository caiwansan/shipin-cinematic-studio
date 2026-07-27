<template>
  <component :is="layoutComponent" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * WorkspaceShell.vue — 布局选择器
 *
 * 根据 projectType 自动选择对应的布局组件。
 * 这是 Workspace-SEPARATION 的前端核心抽象。
 *
 * 扩展新领域：添加 Layout 组件 + 在此注册即可。
 */
import { computed, defineComponent, h } from 'vue'
import type { WorkspaceLayoutType } from '~/studio-v2/config/workspace-config'
import { getLayoutType } from '~/studio-v2/config/workspace-config'

// ─── 布局组件懒加载 ───
const layoutModules = import.meta.glob('~/studio-v2/layout/*.vue')

const props = defineProps<{
  projectType?: string
  projectId?: string
}>()

const layoutType = computed<WorkspaceLayoutType>(() =>
  getLayoutType(props.projectType || 'SHORT_DRAMA')
)

const layoutComponent = computed(() => {
  const layoutMap: Record<WorkspaceLayoutType, string> = {
    'short-drama': 'StudioWorkspaceLayout',
    'music': 'MusicWorkspaceLayout',
    'advertisement': 'AdWorkspaceLayout',
  }
  const targetName = layoutMap[layoutType.value]

  // 从 glob 中匹配
  for (const [path, module] of Object.entries(layoutModules)) {
    if (path.includes(targetName)) {
      return defineComponent({
        render() {
          return h(module as any, this.$attrs)
        }
      })
    }
  }

  // 回退到短剧
  for (const [path, module] of Object.entries(layoutModules)) {
    if (path.includes('StudioWorkspaceLayout')) {
      return defineComponent({
        render() {
          return h(module as any, this.$attrs)
        }
      })
    }
  }

  return 'div'
})
</script>
