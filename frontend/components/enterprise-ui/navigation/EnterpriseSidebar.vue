<!-- EnterpriseSidebar — 左侧导航 -->
<!-- CTO Frozen: 10 个一级导航 -->
<!-- 禁止: Tasks, Dashboard, Tools, Apps -->
 * 可以消费 EnterpriseContext (展示业务上下文)
 */
<template>
  <div class="sidebar">
    <div class="sidebar-logo">
      <span class="logo-icon">🏢</span>
      <span class="logo-text" v-if="!collapsed">Enterprise</span>
    </div>

    <nav class="sidebar-nav">
      <!-- 使用 div 而非 NuxtLink: Workspace 模式禁止页面跳转 -->
      <div
        v-for="item in items"
        :key="item.id"
        class="nav-item"
        :class="{ active: activePath === item.path }"
        @click="handleNavigate(item.path)"
      >
        <span class="nav-icon">{{ item.icon || '●' }}</span>
        <span class="nav-label" v-if="!collapsed">{{ item.label }}</span>
      </div>
    </nav>

    <div class="sidebar-footer" v-if="!collapsed">
      <slot name="sidebar-extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface NavItem {
  id: string
  label: string
  path: string
  icon?: string
}

defineProps<{
  items: NavItem[]
  activePath: string
  collapsed?: boolean
}>()

const emit = defineEmits<{
  navigate: [path: string]
}>()

function handleNavigate(path: string) {
  emit('navigate', path)
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border-primary);
}
.logo-icon { font-size: 20px; }
.logo-text { font-size: var(--font-size-lg); font-weight: 700; }

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md);
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: all 0.2s;
  cursor: pointer;
}
.nav-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}
.nav-item.active {
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
  font-weight: 500;
}
.nav-icon { font-size: var(--font-size-md); width: 20px; text-align: center; }
.nav-label { white-space: nowrap; }

.sidebar-footer {
  border-top: 1px solid var(--color-border-primary);
  padding: var(--space-md);
}
</style>
