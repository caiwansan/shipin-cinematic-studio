<!-- EnterpriseIdentityHeader — 企业身份顶部栏 -->
<!-- 显示当前企业信息: 名称、套餐、AI员工数、渠道数 -->
<!-- 数字部门归属感的核心 UI -->
<template>
  <div class="identity-bar">
    <div class="identity-left">
      <button class="btn-home" @click="$emit('go-home')" title="返回首页">
        ← 首页
      </button>
      <div class="org-avatar">{{ orgInitial }}</div>
      <div class="org-info">
        <div class="org-name-row">
          <span class="org-name">{{ orgName }}</span>
          <span class="plan-badge" :class="`plan-${plan}`">{{ planLabel }}</span>
        </div>
        <div class="org-meta">
          <span class="meta-item">🤖 {{ stats.agentCount }} AI 员工</span>
          <span class="meta-item">📡 {{ stats.channelCount }} 渠道</span>
          <span class="meta-item">🧠 {{ stats.aiProviderCount }} 模型</span>
          <span v-if="!isOnboarded" class="meta-item warning">⚠️ 初始化未完成</span>
        </div>
      </div>
    </div>
    <div class="identity-right">
      <button v-if="!isOnboarded" class="btn-onboarding" @click="$emit('start-onboarding')">
        🚀 初始化企业
      </button>
      <button class="btn-billing" @click="$emit('go-billing')">
        📦 套餐与订阅
      </button>
      <button class="btn-icon" @click="$emit('open-settings')" title="设置">⚙️</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolvePlanInfo } from '~/composables/enterprise/useEnterprisePlan'

const props = defineProps<{
  orgName: string
  plan?: string
  stats?: { agentCount?: number; channelCount?: number; aiProviderCount?: number }
  isOnboarded?: boolean
}>()

defineEmits<{
  'start-onboarding': []
  'open-settings': []
  'go-home': []
  'go-billing': []
}>()

const orgInitial = computed(() => props.orgName?.charAt(0) || '企')

/**
 * planLabel 从 Commerce Authority (TIER_MAP) 读取，
 * 不在此组件内定义任何 labels 映射。
 */
const planLabel = computed(() => {
  return resolvePlanInfo({ tier: props.plan || 'free' }).label
})
</script>

<style scoped>
.identity-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-xl);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-lg);
}

.identity-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.btn-home {
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-home:hover {
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
  background: var(--color-bg-hover);
}

.org-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: #000;
}

.org-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.org-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.org-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.plan-badge {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.plan-free { background: var(--color-bg-hover); color: var(--color-text-muted); }
.plan-trial { background: var(--color-bg-hover); color: var(--color-text-muted); }
.plan-basic { background: rgba(59, 130, 246, 0.12); color: var(--color-decision); }
.plan-professional { background: var(--color-intelligence-glow); color: var(--color-intelligence); }
.plan-pro { background: var(--color-intelligence-glow); color: var(--color-intelligence); }
.plan-enterprise { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }

.org-meta {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.meta-item {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.meta-item.warning {
  color: var(--color-warning);
}

.identity-right {
  display: flex;
  gap: var(--space-sm);
}

.btn-onboarding {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-intelligence);
  color: #000;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-onboarding:hover { opacity: 0.85; }

.btn-billing {
  padding: var(--space-xs) var(--space-md);
  background: var(--color-intelligence-glow);
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: var(--radius-md);
  color: var(--color-intelligence);
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-billing:hover {
  background: var(--color-intelligence);
  color: #000;
  border-color: var(--color-intelligence);
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-primary);
  background: transparent;
  cursor: pointer;
  font-size: var(--font-size-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover { background: var(--color-bg-hover); }
</style>
