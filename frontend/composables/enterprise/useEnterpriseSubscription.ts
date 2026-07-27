/**
 * Enterprise Subscription Guard — GA-03
 * 检查用户是否有活跃的企业订阅
 */
export function useEnterpriseSubscription() {
  const hasSubscription = ref(false)
  const subscription = ref<any>(null)
  const loading = ref(true)

  async function checkSubscription() {
    loading.value = true
    try {
      const res = await fetch('/api/enterprise/subscription/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        subscription.value = data.data
        hasSubscription.value = data.data?.status === 'active'
      }
    } catch (e) {
      console.error('Failed to check subscription:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    hasSubscription,
    subscription,
    loading,
    checkSubscription,
  }
}
