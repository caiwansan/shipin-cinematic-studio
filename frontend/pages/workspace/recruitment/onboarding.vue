<template>
  <div class="onboarding-redirect">
    <div class="redirect-card">
      <div class="redirect-spinner"></div>
      <p>正在跳转到企业认证...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

/**
 * Sprint-Enterprise-Identity-Hardening-01 Phase 5
 * 旧 recruitment onboarding 已合并到 enterprise onboarding。
 * 此页面仅作为 redirect 入口。
 */
onMounted(() => {
  window.location.replace('/workspace/enterprise/onboarding')
})
</script>

<style scoped>
.onboarding-redirect {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0f1e;
}

.redirect-card {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}

.redirect-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
