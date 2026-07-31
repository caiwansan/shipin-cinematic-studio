<!-- EnterpriseWorkspace — 企业数字部门工作区容器 -->
<!-- 左侧导航切换 → 右侧模块动态渲染 -->
<!-- 不跳转页面，只切换工作区内容 -->
<template>
  <div class="enterprise-workspace">
    <!-- Enterprise Identity Header -->
    <EnterpriseIdentityHeader
      :orgName="organizationName"
      :plan="organizationPlan"
      :stats="organizationStats"
      :isOnboarded="isOnboarded"
      @start-onboarding="showOnboarding = true"
      @go-home="handleGoHome"
      @go-billing="navigateTo('/workspace/enterprise/billing')"
    />

    <!-- Workspace Header: 当前模块标题 + 状态 -->
    <div class="workspace-header">
      <div class="header-left">
        <h1 class="module-title">{{ currentTitle }}</h1>
        <p class="module-subtitle">{{ currentSubtitle }}</p>
      </div>
      <div class="header-right">
        <slot name="header-right">
          <StatusBadge type="connected" label="系统正常" />
        </slot>
      </div>
    </div>

    <!-- KPI -->
    <div class="workspace-kpis">
      <slot name="kpis" />
    </div>

    <!-- Dynamic Module Content -->
    <div class="workspace-content">
      <EnterpriseModuleRenderer :module="currentModule" />
    </div>

    <!-- Onboarding Wizard -->
    <EnterpriseOnboardingWizard
      :visible="showOnboarding"
      :organizationId="organizationId"
      @complete="handleOnboardingComplete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import StatusBadge from '../../enterprise-ui/feedback/StatusBadge.vue'
import EnterpriseIdentityHeader from './EnterpriseIdentityHeader.vue'
import EnterpriseOnboardingWizard from './EnterpriseOnboardingWizard.vue'
import EnterpriseModuleRenderer from './EnterpriseModuleRenderer.vue'

const props = defineProps<{
  currentModule: string
  organizationId?: string
  organizationName?: string
  organizationPlan?: string
  organizationStats?: { agentCount?: number; channelCount?: number; aiProviderCount?: number }
  isOnboarded?: boolean
}>()

const showOnboarding = ref(false)
const activationStatus = ref<any>(null)
const checkingActivation = ref(true)

function handleGoHome() {
  navigateTo('/')
}

function handleOnboardingComplete() {
  showOnboarding.value = false
  // 重新检测激活状态
  checkActivationStatus()
}

async function checkActivationStatus() {
  try {
    const res = await fetch('/api/enterprise/agent-identity/activation/status')
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) {
        activationStatus.value = data.data
        // 未激活且未完成 → 自动显示引导
        if (!data.data.isComplete) {
          showOnboarding.value = true
        }
      }
    }
  } catch (e) {
    console.warn('[EnterpriseWorkspace] Activation check failed:', e)
  } finally {
    checkingActivation.value = false
  }
}

onMounted(() => {
  checkActivationStatus()
})

const moduleMeta: Record<string, { title: string; subtitle: string }> = {
  'dashboard': { title: '企业驾驶舱', subtitle: '今日企业全貌，AI 为您汇总经营状况' },
  'intelligence': { title: '智能洞察', subtitle: 'AI 主动发现风险与机会，辅助企业决策' },
  'decisions': { title: '决策中心', subtitle: 'AI 生成经营建议，由您确认关键决策' },
  'execution': { title: '执行中心', subtitle: 'AI 落地执行，全程透明可控' },
  'channels': { title: '渠道中心', subtitle: '管理企业微信、官网等客户触达渠道' },
  'ai-employees': { title: 'AI 员工中心', subtitle: '管理企业的数字员工团队' },
  'recruitment': { title: 'AI 招聘中心', subtitle: '智能匹配，一键找到最佳候选人' },
  'knowledge': { title: '企业知识库', subtitle: '积累企业知识资产，供 AI 和员工调用' },
  'growth': { title: '增长分析', subtitle: '收入、客户、转化、ROI 一站式分析' },
  'governance': { title: '企业治理', subtitle: '权限、审批、审计、安全管控' },
  'settings': { title: '企业设置', subtitle: '企业资料、成员、套餐、API 配置' },
}

const currentTitle = computed(() => moduleMeta[props.currentModule]?.title || '企业工作台')
const currentSubtitle = computed(() => moduleMeta[props.currentModule]?.subtitle || '')
</script>

<style scoped>
.enterprise-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-lg);
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg) var(--space-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.module-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.module-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.workspace-kpis {
  flex-shrink: 0;
}

.workspace-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
