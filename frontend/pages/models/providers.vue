<!--
  pages/models/providers.vue — 兼容重定向：旧「AI模型中心」路由 → 新「AI中心」/ai-center
  掌柜指令 2026-08-01：AI中心 取代 大模型注册（导航/页面/后台统一迁移）
-->
<template>
  <div class="min-h-screen bg-[#04060F] flex items-center justify-center text-white">
    <div class="text-center">
      <div class="w-10 h-10 mx-auto rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin mb-4"></div>
      <p class="text-sm text-gray-400">正在前往 AI中心…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
onMounted(() => {
  window.location.replace('/ai-center')
})
</script>
