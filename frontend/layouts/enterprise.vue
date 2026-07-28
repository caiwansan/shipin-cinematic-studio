/**
 * Enterprise Layout — Workspace 模式
 * 
 * CTO Frozen: 所有 Enterprise 页面必须在此 Layout 下运行
 * 结构: EnterpriseShell > EnterpriseWorkspace (动态模块切换)
 * 禁止: NuxtPage — 使用模块组件切换
 */
<template>
  <EnterpriseShell :activeModule="currentModule" @module-change="handleModuleChange">
    <EnterpriseWorkspace
      :currentModule="currentModule"
      :organizationId="currentModule"
      organizationName="昆仑镜科技"
      organizationPlan="pro"
      :organizationStats="{ agentCount: 3, channelCount: 2, aiProviderCount: 2 }"
      :isOnboarded="false"
    />
  </EnterpriseShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import EnterpriseShell from '~/components/enterprise-ui/EnterpriseShell.vue'
import EnterpriseWorkspace from '~/components/enterprise/workspace/EnterpriseWorkspace.vue'

const route = useRoute()
const currentModule = ref('dashboard')

// 从 URL / 路由初始化模块
function initFromRoute() {
  const mod = route.query.module as string
  if (mod) {
    currentModule.value = mod
    return
  }
  const path = route.path

  // ─── TASK-UX-01: /workspace/enterprise 根路径 → recruitment 模块 ───
  if (path === '/workspace/enterprise' || path === '/workspace/enterprise/' || path === '/workspace/enterprise?recruitment') {
    currentModule.value = 'recruitment'
    return
  }

  // ─── TASK-UX-02: recruitment 子页面路径 → 全部回到 recruitment 模块 ───
  // 防止跳转到 jobs/talent/candidates/interview 时落入 dashboard
  const recSubPages = ['/jobs', '/talent', '/candidates', '/interview', '/onboarding']
  for (const sub of recSubPages) {
    if (path.startsWith('/workspace/enterprise' + sub)) {
      currentModule.value = 'recruitment'
      return
    }
  }

  // ─── 其他工作区模块 ───
  if (path.includes('/intelligence')) currentModule.value = 'intelligence'
  else if (path.includes('/decisions')) currentModule.value = 'decisions'
  else if (path.includes('/execution')) currentModule.value = 'execution'
  else if (path.includes('/channels')) currentModule.value = 'channels'
  else if (path.includes('/people')) currentModule.value = 'ai-employees'
  else if (path.includes('/recruitment')) currentModule.value = 'recruitment'
  else if (path.includes('/knowledge')) currentModule.value = 'knowledge'
  else if (path.includes('/growth')) currentModule.value = 'growth'
  else if (path.includes('/governance')) currentModule.value = 'governance'
  else if (path.includes('/settings')) currentModule.value = 'settings'
  else currentModule.value = 'dashboard'
}

// 切换模块 — 更新 URL 不刷新页面
function handleModuleChange(moduleId: string) {
  currentModule.value = moduleId
  const url = new URL(window.location.href)
  url.searchParams.set('module', moduleId)
  window.history.replaceState({}, '', url.toString())
}

// 初始化
initFromRoute()

// 监听路由变化 (浏览器前进/后退)
watch(() => route.path, () => {
  initFromRoute()
})
</script>
