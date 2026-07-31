<!-- RecruitmentWorkspaceNav — AI 招聘工作台二级导航 -->
<!--
  P0-1: 修复事故恢复不完整导致的 IA 断裂
  恢复产品结构：AI招聘部门 / 职位管理 / 人才匹配 / 简历管理 / 面试管理 / AI员工
-->
<template>
  <div class="rec-nav">
    <div class="rec-nav-items">
      <NuxtLink
        v-for="item in navItems"
        :key="item.id"
        :to="item.to"
        class="rec-nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <span class="rec-nav-icon">{{ item.icon }}</span>
        <span class="rec-nav-label">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

interface NavItem {
  id: string
  label: string
  icon: string
  to: string
}

const navItems: NavItem[] = [
  { id: 'home',        label: 'AI 招聘部门', icon: '🤖', to: '/workspace/enterprise/' },
  { id: 'jobs',        label: '职位管理',    icon: '📋', to: '/workspace/enterprise/jobs' },
  { id: 'talent',      label: '人才匹配',    icon: '🔍', to: '/workspace/enterprise/talent' },
  { id: 'resumes',     label: '简历管理',    icon: '📄', to: '/workspace/enterprise/candidates' },
  { id: 'interview',   label: '面试管理',    icon: '🎤', to: '/workspace/enterprise/interview' },
  { id: 'ai-employees', label: 'AI 员工',    icon: '🤖', to: '/workspace/enterprise/AgentCapabilityCenter' },
]

function isActive(path: string): boolean {
  const currentPath = route.path
  // 精确匹配
  if (currentPath === path) return true
  // /workspace/enterprise/ 结尾的也匹配首页
  if (path === '/workspace/enterprise/' && (currentPath === '/workspace/enterprise' || currentPath === '/workspace/enterprise/')) return true
  // 子路径不匹配（避免 /jobs/id 高亮 home）
  return false
}
</script>

<style scoped>
.rec-nav {
  background: var(--color-bg-primary, #0D1328);
  border-bottom: 1px solid var(--color-border-primary, #1A2240);
  padding: 0 16px;
  display: flex;
  align-items: center;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.rec-nav-items {
  display: flex;
  gap: 2px;
  padding: 8px 0;
}
.rec-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #6B7280;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.15s ease;
  cursor: pointer;
}
.rec-nav-item:hover {
  background: rgba(255,255,255,0.05);
  color: #D1D5DB;
}
.rec-nav-item.active {
  background: rgba(59,130,246,0.12);
  color: #60A5FA;
  font-weight: 500;
}
.rec-nav-icon {
  font-size: 16px;
  line-height: 1;
}
.rec-nav-label {
  line-height: 1;
}
</style>
