/**
 * useEnterpriseContext — 企业上下文 Composable
 * 
 * 提供: tenant, user, role, capabilities
 * 所有 Enterprise Page 和 UI Kit 组件都通过此 Composable 获取上下文
 */
import type { Ref } from 'vue'

export interface EnterpriseContext {
  tenant: {
    id: string
    name: string
    source: string
    freshness: string
  }
  user: {
    id: string
    name: string
    role: string
  }
  capabilities: string[]
  can: (capability: string) => boolean
}

export const useEnterpriseContext = (): EnterpriseContext => {
  const authStore = useAuthStore()

  return {
    tenant: {
      id: authStore.tenantId,
      name: authStore.userName + ' Corp',
      source: 'EnterpriseContext',
      freshness: new Date().toISOString(),
    },
    user: {
      id: authStore.userId,
      name: authStore.userName,
      role: authStore.userRole || 'ceo',
    },
    capabilities: authStore.enterpriseContext?.capabilities || [],
    can: (capability: string) =>
      authStore.enterpriseContext?.capabilities?.includes(capability) ?? false,
  }
}
