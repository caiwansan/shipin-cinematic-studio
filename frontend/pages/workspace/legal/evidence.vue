<template>
  <LegalWorkspaceLayout>
    <div class="legal-page">
      <h1 class="legal-page__title">证据中心</h1>
      <p class="legal-page__desc">管理和整理案件证据材料</p>
      <div class="legal-page__placeholder">
        <div class="legal-page__placeholder-icon">📁</div>
        <p>证据中心功能即将上线</p>
      </div>
    </div>
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'

definePageMeta({ layout: false })
</script>

<style scoped>
.legal-page { max-width: 1200px; margin: 0 auto; color: #F8F6F1; }
.legal-page__title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.legal-page__desc { font-size: 14px; color: rgba(248,246,241,0.5); margin: 0 0 32px; }
.legal-page__placeholder { text-align: center; padding: 80px 0; color: rgba(248,246,241,0.3); }
.legal-page__placeholder-icon { font-size: 48px; margin-bottom: 12px; }
</style>
