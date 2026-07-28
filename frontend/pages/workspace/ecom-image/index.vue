<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
definePageMeta({ middleware: 'auth' })

// 入口页 → 自动创建新项目并跳转到工作台
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(async () => {
  try {
    const token = getAuthToken()
    if (!token) return

    // 创建新项目
    const res = await fetch('/api/ecom/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ skuName: '未命名商品' }),
    })

    if (res.ok) {
      const data = await res.json()
      const projectId = data.data.id
      // 直接进入工作台
      window.location.replace(`/workspace/ecom-image/workbench/${projectId}`)
    } else {
      // 创建失败，回退到列表页
      window.location.replace('/workspace/ecom-image/projects')
    }
  } catch (e) {
    window.location.replace('/workspace/ecom-image/projects')
  }
})
</script>

<template>
  <div class="loading-page">正在创建项目...</div>
</template>

<style scoped>
.loading-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #6b7280;
  font-size: 0.9rem;
  background: #0b0f14;
}
</style>
