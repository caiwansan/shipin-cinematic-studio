<!-- EnterpriseShell — 企业数字部门外壳 (Workspace 模式) -->
<!-- Sprint-13: 左侧导航固定 + 底部用户卡片 + 模型设置 + 套餐管理 -->
<!-- 右侧工作区动态切换，点击导航只切换模块 — 不跳转页面 -->
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

      <!-- 底部用户卡片：身份 + 模型设置 + 套餐入口 -->
      <WorkspaceUserCard
        :username="userName"
        :display-name="displayName"
        :org-name="orgName"
        :plan-name="planName"
        @open-model-settings="$emit('open-model-settings')"
        @open-billing="$emit('open-billing')"
      />
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
import WorkspaceUserCard from '../workspace/shared/WorkspaceUserCard.vue'

withDefaults(defineProps<{
  collapsed?: boolean
  activeModule?: string
  userName?: string
  displayName?: string
  orgName?: string
  planName?: string
}>(), {
  activeModule: 'dashboard',
  userName: '用户',
  displayName: '',
  orgName: '',
  planName: '',
})

const emit = defineEmits<{
  'module-change': [module: string]
  'open-model-settings': []
  'open-billing': []
}>()

// 12 个一级导航 — 昆仑镜企业数字部门 (CTO Frozen)
// Sprint-13: recruitment 导航跳转到 /workspace/enterprise/
const navItems = [
  { id: 'home', label: '首页', icon: '🔝', path: 'home', isExternal: true },
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
  if (pathOrModule === 'home') {
    window.location.href = '/'
    return
  }
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
  padding: 32px;
}
</style>
