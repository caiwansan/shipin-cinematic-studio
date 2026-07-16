<!-- EnterpriseHeader — 顶部栏 -->
<!-- 展示：企业身份 + 角色 + 用户菜单 -->
<template>
  <div class="header">
    <div class="header-left">
      <button class="header-toggle" @click="$emit('sidebarToggle')">☰</button>
      <span class="header-breadcrumb">Command Center</span>
    </div>

    <div class="header-right">
      <slot name="header-extra" />
      
      <div class="header-role" v-if="role">
        <span class="role-badge">{{ role }}</span>
      </div>

      <div class="header-user" @click="showMenu = !showMenu">
        <span class="user-avatar">👤</span>
        <span class="user-name">{{ userName }}</span>
        <span v-if="showMenu" class="user-menu">
          <NuxtLink to="/enterprise/settings" class="menu-item">Settings</NuxtLink>
          <div class="menu-divider" />
          <button class="menu-item menu-logout" @click="$emit('logout')">Logout</button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  userName?: string
  role?: string
}>()

defineEmits<{
  sidebarToggle: []
  logout: []
}>()

const showMenu = ref(false)
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.header-toggle {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: var(--space-sm);
}
.header-toggle:hover { color: var(--color-text-primary); }
.header-breadcrumb {
  font-size: var(--font-size-md);
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.header-role {
  display: flex;
  align-items: center;
}
.role-badge {
  font-size: var(--font-size-xs);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
}

.header-user {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  position: relative;
  cursor: pointer;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  transition: background 0.2s;
}
.header-user:hover {
  background: var(--color-bg-hover);
}
.user-avatar { font-size: 18px; }
.user-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 160px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}
.menu-item {
  display: block;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}
.menu-item:hover { background: var(--color-bg-hover); }
.menu-divider { height: 1px; background: var(--color-border-primary); }
.menu-logout { color: var(--color-danger); }
</style>
