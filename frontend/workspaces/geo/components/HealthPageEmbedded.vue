<template>
  <div class="health-embedded">
    <HealthPageEmbeddedContent
      :project-id="projectId"
      :embedded="true"
      @complete="handleComplete"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import HealthPageEmbeddedContent from './HealthPageEmbeddedContent.vue'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'data-loaded', data?: any): void
}>()

function handleComplete(data?: any) {
  emit('data-loaded', data)
}
</script>

<style scoped>
.health-embedded {
  /* Embedded mode — no extra padding/margins */
}
</style>
