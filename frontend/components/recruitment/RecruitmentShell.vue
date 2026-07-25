<!-- RecruitmentShell — 招聘运营平台外壳 -->
<!-- UX-03: 现代企业 SaaS 风格，左侧导航 + 右侧内容区 -->
<template>
  <div class="rec-shell">
    <aside class="rec-sidebar">
      <div class="rec-sidebar-brand">
        <span class="rec-brand-name">昆仑镜</span>
      </div>
      <div class="rec-sidebar-home">
        <NuxtLink to="/" class="rec-home-link" title="返回昆仑镜首页">
          ← 返回首页
        </NuxtLink>
      </div>
      <nav class="rec-nav">
        <div class="rec-nav-group">
          <span class="rec-nav-label">平台</span>
          <NuxtLink
            v-for="item in navItems"
            :key="item.id"
            :to="item.path"
            class="rec-nav-item"
            :class="{ active: isActive(item.path) }"
          >
            <span class="rec-nav-text">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>
    <main class="rec-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const navItems = [
  { id: 'overview', label: '概览', path: '/workspace/enterprise' },
  { id: 'conversations', label: '沟通', path: '/workspace/enterprise/conversations' },
  { id: 'candidates', label: '候选人', path: '/workspace/enterprise/candidates' },
  { id: 'interviews', label: '面试', path: '/workspace/enterprise/interviews' },
  { id: 'jobs', label: '职位', path: '/workspace/enterprise/jobs' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.rec-shell {
  display: flex;
  height: 100vh;
  background: var(--rec-bg-primary);
  font-family: var(--rec-font);
}

.rec-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--rec-bg-secondary);
  border-right: 1px solid var(--rec-border-primary);
  display: flex;
  flex-direction: column;
}

.rec-sidebar-brand {
  padding: var(--rec-space-6) var(--rec-space-6) var(--rec-space-4);
  border-bottom: 1px solid var(--rec-border-secondary);
}

.rec-sidebar-home {
  padding: var(--rec-space-2) var(--rec-space-3);
  border-bottom: 1px solid var(--rec-border-secondary);
}

.rec-home-link {
  display: flex;
  align-items: center;
  padding: var(--rec-space-2) var(--rec-space-3);
  border-radius: var(--rec-radius-md);
  font-size: var(--rec-text-sm, 0.8rem);
  color: var(--rec-text-muted);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.rec-home-link:hover {
  background: var(--rec-bg-hover);
  color: var(--rec-text-primary);
}

.rec-brand-name {
  font-size: var(--rec-text-lg);
  font-weight: 600;
  color: var(--rec-text-primary);
}

.rec-nav {
  flex: 1;
  padding: var(--rec-space-4) 0;
  overflow-y: auto;
}

.rec-nav-group {
  padding: 0 var(--rec-space-3);
}

.rec-nav-label {
  display: block;
  font-size: var(--rec-text-xs);
  font-weight: 600;
  color: var(--rec-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: var(--rec-space-2) var(--rec-space-3);
  margin-bottom: var(--rec-space-1);
}

.rec-nav-item {
  display: flex;
  align-items: center;
  padding: var(--rec-space-2) var(--rec-space-3);
  border-radius: var(--rec-radius-md);
  font-size: var(--rec-text-md);
  color: var(--rec-text-secondary);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
}

.rec-nav-item:hover {
  background: var(--rec-bg-hover);
  color: var(--rec-text-primary);
}

.rec-nav-item.active {
  background: var(--rec-brand-light);
  color: var(--rec-brand);
  font-weight: 500;
}

.rec-main {
  flex: 1;
  overflow-y: auto;
  background: var(--rec-bg-primary);
}
</style>
