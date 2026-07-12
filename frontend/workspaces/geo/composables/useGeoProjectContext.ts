/**
 * useGeoProjectContext — SSOT for current project ID in GEO Workspace
 *
 * Priority chain:
 *   1. useGeoProjectStore.currentProject.id (from store)
 *   2. route.query.projectId (from URL query param, fallback)
 *   3. route.params.id (from URL path param, fallback)
 *   4. '' (empty string, never 'default')
 *
 * Usage:
 *   const { projectId } = useGeoProjectContext()
 *   // projectId.value === 'abc-123' | ''
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'

export function useGeoProjectContext() {
  const route = useRoute()
  const projectStore = useGeoProjectStore()

  const projectId = computed<string>(() => {
    // 1. From store — most authoritative
    if (projectStore.currentProject?.id) {
      return projectStore.currentProject.id
    }

    // 2. From route query param
    const queryId = route.query?.projectId
    if (queryId && typeof queryId === 'string' && queryId.trim()) {
      return queryId.trim()
    }

    // 3. From route path param
    const paramsId = route.params?.id
    if (paramsId && typeof paramsId === 'string' && paramsId.trim()) {
      return paramsId.trim()
    }

    // 4. Fallback to empty string
    return ''
  })

  return { projectId }
}
