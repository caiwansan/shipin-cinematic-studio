<template>
  <div class="employees-module">
    <AIEmployeeConfig />
  </div>
</template>
<script setup lang="ts">
import AIEmployeeConfig from '../AIEmployeeConfig.vue'
</script>
<style scoped>
.employees-module { display: flex; flex-direction: column; gap: var(--space-lg); }
</style>
