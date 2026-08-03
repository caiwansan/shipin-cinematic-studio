<!--
  EcoBackHome — 生态页面「返回首页」入口（ECO-NAV-RETURN-01）
  产品规范：生态页面 = 返回首页 + 页面导航 + 当前生态入口（防孤岛页面）
  轻量组件：仅一个 NuxtLink，复用 Kunlun Design Token，不重复造导航系统
-->
<template>
  <NuxtLink to="/" class="eco-back-home" aria-label="返回首页">
    <span class="eco-back-home__arrow">←</span>
    <span class="eco-back-home__text">返回首页</span>
  </NuxtLink>
</template>

<script setup lang="ts">
// 无 props / emits：纯静态入口
</script>

<style scoped>
.eco-back-home {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted, #8a8aa0);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-decoration: none;
  transition: all 0.15s ease;
  width: fit-content;
}
.eco-back-home:hover {
  color: var(--color-text-primary, #e8e6f0);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
}
.eco-back-home__arrow {
  font-size: 15px;
  line-height: 1;
}
</style>
