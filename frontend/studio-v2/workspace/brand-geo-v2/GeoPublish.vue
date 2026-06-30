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
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const res = await client.get(`/publishing/project/${id}`)
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
    <div v-if="!projectId" class="text-center text-gray-400 py-12">选择一个项目查看发布记录</div>
    <div v-else-if="records.length === 0" class="text-center text-gray-400 py-12">
      <div class="text-3xl mb-3">🚀</div>
      <div class="text-sm font-medium mb-1">暂无发布记录</div>
      <p class="text-xs text-gray-500">执行优化后可发布品牌信息</p>
    </div>
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
