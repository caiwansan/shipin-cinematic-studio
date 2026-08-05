import { defineStore } from 'pinia'
import { getToken as getCachedToken, setToken, clearAuth, setUser as setCachedUser, getUser as getCachedUser } from '~/utils/token-cache'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    user: null as null | { id: string; username: string; email: string; credits?: number; memberTier?: string; avatarUrl?: string | null },
    avatarVersion: 0 as number, // MEMBER-CENTER-02 头像更新版本号（用于全站即时刷新）
    enterpriseContext: null as null | {
      userId: string
      governanceTenantId: string | null
      govUserId: string | null
      organizationId: string | null
      roles: string[]
      capabilities: string[]
    },
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    userName: (state) => state.user?.username || state.user?.email?.split('@')[0] || '用户',
    credits: (state) => 0,
    memberTier: (state) => state.user?.memberTier || 'free',
    userId: (state) => state.user?.id || '',
    userAvatar: (state) => state.user?.avatarUrl || '',
    tenantId: (state) => state.enterpriseContext?.governanceTenantId || state.user?.id || '',
    userRole: (state) => state.enterpriseContext?.roles?.[0] || 'ceo',
  },
  actions: {
    /**
     * 获取 token — 优先返回内存变量（Pinia state），再 fallback token-cache（内存→localStorage）。
     * 内存层防御 XSS 窃取：注入脚本可读 localStorage 但无法读 JS 内存闭包。
     */
    getToken(): string {
      return this.token || (process.client ? getCachedToken() : '')
    },

    /**
     * 将 token 同时写入 Pinia state + token-cache（内存 + localStorage 双写）
     */
    setTokenToStore(token: string): void {
      this.token = token
      setToken(token)
    },

    async login(email: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || err.message || '登录失败')
      }
      const data = await res.json()
      const token = data.accessToken || data.token
      if (!token) throw new Error('服务器未返回 token')

      this.token = token
      this.user = data.user || null

      // Persist to cookie + token-cache（内存 + localStorage）
      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      if (import.meta.client) {
        window.localStorage?.setItem('auth_token', token)
      }
      setToken(token)
      if (this.user) {
        setCachedUser(this.user as Record<string, any>)
        document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
      }
    },
    async loginByPhone(phone: string, password: string) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || err.message || '登录失败')
      }
      const data = await res.json()
      const token = data.accessToken || data.token
      if (!token) throw new Error('服务器未返回 token')

      this.token = token
      this.user = data.user || null

      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      if (import.meta.client) {
        window.localStorage?.setItem('auth_token', token)
      }
      setToken(token)
      if (this.user) {
        setCachedUser(this.user as Record<string, any>)
        document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
      }
    },
    /**
     * MEMBER-CENTER-02 更新用户头像（本地同步，全站即时生效）
     */
    setAvatar(avatarUrl: string | null) {
      if (this.user) {
        this.user.avatarUrl = avatarUrl
        setCachedUser(this.user as Record<string, any>)
      }
      this.avatarVersion++
    },
    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${this.token}` } })
      } catch (_e) { /* ignore */ }
      this.token = ''
      this.user = null
      this.enterpriseContext = null
      // 统一清除：token-cache（内存 + localStorage + cookie）
      clearAuth()
    },
    /**
     * 加载企业上下文（Sprint 4.2.3.1）
     * CTO: Auth Store 负责 identity，EnterpriseContext 负责 tenant/org/permission
     */
    async loadEnterpriseContext() {
      if (!this.token || !this.user) return
      try {
        const headers: Record<string, string> = { 'Authorization': `Bearer ${this.token}` }
        const res = await fetch(`/api/enterprise/${this.user.id}/context/enterprise`, { headers })
        const json = await res.json()
        if (json.code === 0 && json.data) {
          this.enterpriseContext = json.data
        }
      } catch (e) {
        console.error('Load enterprise context failed', e)
      }
    },
    async fetchMe(forceRefresh?: boolean) {
      if (!this.token) return
      // 如果强制刷新或 user 为空，从 API 重新拉取
      if (!forceRefresh && this.user) return
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` },
        })
        if (!res.ok) throw new Error('Session expired')
        const data = await res.json()
        if (data.user) {
          this.user = data.user
          // 同步更新 token-cache（内存 + localStorage）
          setCachedUser(this.user as Record<string, any>)
          if (import.meta.client) {
            document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
          }
        }
      } catch {
        this.token = ''
        this.user = null
        clearAuth()
      }
    },
    async restoreSession() {
      // Use token-cache for reading (memory → localStorage fallback)
      const cachedToken = getCachedToken()
      const stored = cachedToken || this._getCookie('auth_token')
      if (stored) {
        // Sync token cache with any found token
        if (!cachedToken && stored) setToken(stored)
        this.token = stored
        // 先尝试从 API 获取最新数据
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${stored}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.user) {
              this.user = data.user
              setCachedUser(this.user as Record<string, any>)
              if (import.meta.client) {
                document.cookie = `auth_user=${encodeURIComponent(JSON.stringify(this.user))}; path=/; max-age=86400; samesite=lax`
              }
              return
            }
          }
        } catch { /* fallback to cache */ }

        // API 失败时 fallback 到 token-cache 缓存
        const cachedUser = getCachedUser()
        if (cachedUser) {
          this.user = cachedUser as any
        } else {
          const userStr = this._getCookie('auth_user')
          if (userStr) {
            try { this.user = JSON.parse(decodeURIComponent(userStr)) } catch { /* ignore */ }
          }
        }
      }
    },
    _getCookie(name: string): string {
      if (import.meta.server) return '' // SSR 无 document，由 middleware 的 SSR 分支处理
      const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
      return match ? decodeURIComponent(match[2]) : ''
    },
  },
})
