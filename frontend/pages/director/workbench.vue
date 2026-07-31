<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 调用 /api/workbench/*（后端未注册，404）。
  保留：未完成未来层（叙事导演工作台），勿删除。
-->
<template>
  <div>
    <ClientOnly>
      <DirectorWorkbenchPage />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import DirectorWorkbenchPage from '~/studio-v2/workspace/director-workbench/DirectorWorkbenchPage.vue'
</script>
