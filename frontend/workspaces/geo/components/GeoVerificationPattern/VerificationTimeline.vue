<template>
  <VerificationTimeline :baseline="baseline" :items="items" />
</template>

<script setup lang="ts">
import VerificationTimeline from '../../../../../components/kmki-ui/VerificationTimeline/index.vue'

defineProps<{
  baseline: number
  items: Array<{
    label: string
    contribution: number
    detail: string
  }>
  label?: string
}>()
</script>
