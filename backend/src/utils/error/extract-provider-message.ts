/**
 * extract-provider-message.ts — 从各类 error 对象中提取语义消息
 *
 * 职责：将原始 error（fetch 异常/axios 响应/字面量）归一化为纯文本，
 *       供 classifyProviderError 做语义匹配。
 *
 * 核心原则：HTTP 层与业务语义层分离。
 *   ❌ err.status === 403 → "Permission Denied"
 *   ✔ err.response.data.message === "Model disabled" → "Model disabled"
 */

export function extractProviderMessage(err: any): string {
  if (!err) return ''

  // 1. 优先解析 response body
  if (err.body || err.data) {
    const body = err.body || err.data
    // 字符串 body
    if (typeof body === 'string') return body
    // JSON body，层层下探 message
    if (body.error?.message) return body.error.message
    if (body.message) return body.message
    if (body.error?.msg) return body.error.msg
    if (body.msg) return body.msg
  }

  // 2. 尝试 response body（fetch 异常结构）
  if (err.response) {
    const res = err.response
    if (res.data) {
      if (typeof res.data === 'string') return res.data
      if (res.data.error?.message) return res.data.error.message
      if (res.data.message) return res.data.message
    }
    if (res.body) {
      if (typeof res.body === 'string') return res.body
      if (res.body.error?.message) return res.body.error.message
      if (res.body.message) return res.body.message
    }
  }

  // 3. 解析 error.message 中的 JSON（硅基流动等直接将 JSON 拼在 message 中）
  if (err.message) {
    const msg = err.message
    // 尝试解析 message 中的 JSON 片段
    // 如: "硅基 TTS 失败 (403): {\"code\":30003,\"message\":\"Model disabled.\",\"data\":null}"
    const jsonMatch = msg.match(/\{.*"message"\s*:\s*"[^"]+".*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.message) return parsed.message
      } catch {
        // 非 JSON，继续
      }
    }
    // 尝试提取 status code + body 格式
    // "硅基 TTS 失败 (403): Model disabled"
    const colonMatch = msg.match(/:\s*(.+)/)
    if (colonMatch) return colonMatch[1].trim()

    return msg
  }

  // 4. 兜底
  return String(err)
}
