/**
 * GEO Hydrate Composable
 *
 * Handles data hydration for GEO workspace pages.
 * Currently provides the hydrate trigger for HealthPage.
 */
import { onMounted } from 'vue'
import { useHealthStore } from '../stores/useHealthStore'

export function useGeoHydrate() {
  const healthStore = useHealthStore()

  async function hydrateAll() {
    await healthStore.fetchHealth()
  }

  onMounted(() => {
    hydrateAll()
  })

  return {
    hydrateAll,
    isHydrated: healthStore.hasData,
  }
}
