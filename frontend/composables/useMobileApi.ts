// 手机版共享 API 工具（mobile-app.vue 子页面统一使用）
// 与桌面版保持一致：token 来自 localStorage auth_token，凭证 cookie 兜底

export function mobileToken(): string {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

export function mobileAuthFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) || {}) }
  const t = mobileToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  return fetch(input, { ...init, headers, credentials: 'include' })
}

/** 简单 toast（子页面内自绘，避免依赖父组件） */
export function mobileToast(msg: string) {
  try {
    window.dispatchEvent(new CustomEvent('tea:mobile-toast', { detail: { msg } }))
  } catch { /* noop */ }
}

/** 金额格式化 */
export function fmtMoney(n: any): string {
  const v = Number(n || 0)
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
