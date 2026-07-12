<!-- JSON-LD 使用 v-text 避免 Vue 的 script 批处理 -->
<template>
  <div v-if="jsonldList.length > 0">
    <span v-for="(sd, idx) in jsonldList" :key="idx">
      <script type="application/ld+json" v-text="JSON.stringify(sd)"></script>
    </span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const jsonldList = computed(() => props.manifest?.structuredData?.jsonld || [])
</script>
