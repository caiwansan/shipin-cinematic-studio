<template>
  <VerificationCard
    :title="`${entityName} — ADI 对比`"
    :before-adi="beforeAdi"
    :after-adi="afterAdi"
    :delta-adi="deltaAdi"
    :improvement-rate="improvementRate"
  />
</template>

<script setup lang="ts">
import VerificationCard from '../../../../../components/kmki-ui/VerificationCard/index.vue'

defineProps<{
  entityName?: string
  beforeAdi: number
  afterAdi: number
  deltaAdi: number
  improvementRate: number
}>()
</script>
