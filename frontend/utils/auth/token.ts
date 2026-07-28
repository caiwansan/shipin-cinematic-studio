/**
 * auth/token.ts — 唯一客户端 Token 来源
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 4
 * 统一 auth_token 作为唯一客户端 token 来源。
 *
 * 提供:
 *   getAuthToken()  - 获取 token
 *   setAuthToken()  - 设置 token
 *   clearAuthToken() - 清除 token
 *
 * 禁止: localStorage.getItem("token"), localStorage.getItem("accessToken")
 */

// 内存缓存（模块闭包，XSS 无法访问）
let _memoryToken = ''

// 统一存储 key
const TOKEN_KEY = 'auth_token'

/** 安全读取 localStorage */
function safeLsGet(key: string): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

/** 安全写入 localStorage */
function safeLsSet(key: string, val: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, val) } catch { /* quota exceeded */ }
}

/** 安全移除 localStorage */
function safeLsRemove(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

/**
 * 获取 auth token
 * 优先读内存 → fallback localStorage
 */
export function getAuthToken(): string {
  if (_memoryToken) return _memoryToken
  const val = safeLsGet(TOKEN_KEY)
  if (val) {
    _memoryToken = val
    return val
  }
  return ''
}

/**
 * 设置 auth token
 * 写入内存 + localStorage + cookie（兼容旧系统）
 */
export function setAuthToken(token: string): void {
  _memoryToken = token
  safeLsSet(TOKEN_KEY, token)
  // 兼容旧系统：同步写入 cookie
  if (typeof document !== 'undefined') {
    document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; samesite=lax`
  }
}

/**
 * 清除 auth token
 * 清除内存 + localStorage + cookie + 旧 key 清理
 */
export function clearAuthToken(): void {
  _memoryToken = ''
  safeLsRemove(TOKEN_KEY)
  // 清理旧 key（一次性迁移）
  safeLsRemove('token')
  safeLsRemove('accessToken')
  // 清理 cookie
  if (typeof document !== 'undefined') {
    ;['auth_token', 'token', 'accessToken'].forEach(k => {
      document.cookie = `${k}=; path=/; max-age=0; samesite=lax`
    })
  }
}

/**
 * 检查是否已登录（有 token 即认为已登录）
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken()
}

export default { getAuthToken, setAuthToken, clearAuthToken, isAuthenticated }
