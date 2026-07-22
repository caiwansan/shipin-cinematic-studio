import { prisma } from '../utils/index.js'
import { credentialResolver } from './credential/credential-resolver'
import { vaultService } from './credential/vault-service'

const DEFAULT_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
}

export async function testModelConnection(modelId: string) {
  const model = await prisma.aiModel.findUnique({ where: { id: modelId } })
  if (!model) {
    return { ok: false, latency: null, error: '模型不存在' }
  }

  let apiKey = process.env[model.apiKeyRef] || ''
  if (!apiKey && model.provider) {
    const resolved = await credentialResolver.resolve({ ownerType: 'system', ownerId: `model:${model.provider}`, capability: 'text-generation' })
    if (resolved) {
      const decrypted = await vaultService.getDecryptedCredential(resolved.credentialId)
      if (decrypted?.apiKey) {
        apiKey = decrypted.apiKey
      }
    }
  }

  const endpoint = model.endpointUrl || DEFAULT_ENDPOINTS[model.provider] || ''
  if (!endpoint) {
    return { ok: false, latency: null, error: `未配置 ${model.provider} 的默认 Endpoint，请手动填写 Endpoint URL` }
  }
  if (!apiKey) {
    return { ok: false, latency: null, error: '缺少 API Key' }
  }

  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    })
    const json = await res.json()
    const ok = !!(json.choices || json.data || json.id)
    return {
      ok,
      latency: ok ? Math.round(Date.now() - t0) : null,
      error: ok ? undefined : `HTTP ${res.status}`,
    }
  } catch (e: any) {
    return { ok: false, latency: null, error: e.message?.slice(0, 100) }
  }
}
