<template>
  <ConfidenceMeter :confidence="confidence" />
</template>

<script setup lang="ts">
import ConfidenceMeter from '../../../../../components/kmki-ui/ConfidenceMeter/index.vue'

defineProps<{
  confidence: number
}>()
</script>
