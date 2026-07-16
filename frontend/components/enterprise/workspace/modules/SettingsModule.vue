<template>
  <div class="settings-module">
    <section class="section">
      <h2 class="section-title">企业资料</h2>
      <div class="setting-grid">
        <div class="setting-item"><span class="setting-label">企业名称</span><span class="setting-value">{{ orgName }}</span></div>
        <div class="setting-item"><span class="setting-label">企业套餐</span><span class="setting-value">{{ plan }}</span></div>
        <div class="setting-item"><span class="setting-label">API 密钥</span><span class="setting-value">{{ apiKey }}</span></div>
        <div class="setting-item"><span class="setting-label">账单周期</span><span class="setting-value">{{ billingCycle }}</span></div>
      </div>
    </section>
    <section class="section">
      <h2 class="section-title">成员管理</h2>
      <EmptyState icon="👥" title="暂无成员数据" description="管理企业成员权限，分配数字员工角色。" helper-text="支持 SSO、SCIM、API Key 管理" />
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'
const orgName = ref('—')
const plan = ref('—')
const apiKey = ref('—')
const billingCycle = ref('—')
onMounted(() => { /* TODO: 接入 Org Settings API */ })
</script>
<style scoped>
.settings-module { display: flex; flex-direction: column; gap: var(--space-lg); }
.section { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-xl); padding: var(--space-xl); }
.section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-lg); color: var(--color-text-primary); }
.setting-grid { display: flex; flex-direction: column; gap: var(--space-sm); }
.setting-item { display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border-primary); }
.setting-label { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.setting-value { font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
</style>
