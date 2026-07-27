<!-- pages/enterprise/agent/[id].vue — AI 员工主页 (动态路由) -->
<!-- 路由: /enterprise/agent/:id -->
<template>
  <div class="agent-profile-page">
    <EmployeeProfilePage :agent-id="agentId" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise' })

// 从路由参数获取 agentId
const route = useRoute()
const agentId = route.params.id as string
</script>

<style scoped>
.agent-profile-page {
  padding: var(--space-xl, 24px);
  max-width: 800px;
  margin: 0 auto;
}
</style>
