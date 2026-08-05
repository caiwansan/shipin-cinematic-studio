<script setup lang="ts">
// /download → /download/desktop（唯一真机下载入口，防止旧书签/手输 404）
onMounted(() => {
  window.location.replace('/download/desktop')
})
</script>

<template>
  <div class="dl-redirect">
    <p>正在跳转到下载页…</p>
    <a href="/download/desktop">立即前往 →</a>
  </div>
</template>

<style scoped>
.dl-redirect {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #888;
}
.dl-redirect a {
  color: #3b82f6;
  text-decoration: none;
}
</style>
