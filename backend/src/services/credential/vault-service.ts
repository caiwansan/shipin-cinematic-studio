// backend/services/credential/vault-service.ts
// FIX 2026-07-23: 新凭证唯一写入入口

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface VaultCredentialInput {
  ownerType: 'user' | 'organization' | 'system'
  ownerId: string
  capability: string
  vendor: string
  modelFamily?: string
  baseUrl?: string
  apiKey: string
  createdBy: string
}

export const vaultService = {
  async createCredential(input: VaultCredentialInput) {
    return (prisma as any).credentialVault.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        capability: input.capability,
        status: 'active',
        encryptedPayload: input.apiKey,
        metadata: {
          provider_registry_id: input.vendor,
          model_family: input.modelFamily || '',
          base_url: input.baseUrl || '',
        },
        createdBy: input.createdBy,
      }
    })
  },

  async getDecryptedCredential(credentialId: string): Promise<{ apiKey: string; provider?: { vendor: string; modelFamily: string; baseUrl: string } } | null> {
    const record = await (prisma as any).credentialVault.findUnique({ where: { id: credentialId } })
    if (!record) return null

    return {
      apiKey: record.apiKey,
      provider: {
        vendor: (record.metadata as any)?.provider_registry_id || '',
        modelFamily: (record.metadata as any)?.model_family || '',
        baseUrl: (record.metadata as any)?.base_url || '',
      }
    }
  },
}
