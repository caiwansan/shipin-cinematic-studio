<!--
  Enterprise Workspace Layout — Recruitment 工作区壳层

  Sprint-13: 统一 Workspace Shell
  结构: EnterpriseShell (左导航+用户卡片) → 递归页面内容
  所有 /workspace/enterprise 页面在此 Layout 下运行
-->
<template>
  <EnterpriseShell
    :userName="(user?.username || '')"
    :displayName="(user?.displayName || user?.nickname || user?.username || '')"
    :orgName="orgName"
    :planName="planName"
    @open-model-settings="showModelSettings = true"
    @open-billing="navigateTo('/workspace/enterprise/billing')"
  >
    <div class="ew-content">
      <!-- Recruitment 子导航 -->
      <div class="ew-subnav">
        <NuxtLink
          v-for="item in subNavItems"
          :key="item.path"
          :to="item.path"
          class="ew-subnav-item"
          :class="{ active: isActive(item.path) }"
        >
          <span class="ew-subnav-label">{{ item.label }}</span>
        </NuxtLink>
      </div>

      <!-- 页面内容 -->
      <slot />
    </div>
  </EnterpriseShell>

  <!-- 模型设置弹窗 -->
  <ModelSettingsModal
    :visible="showModelSettings"
    filterCapability="llm"
    @close="showModelSettings = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EnterpriseShell from '~/components/enterprise-ui/EnterpriseShell.vue'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'

const route = useRoute()
const navigateTo = useRouter().push
const showModelSettings = ref(false)

// 用户/组织/套餐数据
const user = ref<any>(null)
const orgName = ref('')
const planName = ref('')

// 招聘子导航
const subNavItems = [
  { label: '招聘驾驶舱', path: '/workspace/enterprise/' },
  { label: '职位管理', path: '/workspace/enterprise/jobs' },
  { label: '人才库', path: '/workspace/enterprise/talent' },
  { label: '候选人', path: '/workspace/enterprise/candidates' },
  { label: '面试管理', path: '/workspace/enterprise/interview' },
  // UX-05: 招聘渠道中心（Phase 1: 渠道入口 → 昆仑镜 AI 筛选/面试/评估）
  { label: '渠道中心', path: '/workspace/enterprise/channels' },
  { label: 'AI 招聘团队', path: '/workspace/enterprise/ai-employees' },
  // SPRINT-IDENTITY-REALITY-FIX-01: AI 模型设置（BYOK，企业资产）
  { label: 'AI 模型设置', path: '/workspace/enterprise/model-settings' },
]

function isActive(path: string): boolean {
  const current = route.path
  if (path === '/workspace/enterprise/') {
    return current === '/workspace/enterprise/' || current === '/workspace/enterprise'
  }
  return current.startsWith(path)
}

onMounted(async () => {
  try {
    // 获取用户信息
    const token = localStorage.getItem('auth_token')
    if (!token) return

    const meRes = await fetch('https://aigc.fushtn.com/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const meData = await meRes.json()
    if (meData?.success) {
      user.value = meData.data.user
    }

    // 获取套餐信息
    const subRes = await fetch('https://aigc.fushtn.com/api/enterprise/subscription/current', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const subData = await subRes.json()
    if (subData?.success && subData?.data?.hasSubscription) {
      planName.value = subData.data.planName || ''
    }

    // 获取企业信息
    try {
      const orgRes = await fetch('https://aigc.fushtn.com/api/enterprise/home', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const orgData = await orgRes.json()
      if (orgData?.enterpriseName) {
        orgName.value = orgData.enterpriseName
      }
    } catch { /* non-fatal */ }
  } catch (e) {
    console.error('Failed to load workspace identity', e)
  }

  // Fallback if displayName is still empty — derive from username
  if (user.value && (!user.value.nickname || user.value.nickname === user.value.username)) {
    const u = user.value.username
    // Try to get a friendlier name for common usernames
  }
})
</script>

<style scoped>
.ew-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ew-subnav {
  display: flex;
  gap: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-primary, #334155);
  overflow-x: auto;
}

.ew-subnav-item {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted, #94A3B8);
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.15s;
}

.ew-subnav-item:hover {
  color: var(--color-text-secondary, #CBD5E1);
  background: var(--color-bg-hover, #1e293b);
}

.ew-subnav-item.active {
  color: var(--color-text-primary, #F1F5F9);
  background: var(--color-bg-elevated, #1e293b);
  font-weight: 600;
}

.ew-subnav-label {
  pointer-events: none;
}
</style>
