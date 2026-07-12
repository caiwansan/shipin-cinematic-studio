<!--
MissionCardList.vue — Unified Mission Card List

Renders all missions in a flat list (no segmentation by priority).
P0 missions are visually distinguished via accent bar (handled by MissionCard).
API already returns missions sorted by priority.
-->
<template>
  <div class="mcl">
    <MissionCard
      v-for="mission in missions"
      :key="mission.id"
      :mission="mission"
      @action="handleAction"
    />
  </div>
</template>

<script setup lang="ts">
import type { Mission } from '../../types/mission'
import MissionCard from './MissionCard.vue'

defineProps<{
  missions: Mission[]
}>()

const emit = defineEmits<{
  (e: 'action', mission: Mission): void
}>()

function handleAction(mission: Mission) {
  emit('action', mission)
}
</script>

<style scoped>
.mcl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* Single column on narrow screens */
@media (max-width: 740px) {
  .mcl {
    grid-template-columns: 1fr;
  }
}
</style>
