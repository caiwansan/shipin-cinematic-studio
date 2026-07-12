<template>
  <DecisionIntelligencePanel
    v-if="project?.id"
    :brand-id="project.id"
    @issue-selected="onIssueSelected"
  />
</template>

<script setup lang="ts">
import DecisionIntelligencePanel from '../DecisionIntelligencePanel.vue'

interface ProjectBrief {
  id: string
  name?: string
  industry?: string
  website?: string
  description?: string
  createdAt?: string
}

const props = defineProps<{
  project: ProjectBrief
  loading?: boolean
  error?: string | null
  decisionData?: any
  explainResult?: any
}>()

const emit = defineEmits<{
  issueSelected: [issue: any]
}>()

function onIssueSelected(issue: any) {
  emit('issueSelected', issue)
}
</script>
