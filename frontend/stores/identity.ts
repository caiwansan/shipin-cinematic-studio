/**
 * stores/identity.ts — Identity Context Store (Pinia)
 *
 * Sprint-08: 统一身份上下文管理
 * 唯一合法获取当前用户身份/企业/工作空间上下文的入口。
 * 所有页面必须通过此 Store 获取上下文，禁止直接读取 localStorage。
 */

import { defineStore } from 'pinia'

export interface UserContext {
  id: string
  email: string
  username: string
  memberTier: string
  createdAt: string
}

export interface EnterpriseContext {
  id: string
  name: string
  industry: string | null
  onboardingStep: number
  onboardingDone: boolean
}

export interface WorkspaceContext {
  id: string
  name: string
  plan: string
  status: string
}

export interface MembershipContext {
  role: string
  isAdmin: boolean
}

export interface SubscriptionContext {
  id: string
  status: string
  plan: {
    id: string
    name: string
    displayName: string
    maxEmployees: number
    maxChannels: number
  } | null
  expireAt: string | null
}

export interface IdentityState {
  user: UserContext | null
  enterprise: EnterpriseContext | null
  workspace: WorkspaceContext | null
  membership: MembershipContext | null
  subscription: SubscriptionContext | null
  hasEnterprise: boolean
  loading: boolean
  error: string | null
  loaded: boolean
}

export const useIdentityStore = defineStore('identity', {
  state: (): IdentityState => ({
    user: null,
    enterprise: null,
    workspace: null,
    membership: null,
    subscription: null,
    hasEnterprise: false,
    loading: false,
    error: null,
    loaded: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isEnterprise: (state) => state.hasEnterprise && !!state.enterprise,
    isWorkspace: (state) => !!state.workspace,
    enterpriseId: (state) => state.enterprise?.id || null,
    workspaceId: (state) => state.workspace?.id || null,
    userRole: (state) => state.membership?.role || 'guest',
    isAdmin: (state) => state.membership?.isAdmin || false,
    subscriptionStatus: (state) => state.subscription?.status || 'none',
    planName: (state) => state.subscription?.plan?.displayName || '免费版',
    // Sprint-08: 新增 getters
    currentWorkspace: (state) => state.workspace,
    currentEnterprise: (state) => state.enterprise,
    isOwner: (state) => state.membership?.role === 'owner',
    isMember: (state) => !!state.membership,
  },

  actions: {
    /**
     * 获取身份上下文
     * 从 JWT + 数据库获取，不依赖 localStorage
     */
    async fetchContext() {
      this.loading = true
      this.error = null

      try {
        const token = localStorage.getItem('token') || ''
        const res = await fetch('/api/identity/context', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()

        if (data.success && data.data) {
          this.user = data.data.user
          this.hasEnterprise = data.data.hasEnterprise
          this.enterprise = data.data.enterprise
          this.workspace = data.data.workspace
          this.membership = data.data.membership
          this.subscription = data.data.subscription
          this.loaded = true

          // Cache to localStorage for offline access
          if (data.data.enterprise?.id) {
            localStorage.setItem('enterprise_id', data.data.enterprise.id)
          }
          if (data.data.workspace?.id) {
            localStorage.setItem('workspace_id', data.data.workspace.id)
          }
        } else {
          this.error = data.error || '获取身份上下文失败'
        }
      } catch (e: any) {
        this.error = e.message || '网络错误'
      } finally {
        this.loading = false
      }
    },

    /**
     * 获取工作空间列表
     */
    async fetchWorkspaces() {
      try {
        const token = localStorage.getItem('token') || ''
        const res = await fetch('/api/identity/workspaces', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) return []

        const data = await res.json()
        return data.success ? data.data : []
      } catch {
        return []
      }
    },

    /**
     * 切换工作空间
     */
    async switchWorkspace(workspaceId: string) {
      this.loading = true
      this.error = null

      try {
        const token = localStorage.getItem('token') || ''
        const res = await fetch('/api/identity/workspace/switch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workspaceId }),
        })

        if (res.status === 403) {
          this.error = '无权访问该工作空间'
          return false
        }

        if (res.status === 401) {
          this.error = '认证已过期，请重新登录'
          return false
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          this.error = data.error || `切换失败 (HTTP ${res.status})`
          return false
        }

        const data = await res.json()

        if (data.success && data.data) {
          this.workspace = data.data.workspace
          this.enterprise = data.data.enterprise
          this.subscription = data.data.subscription

          // Update localStorage cache
          localStorage.setItem('enterprise_id', data.data.enterprise.id)
          localStorage.setItem('workspace_id', data.data.workspace.id)

          return true
        } else {
          this.error = data.error || '切换工作空间失败'
          return false
        }
      } catch (e: any) {
        this.error = e.message || '网络错误'
        return false
      } finally {
        this.loading = false
      }
    },

    /**
     * 清除身份上下文
     */
    clear() {
      this.user = null
      this.enterprise = null
      this.workspace = null
      this.membership = null
      this.subscription = null
      this.hasEnterprise = false
      this.loading = false
      this.error = null
      this.loaded = false
      localStorage.removeItem('enterprise_id')
      localStorage.removeItem('workspace_id')
    },
  },
})
