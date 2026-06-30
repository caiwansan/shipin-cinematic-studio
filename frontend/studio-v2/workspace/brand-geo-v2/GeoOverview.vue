<script setup lang="ts">
import { reactive, watch } from 'vue'
import Metric from '~/components/kmki-ui/Metric/index.vue'
import HealthIndicator from '~/components/kmki-ui/HealthIndicator/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'

const props = defineProps<{ projectId: string | null }>()

const dashboard = reactive({
  geoScore: 0,
  lastDelta: 0,
  publishHealth: 0,
  indexedRate: 0,
  successRate: 0,
  activeRecommendations: 0,
  loading: true,
})

watch(() => props.projectId, async (id) => {
  if (!id) return
  dashboard.loading = true
  try {
    const res: any = await $fetch(`/api/geo/monitor/dashboard/${id}`)
    if (res.success) {
      dashboard.publishHealth = res.data.publishingHealth?.verified || 0
      dashboard.indexedRate = res.data.publishingHealth?.indexedPercentage || 0
      dashboard.geoScore = res.data.currentScore || 0
      dashboard.lastDelta = res.data.lastDelta || 0
      dashboard.activeRecommendations = res.data.activeRecommendations || 0
    }
  } catch {
    // ignore API errors
  } finally {
    dashboard.loading = false
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <div v-if="!projectId" class="text-center text-gray-400 py-12">
      选择一个项目开始
    </div>
    <template v-else>
      <div class="grid grid-cols-3 gap-4">
        <Metric label="GEO 评分" :value="dashboard.geoScore" />
        <Metric
          label="发布健康度"
          :value="dashboard.publishHealth"
          :subtitle="`已收录 ${dashboard.indexedRate}%`"
        />
        <Metric label="活跃任务" :value="dashboard.activeRecommendations" />
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">发布健康度</h4>
        <HealthIndicator label="验证率" :value="dashboard.publishHealth" :max="10" size="md" />
        <div class="mt-3">
          <ExplainPanel
            :data="{
              why: '基于近 10 条发布记录统计的验证通过率，反映内容上线后的可验证性',
              evidence: `已发布: ${dashboard.publishHealth} 条`,
              confidence: 'HIGH',
              source: '监控系统',
            }"
          />
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">GEO 评分趋势</h4>
        <ExplainPanel
          :data="{
            why: 'GEO 评分是综合可见性、权威性、内容质量、网站表现和知识覆盖的加权平均分数，反映品牌在搜索生态中的健康度',
            evidence: dashboard.lastDelta !== 0 ? `较上次变化: ${dashboard.lastDelta > 0 ? '+' : ''}${dashboard.lastDelta}` : '初始评分已建立',
            confidence: 'MEDIUM',
            source: '学习引擎',
          }"
        />
      </div>
    </template>
  </div>
</template>
