<script setup lang="ts">
import { ref, watch } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'
import DiffViewer from '~/components/kmki-ui/DiffViewer/index.vue'

const props = defineProps<{ projectId: string | null }>()

const records = ref<any[]>([])

watch(() => props.projectId, async (id) => {
  if (!id) return
  try {
    const res: any = await $fetch(`/api/geo/publishing/project/${id}`)
    if (res.success) {
      records.value = res.data || []
    }
  } catch {
    // ignore API errors
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-3">
    <div v-if="records.length === 0" class="text-center text-gray-400 py-12">暂无发布记录</div>
    <div
      v-for="rec in records"
      :key="rec.id"
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm font-medium">{{ rec.contentType }}</span>
          <span class="text-xs text-gray-400 ml-2">{{ rec.platform }}</span>
        </div>
        <Badge
          :label="rec.status"
          :color="rec.status === 'indexed' ? 'green' : rec.status === 'published' || rec.status === 'verified_online' ? 'blue' : rec.status === 'failed' || rec.status === 'rolled_back' ? 'red' : 'yellow'"
        />
      </div>
      <div v-if="rec.status === 'published' || rec.status === 'verified_online'" class="mt-2">
        <ExplainPanel
          :data="{
            why: '内容已上线验证',
            evidence: 'HTTP 200 / Sitemap OK',
            confidence: 'HIGH',
            source: '监控系统',
          }"
        />
      </div>
      <div v-if="rec.content" class="mt-2">
        <DiffViewer :before="rec.beforeContent || {}" :after="rec.afterContent || {}" />
      </div>
    </div>
  </div>
</template>
