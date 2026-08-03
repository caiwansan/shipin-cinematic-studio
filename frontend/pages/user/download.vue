<script setup lang="ts">
// RELEASE-01.2 Task 02：下载页去登录化
// 旧入口 /user/download 曾要求登录（middleware: auth）——下载属于公共发行层，不属于用户中心。
// 直接重定向到公开下载页 /download/desktop（唯一真机下载入口）。
if (import.meta.client) {
  window.location.replace('/download/desktop')
}
</script>

<template>
  <div />
</template>
