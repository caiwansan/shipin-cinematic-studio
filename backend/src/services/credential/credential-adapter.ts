import { credentialResolver } from './credential-resolver'
import { vaultService } from './vault-service'

export interface AICredential {
  provider: string
  apiKey: ***  baseUrl?: string
  model?: string
}

export async function resolveAICredential(params: {
  userId?: string
  organizationId?: string
  capability: string
}): Promise<AICredential | null> {
  const { userId, organizationId, capability } = params
  const ownerType = organizationId ? 'organization' : 'user'
  const ownerId = organizationId || userId || 'anonymous'

  const resolved = await credentialResolver.resolve({ ownerType, ownerId, capability: capability as any })
  if (!resolved) return null

  const decrypted = await vaultService.getDecryptedCredential(resolved.credentialId)
  return {
    provider: resolved.providerCapability.vendor,
    apiKey: decrypted?.apiKey || '',
    baseUrl: decrypted?.provider?.baseUrl,
    model: resolved.providerCapability.modelFamily,
  }
}

export async function getUserLLMKey(userId: string): Promise<AICredential | null> {
  return resolveAICredential({ userId, capability: 'text-generation' })
}

export async function getEnterpriseLLMKey(tenantId: string): Promise<AICredential | null> {
  return resolveAICredential({ organizationId: tenantId, capability: 'text-generation' })
}

export async function getImageKey(userId: string): Promise<AICredential | null> {
  return resolveAICredential({ userId, capability: 'image-generation' })
}
