<script setup lang="ts">
import { ref } from 'vue'
import GeoProjectsPanel from '~/studio-v2/workspace/brand-geo-v2/GeoProjectsPanel.vue'
import GeoOverview from '~/studio-v2/workspace/brand-geo-v2/GeoOverview.vue'
import GeoTimeline from '~/studio-v2/workspace/brand-geo-v2/GeoTimeline.vue'
import GeoEvidence from '~/studio-v2/workspace/brand-geo-v2/GeoEvidence.vue'
import GeoPublish from '~/studio-v2/workspace/brand-geo-v2/GeoPublish.vue'
import GeoInsights from '~/studio-v2/workspace/brand-geo-v2/GeoInsights.vue'
import GeoInsightsPanel from '~/studio-v2/workspace/brand-geo-v2/GeoInsightsPanel.vue'

// Three-panel layout: Projects | Workspace | Insights
const activeProjectId = ref<string | null>(null)
const activeTab = ref<'overview' | 'timeline' | 'evidence' | 'publish' | 'insights'>('overview')

const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'timeline', label: '时间线' },
  { key: 'evidence', label: '验证' },
  { key: 'publish', label: '发布' },
  { key: 'insights', label: '洞察' },
] as const
</script>

<template>
  <div class="h-full flex">
    <!-- Left: Projects Panel -->
    <GeoProjectsPanel v-model="activeProjectId" class="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />

    <!-- Center: Workspace Panel -->
    <div class="flex-1 flex flex-col min-w-0">
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex space-x-1 px-4">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === tab.key ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <GeoOverview v-if="activeTab === 'overview'" :project-id="activeProjectId" />
        <GeoTimeline v-else-if="activeTab === 'timeline'" :project-id="activeProjectId" />
        <GeoEvidence v-else-if="activeTab === 'evidence'" :project-id="activeProjectId" />
        <GeoPublish v-else-if="activeTab === 'publish'" :project-id="activeProjectId" />
        <GeoInsights v-else-if="activeTab === 'insights'" :project-id="activeProjectId" />
      </div>
    </div>

    <!-- Right: Insights Panel -->
    <GeoInsightsPanel :project-id="activeProjectId" class="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700" />
  </div>
</template>
