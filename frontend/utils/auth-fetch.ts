/**
 * auth-fetch.ts — 自动带 Auth Token 的 fetch 封装
 *
 * 自动从 localStorage 读取 token，加到 Authorization header。
 * 原供 PPT Product 页面使用，现保留以备其他模块需要。
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let token = ''
  if (typeof window !== 'undefined') {
    token =
      window.localStorage?.getItem('auth_token') ||
      window.localStorage?.getItem('accessToken') ||
      window.localStorage?.getItem('token') ||
      ''
  }

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  })
}
