<!-- DiscoveryBottomCTA.vue — 底部动作栏 -->
<template>
  <footer v-if="vm.cta.visible" class="geo-cta">
    <button
      v-if="vm.cta.action === 'run-scan'"
      class="geo-cta__btn geo-cta__btn--primary"
      @click="$emit('run-scan')"
    >{{ vm.cta.label }}</button>
    <NuxtLink
      v-else-if="vm.cta.action === 'goto-knowledge'"
      to="/workspace/geo/knowledge"
      class="geo-cta__btn geo-cta__btn--primary"
    >{{ vm.cta.label }} →</NuxtLink>
    <NuxtLink
      v-else-if="vm.cta.action === 'goto-dashboard'"
      to="/workspace/geo/dashboard"
      class="geo-cta__btn geo-cta__btn--secondary"
    >{{ vm.cta.label }} →</NuxtLink>
    <span v-else class="geo-cta__disabled">{{ vm.cta.label }}</span>
  </footer>
</template>

<script setup lang="ts">
import type { DiscoveryVM } from '../../viewmodels/DiscoveryViewModel'

defineProps<{ vm: DiscoveryVM }>()
defineEmits<{ 'run-scan': [] }>()
</script>

<style scoped>
.geo-cta {
  margin-top: 24px;
  text-align: center;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.geo-cta__btn {
  display: inline-flex;
  align-items: center;
  padding: 12px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background .15s;
  border: none;
}

.geo-cta__btn--primary {
  background: #3b82f6;
  color: #fff;
}

.geo-cta__btn--primary:hover {
  background: #2563eb;
}

.geo-cta__btn--secondary {
  background: #fff;
  color: #1a1a2e;
  border: 1px solid #e2e8f0;
}

.geo-cta__btn--secondary:hover {
  background: #f8fafc;
  border-color: #3b82f6;
}

.geo-cta__disabled {
  font-size: 14px;
  color: #94a3b8;
}
</style>
