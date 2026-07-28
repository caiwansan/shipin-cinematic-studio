<!-- EnterpriseShell — 企业数字部门外壳 (Workspace 模式) -->
<!-- 左侧导航固定 + 右侧工作区动态切换 -->
<!-- 点击导航只切换模块 — 不跳转页面 -->
<template>
  <div class="enterprise-shell" :class="{ 'shell-collapsed': collapsed }">
    <!-- 左侧导航 — 固定 -->
    <aside class="shell-sidebar">
      <slot name="sidebar">
        <EnterpriseSidebar
          :items="navItems"
          :activePath="activeModule"
          @navigate="handleModuleChange"
        />
      </slot>
    </aside>

    <!-- 右侧工作区 — slot 内容动态切换 -->
    <div class="shell-main">
      <main class="shell-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import EnterpriseSidebar from './navigation/EnterpriseSidebar.vue'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  activeModule?: string
}>(), {
  activeModule: 'dashboard',
})

const emit = defineEmits<{
  'module-change': [module: string]
}>()

// 10 个一级导航 — 昆仑镜企业数字部门 (CTO Frozen)
// FRONTEND-RECRUITMENT-ENTRY-CONSOLIDATION-01 SubTask 3:
// 'recruitment' 导航不再使用 SPA 模块切换，而是跳转到 SSOT 独立页面
const navItems = [
  { id: 'dashboard', label: '企业驾驶舱', icon: '🏠', path: 'dashboard' },
  { id: 'intelligence', label: '智能洞察', icon: '🧠', path: 'intelligence' },
  { id: 'decisions', label: '决策中心', icon: '💡', path: 'decisions' },
  { id: 'execution', label: '执行中心', icon: '🚀', path: 'execution' },
  { id: 'channels', label: '渠道中心', icon: '📡', path: 'channels' },
  { id: 'ai-employees', label: 'AI 员工中心', icon: '🤖', path: 'ai-employees' },
  { id: 'recruitment', label: 'AI 招聘中心', icon: '🎯', path: 'recruitment', isExternal: true },
  { id: 'knowledge', label: '企业知识库', icon: '📚', path: 'knowledge' },
  { id: 'growth', label: '增长分析', icon: '📈', path: 'growth' },
  { id: 'governance', label: '企业治理', icon: '🔐', path: 'governance' },
  { id: 'settings', label: '企业设置', icon: '⚙️', path: 'settings' },
]

function handleModuleChange(pathOrModule: string) {
  // FRONTEND-RECRUITMENT-ENTRY-CONSOLIDATION-01: recruitment → full page navigation to SSOT
  if (pathOrModule === 'recruitment') {
    window.location.href = '/workspace/enterprise/'
    return
  }
  const moduleId = pathOrModule.replace('/enterprise', '').replace('/', '') || 'dashboard'
  emit('module-change', moduleId)
}
</script>

<style scoped>
.enterprise-shell {
  display: flex;
  height: 100vh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
.shell-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-primary);
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
}
.shell-collapsed .shell-sidebar {
  width: 60px;
}
.shell-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.shell-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl);
}
</style>
