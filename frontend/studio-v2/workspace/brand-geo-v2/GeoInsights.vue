<script setup lang="ts">
import { ref, watch } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'

const props = defineProps<{ projectId: string | null }>()

const signals = ref<any[]>([])

watch(() => props.projectId, async (id) => {
  if (!id) return
  try {
    const res: any = await $fetch(`/api/geo/learning/signals?projectId=${id}`)
    if (res.success) {
      signals.value = res.data || []
    }
  } catch {
    // ignore API errors
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-3">
    <div v-if="signals.length === 0" class="text-center text-gray-400 py-12">暂无优化建议</div>
    <div
      v-for="sig in signals"
      :key="sig.type"
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ sig.type }}</span>
        <Badge
          :label="sig.confidence"
          :color="sig.confidence === 'HIGH' ? 'green' : sig.confidence === 'MEDIUM' ? 'yellow' : 'gray'"
        />
      </div>
      <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>权重: {{ sig.weight?.toFixed(2) }}</span>
        <span>样本: {{ sig.sampleSize }}</span>
      </div>
      <ExplainPanel
        :data="{
          why: sig.reason,
          evidence: sig.evidence,
          confidence: sig.confidence,
          source: '学习引擎',
        }"
      />
    </div>
  </div>
</template>
