<template>
  <div class="channels-module">
    <ChannelConnectCenter />
  </div>
</template>
<script setup lang="ts">
import ChannelConnectCenter from '../ChannelConnectCenter.vue'
</script>
<style scoped>
.channels-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
</style>
