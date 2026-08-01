<!--
  pages/admin/ai-providers.vue — 兼容重定向：旧「AI模型供应商管理」→ 新「AI供应商管理」/admin/ai-center/providers
  掌柜指令 2026-08-01：AI中心 统一后台路径
-->
<template>
  <div class="min-h-full flex items-center justify-center" style="background: #070B16">
    <div class="text-center text-white">
      <div class="w-8 h-8 mx-auto rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin mb-3"></div>
      <p class="text-xs text-gray-500">正在前往 AI供应商管理…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from '#imports'
definePageMeta({ layout: 'admin-aigc' })
const router = useRouter()
onMounted(() => {
  router.replace('/admin/ai-center/providers')
})
</script>
