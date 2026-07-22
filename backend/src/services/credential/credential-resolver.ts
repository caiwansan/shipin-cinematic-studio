// backend/services/credential/credential-resolver.ts
// FIX 2026-07-23: 统一凭证解析入口，Vault > Legacy 优先级

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type OwnerType = 'user' | 'organization' | 'system'
export type Capability = 'text-generation' | 'image-generation' | 'video-generation' | 'tts' | 'music' | 'vision'

export interface CredentialRequest {
  ownerType: OwnerType
  ownerId: string
  capability: Capability
}

export interface ResolvedCredential {
  credentialId: string
  source: 'VAULT' | 'LEGACY_USER_CONFIG' | 'LEGACY_ENTERPRISE' | 'LEGACY_RESOURCE'
  encryptedPayload: string
  providerCapability: {
    providerRegistryId: string
    vendor: string
    modelFamily: string
    baseUrl: string
  }
}

export class CredentialResolver {
  async resolve(req: CredentialRequest): Promise<ResolvedCredential | null> {
    const vaultCredential = await this.resolveFromVault(req)
    if (vaultCredential) return vaultCredential

    const legacyCredential = await this.resolveFromLegacy(req)
    if (legacyCredential) return legacyCredential

    console.warn('CREDENTIAL_NOT_FOUND', {
      ownerType: req.ownerType,
      ownerId: req.ownerId,
      capability: req.capability,
      timestamp: new Date().toISOString()
    })
    return null
  }

  private async resolveFromVault(req: CredentialRequest): Promise<ResolvedCredential | null> {
    const vault = await (prisma as any).credentialVault.findFirst({
      where: {
        ownerType: req.ownerType,
        ownerId: req.ownerId,
        capability: req.capability,
        status: 'active'
      }
    })
    if (!vault) return null

    const providerId = (vault.metadata as any)?.provider_registry_id
    const provider = providerId ? await (prisma as any).providerRegistry.findUnique({ where: { id: providerId } }) : null

    return {
      credentialId: vault.id,
      source: 'VAULT',
      encryptedPayload: vault.encryptedPayload,
      providerCapability: {
        providerRegistryId: provider?.id || 'legacy-unknown',
        vendor: provider?.vendor || 'unknown',
        modelFamily: provider?.modelFamily || '',
        baseUrl: provider?.baseUrl || ''
      }
    }
  }

  private async resolveFromLegacy(req: CredentialRequest): Promise<ResolvedCredential | null> {
    switch (req.ownerType) {
      case 'user': return this.resolveFromUserModelConfig(req)
      case 'organization': return this.resolveFromEnterpriseConfig(req)
      case 'system': return this.resolveFromResourceCredential(req)
      default: return null
    }
  }

  private async resolveFromUserModelConfig(req: CredentialRequest): Promise<ResolvedCredential | null> {
    const fieldMap: Record<Capability, string> = {
      'text-generation': 'llm',
      'image-generation': 'image',
      'video-generation': 'video',
      'tts': 'tts',
      'music': 'music',
      'vision': 'visionUnderstand'
    }
    const prefix = fieldMap[req.capability]
    if (!prefix) return null

    const config = await prisma.userModelConfigV2.findUnique({ where: { userId: req.ownerId } })
    if (!config) return null

    const apiKey = (config as any)[`${prefix}ApiKey`]
    if (!apiKey) return null

    const providerName = (config as any)[`${prefix}Provider`] as string
    const provider = providerName ? await (prisma as any).providerRegistry.findFirst({ where: { vendor: providerName } }) : null

    return {
      credentialId: config.userId,
      source: 'LEGACY_USER_CONFIG',
      encryptedPayload: apiKey,
      providerCapability: {
        providerRegistryId: provider?.id || 'legacy-unknown',
        vendor: providerName || 'unknown',
        modelFamily: (config as any)[`${prefix}Model`] || '',
        baseUrl: (config as any)[`${prefix}BaseUrl`] || ''
      }
    }
  }

  private async resolveFromEnterpriseConfig(req: CredentialRequest): Promise<ResolvedCredential | null> {
    const config = await prisma.enterpriseLlmConfig.findFirst({
      where: { tenantId: req.ownerId }
    })
    if (!config || !config.encryptedApiKey) return null

    const provider = await (prisma as any).providerRegistry.findFirst({ where: { vendor: config.provider } })

    return {
      credentialId: config.id,
      source: 'LEGACY_ENTERPRISE',
      encryptedPayload: config.encryptedApiKey,
      providerCapability: {
        providerRegistryId: provider?.id || 'legacy-unknown',
        vendor: config.provider,
        modelFamily: config.modelName || '',
        baseUrl: config.baseUrl || ''
      }
    }
  }

  private async resolveFromResourceCredential(req: CredentialRequest): Promise<ResolvedCredential | null> {
    const credential = await prisma.resourceCredential.findFirst({
      where: { tenantId: req.ownerId }
    })
    if (!credential || !credential.encryptedKey) return null

    const provider = await (prisma as any).providerRegistry.findFirst({ where: { vendor: credential.name } })

    return {
      credentialId: credential.id,
      source: 'LEGACY_RESOURCE',
      encryptedPayload: credential.encryptedKey,
      providerCapability: {
        providerRegistryId: provider?.id || 'legacy-unknown',
        vendor: credential.name,
        modelFamily: '',
        baseUrl: credential.endpoint || ''
      }
    }
  }
}

export const credentialResolver = new CredentialResolver()
