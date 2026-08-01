<!--
  MediaWorkspaceShell — 新媒体运营工作台产品壳

  Sprint-MEDIA-UX-01: 复用现有 Workspace 模式（recruitment 自含壳风格）
  - 7 模块子导航（3 实装 + 4 预留，预留明确标注「规划中」，无假功能）
  - WorkspaceSwitcher 复用现有组件
  - 本组件只负责壳结构，不包含任何业务数据
-->
<template>
  <div class="mws">
    <!-- ═══ Header ═══ -->
    <div class="mws-header">
      <div class="mws-header-left">
        <button class="mws-back" title="返回昆仑镜首页" @click="goHome">← 首页</button>
        <div class="mws-title-group">
          <h1 class="mws-title">📣 新媒体运营</h1>
          <p class="mws-subtitle">AI 员工接管真实业务资产 · 持续产生业务结果</p>
        </div>
      </div>
      <div class="mws-header-right">
        <span class="mws-badge mws-badge-preview">运营中心 · 真实数据</span>
        <WorkspaceSwitcher />
      </div>
    </div>

    <!-- ═══ 7 模块子导航 ═══ -->
    <div class="mws-subnav">
      <NuxtLink
        v-for="item in subNavItems"
        :key="item.path"
        :to="item.path"
        class="mws-subnav-item"
        :class="{ 'is-active': isActive(item.path), 'is-planned': item.planned }"
      >
        <span class="mws-subnav-icon">{{ item.icon }}</span>
        <span class="mws-subnav-label">{{ item.label }}</span>
        <span v-if="item.planned" class="mws-subnav-tag">规划中</span>
      </NuxtLink>
    </div>

    <!-- ═══ 页面内容 ═══ -->
    <div class="mws-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'

const route = useRoute()
const router = useRouter()

const goHome = () => router.push('/')

const subNavItems = [
  { icon: '🏠', label: '运营总览', path: '/workspace/media/', planned: false },
  { icon: '🔗', label: '账号管理', path: '/workspace/media/accounts', planned: false },
  { icon: '📝', label: '内容中心', path: '/workspace/media/content', planned: false },
  { icon: '💬', label: '消息互动', path: '/workspace/media/messages', planned: true },
  { icon: '👥', label: '客户管理', path: '/workspace/media/customers', planned: true },
  { icon: '📊', label: '数据分析', path: '/workspace/media/analytics', planned: true },
  { icon: '🧑‍💼', label: '团队管理', path: '/workspace/media/team', planned: false },
]

function isActive(path: string) {
  const p = path === '/workspace/media/' ? '/workspace/media' : path
  return route.path === p || route.path.startsWith(p + '/')
}
</script>

<style scoped>
.mws {
  min-height: 100vh;
  background: #f7f8fa;
}
.mws-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px;
  background: #fff;
  border-bottom: 1px solid #ececf1;
}
.mws-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.mws-back {
  border: 1px solid #e2e2ea;
  background: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
}
.mws-back:hover {
  background: #f5f5f8;
}
.mws-title-group {
  display: flex;
  flex-direction: column;
}
.mws-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.mws-subtitle {
  font-size: 12px;
  color: #8a8a9e;
  margin: 2px 0 0;
}
.mws-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mws-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
}
.mws-badge-preview {
  background: #fff4e0;
  color: #b26a00;
  border: 1px solid #ffe2ae;
}
.mws-subnav {
  display: flex;
  gap: 4px;
  padding: 0 28px;
  background: #fff;
  border-bottom: 1px solid #ececf1;
  overflow-x: auto;
}
.mws-subnav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  font-size: 13px;
  color: #5a5a70;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.mws-subnav-item:hover {
  color: #1a1a2e;
}
.mws-subnav-item.is-active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  font-weight: 600;
}
.mws-subnav-item.is-planned {
  color: #b0b0c0;
}
.mws-subnav-icon {
  font-size: 14px;
}
.mws-subnav-tag {
  font-size: 10px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 10px;
  padding: 1px 6px;
}
.mws-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 28px 48px;
}
</style>
