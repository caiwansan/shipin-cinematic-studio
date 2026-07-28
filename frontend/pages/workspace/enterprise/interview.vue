<!--
  ⚠️ DEPRECATE — JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26
  旧企业面试管理页面，已被 /workspace/enterprise/ 取代。
  FRONTEND-RECRUITMENT-ENTRY-CONSOLIDATION-01 SubTask 2:
  替换为委托页面，自动跳转到 AI 招聘中心首页。
  禁止：修改功能、添加新逻辑。
-->
<template>
  <div class="deprecation-redirect">
    <p>正在跳转到 AI 招聘中心…</p>
  </div>
</template>

<script setup lang="ts">
onMounted(() => {
  navigateTo('/workspace/enterprise/', { redirectCode: 301 })
})
</script>

<style scoped>
.deprecation-redirect {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #666;
  font-size: 16px;
}
</style>
