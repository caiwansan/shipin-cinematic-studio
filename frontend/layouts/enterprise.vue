/**
 * Enterprise Layout — Workspace 模式
 *
 * CTO Frozen: 所有 Enterprise 页面必须在此 Layout 下运行
 * 结构: EnterpriseShell > EnterpriseWorkspace (动态模块切换)
 *
 * Sprint-08I: 从 API 读取企业身份，不再硬编码 plan/org info
 */
<template>
  <EnterpriseShell
    :activeModule="currentModule"
    :org-name="orgName"
    :plan-name="orgPlanName"
    @module-change="handleModuleChange"
  >
    <EnterpriseWorkspace
      :currentModule="currentModule"
      :organizationId="orgId"
      :organizationName="orgName"
      :organizationPlan="orgPlanTier"
      :organizationStats="{ agentCount, channelCount, aiProviderCount }"
      :isOnboarded="isOnboarded"
    />
  </EnterpriseShell>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EnterpriseShell from '~/components/enterprise-ui/EnterpriseShell.vue'
import EnterpriseWorkspace from '~/components/enterprise/workspace/EnterpriseWorkspace.vue'

const route = useRoute()
const currentModule = ref('dashboard')

/* ── API-driven state (was hardcoded) ── */
const orgId = ref('')
const orgName = ref('昆仑镜科技')
const orgPlanTier = ref('free')
const orgPlanName = ref('')
const agentCount = ref(0)
const channelCount = ref(0)
const aiProviderCount = ref(0)
const isOnboarded = ref(false)

async function loadEnterpriseContext() {
  try {
    const token = getAuthToken?.() || ''
    // Fetch subscription info for plan & org
    const subRes = await fetch('/api/enterprise/subscription/current', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (subRes.ok) {
      const subJson = await subRes.json()
      const subData = subJson?.data
      if (subData?.hasSubscription) {
        orgPlanTier.value = subData.planTier || 'free'
        orgPlanName.value = subData.planName || ''
      }
    }

    // Fetch agent profiles to get org name & counts
    const agentRes = await fetch('/api/enterprise/agent-profiles', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (agentRes.ok) {
      const agentJson = await agentRes.json()
      const agents = agentJson?.data || agentJson || []
      if (Array.isArray(agents) && agents.length > 0) {
        orgName.value = agents[0]?.organizationName || agents[0]?.orgName || orgName.value
        orgId.value = agents[0]?.organizationId || ''
        agentCount.value = agents.length
      }
    }

    // Fetch LLM config count
    const llmRes = await fetch('/api/enterprise/llm-config', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (llmRes.ok) {
      const llmJson = await llmRes.json()
      const configs = llmJson?.data || []
      if (Array.isArray(configs)) {
        aiProviderCount.value = configs.length
      }
    }

    isOnboarded.value = true
  } catch {
    // Non-fatal: keep defaults
  }
}

/* ── Fallback for environments without getAuthToken ── */
function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem('auth_token') || ''
  } catch {
    return ''
  }
}

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
onMounted(loadEnterpriseContext)

// 监听路由变化 (浏览器前进/后退)
watch(() => route.path, () => {
  initFromRoute()
})
</script>
