<template>
  <div class="governance-module">
    <section class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ members }}</span><span class="stat-label">企业成员</span></div>
      <div class="stat-item"><span class="stat-value">{{ pendingApprovals }}</span><span class="stat-label">待审批</span></div>
      <div class="stat-item"><span class="stat-value text-green">{{ pendingAudits }}</span><span class="stat-label">合规项</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">权限与审批</h2>
      <EmptyState icon="🔐" title="企业治理控制台" description="管理权限、审批流程、安全审计，保障企业数据安全。" helper-text="支持角色权限、操作审计、数据加密" />
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'
const members = ref(0)
const pendingApprovals = ref(0)
const pendingAudits = ref(0)
onMounted(() => { /* TODO: 接入 Governance API */ })
</script>
<style scoped>
.governance-module { display: flex; flex-direction: column; gap: var(--space-lg); }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); }
.stat-item { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); padding: var(--space-lg); display: flex; flex-direction: column; align-items: center; }
.stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-intelligence); }
.stat-value.text-green { color: #10b981; }
.stat-label { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-xs); }
.section { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-xl); padding: var(--space-xl); }
.section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-lg); color: var(--color-text-primary); }
@media (max-width: 768px) { .stats-row { grid-template-columns: 1fr; } }
</style>
