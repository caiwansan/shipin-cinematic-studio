// ============================================================
// BrandGEO — Services 工具函数
// ============================================================

/** 获取认证头 */
export function getAuthHeaders(): Record<string, string> {
  try {
    const nuxtToken = (window as any).__NUXT__?.token
    const ls = window.localStorage
    let token = nuxtToken || ''
    if (!token && ls) {
      for (const key of ['auth_token', 'accessToken', 'token']) {
        const val = ls.getItem(key)
        if (val) { token = val; break }
      }
    }
    return token
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      : { 'Content-Type': 'application/json' }
  } catch {
    return { 'Content-Type': 'application/json' }
  }
}

/** 统一处理 HTTP Response */
export async function handleResponse(res: Response): Promise<any> {
  if (!res.ok) {
    const errorMap: Record<number, string> = {
      400: '请求参数有误，请检查输入',
      401: '登录已过期，请重新登录',
      403: '权限不足',
      404: '请求的资源不存在',
      429: '请求过于频繁，请稍后重试',
      500: '服务器内部错误',
      502: '网关异常',
      503: '服务暂时不可用',
    }
    const msg = errorMap[res.status] || `请求失败: ${res.status}`
    throw new Error(msg)
  }
  const json = await res.json()
  if (json.success === false) {
    throw new Error(json.message || '操作失败')
  }
  return json
}
