<!-- SPRINT-IDENTITY-REALITY-FIX-01: 企业 AI 模型设置（BYOK） -->
<!-- 企业工作台 → 设置 → AI模型设置：企业提供算力，昆仑镜管理 AI 员工 -->
<template>
  <div class="ms-page">
    <ProviderSettingsModule />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })
import ProviderSettingsModule from '~/components/enterprise/workspace/modules/ProviderSettingsModule.vue'
</script>

<style scoped>
.ms-page {
  padding: var(--space-lg);
  min-height: 100%;
  background: var(--color-bg-primary, #070B16);
}
</style>
