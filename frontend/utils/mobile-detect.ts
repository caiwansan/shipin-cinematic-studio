// 移动端 UA 检测（SSR: useRequestHeaders；client: navigator）
export function isMobileUA(ua?: string): boolean {
  const s = ua || ''
  if (!s) return false
  return /mobile|android|iphone|ipad|ipod|windows phone|phone|iemobile/i.test(s) && !/ipad|tablet/i.test(s) || /ipad/i.test(s)
}

// middleware 内取 UA（SSR + client 兼容）
export function detectMobile(): boolean {
  if (import.meta.server) {
    try {
      const headers = useRequestHeaders(['user-agent'])
      return isMobileUA(headers['user-agent'])
    } catch {
      return false
    }
  }
  return typeof navigator !== 'undefined' ? isMobileUA(navigator.userAgent) : false
}

// 校验 redirect 只允许站内路径（防开放跳转）
export function safeRedirect(raw: unknown, fallback = '/'): string {
  const s = typeof raw === 'string' ? raw : ''
  if (s.startsWith('/') && !s.startsWith('//')) return s
  return fallback
}
