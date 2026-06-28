/**
 * Model Isolation Guard — PPT Studio SaaS 宪法强制执行
 * 
 * 防止 PPT Studio 代码直接调用 Provider，确保所有模型调用走 Runtime
 */
export function validateNoDirectModelAccess(code: string): boolean {
  const forbidden = [
    'new OpenAI',
    'new DeepSeek',
    'new Anthropic',
    'axios.post.*openai',
    'api-key',
    'api_key',
    'sk-',
  ]

  for (const rule of forbidden) {
    if (code.toLowerCase().includes(rule.toLowerCase())) {
      console.error(`[ModelIsolationGuard] VIOLATION: "${rule}" detected in code`)
      return false
    }
  }
  return true
}
