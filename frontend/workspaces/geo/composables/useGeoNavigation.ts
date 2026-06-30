/**
 * GEO Navigation Composable
 *
 * Placeholder for workspace-level navigation.
 * TODO: Implement routing to sub-pages (Recommendations, Verification, etc.)
 */
import { useRouter } from 'vue-router'

export function useGeoNavigation() {
  const router = useRouter()

  function navigateToHealth() {
    // router.push('/workspace/geo/health')
    console.warn('[useGeoNavigation] navigateToHealth: routing not yet configured')
  }

  function navigateToRecommendations() {
    console.warn('[useGeoNavigation] navigateToRecommendations: routing not yet configured')
  }

  function navigateToGrowth() {
    console.warn('[useGeoNavigation] navigateToGrowth: routing not yet configured')
  }

  return {
    navigateToHealth,
    navigateToRecommendations,
    navigateToGrowth,
  }
}
