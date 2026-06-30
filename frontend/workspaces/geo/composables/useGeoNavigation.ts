/**
 * GEO Navigation Composable
 *
 * Workspace-level navigation to all sub-pages.
 */
import { useRouter } from 'vue-router'

export function useGeoNavigation() {
  const router = useRouter()

  function navigateToHealth() {
    router.push('/workspace/geo/health')
  }

  function navigateToRecommendations() {
    router.push('/workspace/geo/recommendations')
  }

  function navigateToVerification() {
    router.push('/workspace/geo/verification')
  }

  function navigateToPublishing() {
    router.push('/workspace/geo/publishing')
  }

  function navigateToGrowth() {
    router.push('/workspace/geo/growth')
  }

  function navigateToKnowledge() {
    router.push('/workspace/geo/knowledge')
  }

  return {
    navigateToHealth,
    navigateToRecommendations,
    navigateToVerification,
    navigateToPublishing,
    navigateToGrowth,
    navigateToKnowledge,
  }
}
