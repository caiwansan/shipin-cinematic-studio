/**
 * token-cache.ts — Token 缓存（兼容层）
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 4
 * 底层实现已迁移到 utils/auth/token.ts。
 * 本文件保留旧 API 名称作为兼容别名。
 *
 * 新代码请直接引入:
 *   import { getAuthToken, setAuthToken, clearAuthToken } from '~/utils/auth/token'
 */

import {
  getAuthToken as _getAuthToken,
  setAuthToken as _setAuthToken,
  clearAuthToken as _clearAuthToken,
  isAuthenticated as _isAuthenticated,
} from './auth/token'

// 内存用户缓存（保留）
let _memoryUser: Record<string, any> | null = null

function safeLsGet(key: string): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

function safeLsSet(key: string, val: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, val) } catch { /* quota exceeded */ }
}

function safeLsRemove(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

const USER_KEY = 'auth_user'

// ─── 兼容别名（旧 API） ───

/** @deprecated 使用 getAuthToken() 替代 */
export function getToken(): string {
  return _getAuthToken()
}

/** @deprecated 使用 setAuthToken() 替代 */
export function setToken(token: string): void {
  _setAuthToken(token)
}

/** @deprecated 使用 clearAuthToken() 替代 */
export function clearAuth(): void {
  _clearAuthToken()
  _memoryUser = null
  safeLsRemove(USER_KEY)
}

/** @deprecated 使用 isAuthenticated() 替代 */
export function isAuthenticated(): boolean {
  return _isAuthenticated()
}

// ─── 用户信息缓存（保留） ───

export function getUser<T = Record<string, any>>(): T | null {
  if (_memoryUser) return _memoryUser as T
  const raw = safeLsGet(USER_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as T
      _memoryUser = parsed as Record<string, any>
      return parsed
    } catch {
      return null
    }
  }
  return null
}

export function setUser(user: Record<string, any> | null): void {
  _memoryUser = user
  if (user) {
    safeLsSet(USER_KEY, JSON.stringify(user))
  } else {
    safeLsRemove(USER_KEY)
  }
}

/** 获取管理员 Token */
export function getAdminToken(): string {
  return _getAuthToken()
}

export default { getToken, setToken, getUser, setUser, clearAuth, isAuthenticated }
