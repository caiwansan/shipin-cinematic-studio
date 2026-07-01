<template>
  <div class="verification-embedded">
    <VerificationEmbeddedContent
      :project-id="projectId"
      :embedded="true"
      @complete="handleComplete"
    />
  </div>
</template>

<script setup lang="ts">
import VerificationEmbeddedContent from './VerificationEmbeddedContent.vue'

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
