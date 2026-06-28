// ============================================================
// Credential Vault — encrypted credential storage
// KMKI-PLAT-008: All API Key encrypted, Execution Runtime never gets plaintext
// ============================================================

import crypto from 'crypto'
import type { ResourceCredential } from '../types'
import { credentialRepository } from '../repositories/credential.repository'
import { PlatformError } from '@platform/errors/platform-errors'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get the encryption key from environment.
 * Falls back to a development-only key if not set.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.RESOURCE_VAULT_KEY || process.env.CREDENTIAL_VAULT_KEY
  if (keyHex) {
    return Buffer.from(keyHex, 'hex')
  }
  // Dev-only fallback — NEVER use in production
  if (process.env.NODE_ENV === 'production') {
    throw new PlatformError('VAULT_CONFIG_ERROR', 'RESOURCE_VAULT_KEY environment variable is required in production')
  }
  console.warn('[CredentialVault] ⚠️ Using DEV encryption key. Set RESOURCE_VAULT_KEY in production.')
  return crypto.createHash('sha256').update('dev-only-key-do-not-use-in-production').digest()
}

/**
 * Encrypt a plaintext string.
 */
function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return { encrypted, iv: iv.toString('hex'), authTag }
}

/**
 * Decrypt an encrypted string.
 */
function decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Encode encrypted data as a single string for storage.
 * Format: iv:authTag:ciphertext (all hex)
 */
function encode(plaintext: string): string {
  const result = encrypt(plaintext)
  return `${result.iv}:${result.authTag}:${result.encrypted}`
}

/**
 * Decode and decrypt from the encoded format.
 */
function decode(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new PlatformError('VAULT_DECODE_ERROR', 'Invalid encrypted credential format')
  }
  return decrypt(parts[2], parts[0], parts[1])
}

/**
 * Credential Vault — secure credential management.
 * Execution Runtime calls resolveCredential() which returns a decrypted key
 * only within the current request context.
 */
export const credentialVault = {
  /**
   * Store a credential with encrypted key.
   */
  async store(data: {
    resourceId: string
    tenantId: string
    workspaceId?: string
    name: string
    apiKey: string    // plaintext, will be encrypted before storage
    endpoint?: string
    models?: string
    status?: string
    expiresAt?: Date
    metadata?: string
  }): Promise<ResourceCredential> {
    const encryptedKey = encode(data.apiKey)
    return credentialRepository.create({
      resourceId: data.resourceId,
      tenantId: data.tenantId,
      workspaceId: data.workspaceId,
      name: data.name,
      encryptedKey,
      endpoint: data.endpoint,
      models: data.models,
      status: data.status || 'active',
      expiresAt: data.expiresAt,
      metadata: data.metadata,
    })
  },

  /**
   * Resolve a credential and return decrypted key.
   * This is the ONLY way Execution Runtime gets the plaintext key.
   * The key is NOT cached in memory beyond this call.
   */
  async resolve(credentialId: string): Promise<{ apiKey: string; endpoint?: string; models?: string }> {
    const credential = await credentialRepository.findById(credentialId)
    if (!credential) {
      throw new PlatformError('CREDENTIAL_NOT_FOUND', `Credential ${credentialId} not found`)
    }
    if (credential.status !== 'active') {
      throw new PlatformError('CREDENTIAL_INACTIVE', `Credential ${credentialId} is not active (${credential.status})`)
    }
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new PlatformError('CREDENTIAL_EXPIRED', `Credential ${credentialId} has expired`)
    }

    const apiKey = decode(credential.encryptedKey)
    return { apiKey, endpoint: credential.endpoint || undefined, models: credential.models || undefined }
  },

  /**
   * Update a credential's key (rotation).
   */
  async rotate(credentialId: string, newApiKey: string): Promise<ResourceCredential> {
    const encryptedKey = encode(newApiKey)
    return credentialRepository.update(credentialId, {
      encryptedKey,
      lastRotated: new Date(),
    })
  },

  /**
   * Update credential status (activate/deactivate).
   */
  async setStatus(credentialId: string, status: string): Promise<ResourceCredential> {
    return credentialRepository.update(credentialId, { status: status as any })
  },

  /**
   * Verify that the encryption key is configured.
   */
  isConfigured(): boolean {
    try {
      getEncryptionKey()
      return true
    } catch {
      return false
    }
  },
}
