/**
 * Migration: Encrypt all plaintext API Keys
 * 
 * Runs AES-256-GCM encryption on existing plaintext keys in:
 * - UserModelConfigV2 (6 key fields, 23 records)
 * - ApiKey (keyValue, 2 records)
 * 
 * Safe to run idempotently: skips keys that already contain ':' (encrypted format)
 */

import { PrismaClient } from '@prisma/client'
import { encryptKey, decryptKey } from '../../src/services/crypto.service.ts'

const prisma = new PrismaClient()

function isEncrypted(value: string): boolean {
  // Encrypted format: iv:tag:ciphertext (3 hex parts separated by ':')
  const parts = value.split(':')
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p))
}

async function migrateUserModelConfigV2() {
  console.log('\n=== Migrating UserModelConfigV2 ===')
  
  const configs = await prisma.userModelConfigV2.findMany({
    select: {
      userId: true,
      imageApiKey: true,
      videoApiKey: true,
      ttsApiKey: true,
      llmApiKey: true,
      musicApiKey: true,
      visionUnderstandApiKey: true,
    },
  })

  let migrated = 0
  let skipped = 0
  let failed = 0

  const keyFields = [
    'imageApiKey',
    'videoApiKey',
    'ttsApiKey',
    'llmApiKey',
    'musicApiKey',
    'visionUnderstandApiKey',
  ] as const

  for (const config of configs) {
    const updates: Record<string, string> = {}
    let hasUpdate = false

    for (const field of keyFields) {
      const plain = config[field]
      if (!plain || plain.trim() === '') continue
      
      if (isEncrypted(plain)) {
        skipped++
        continue
      }

      try {
        // Verify it's actually plaintext by trying to decrypt (should fail)
        try {
          decryptKey(plain)
          // If decryption succeeds, it's already encrypted
          skipped++
          continue
        } catch {
          // Decryption failed → it's plaintext, encrypt it
        }

        const encrypted = encryptKey(plain)
        updates[field] = encrypted
        hasUpdate++
        migrated++
        console.log(`  🔐 ${field} for user ${config.userId.substring(0, 8)}... encrypted`)
      } catch (err: any) {
        console.error(`  ❌ ${field} for user ${config.userId.substring(0, 8)}... FAILED: ${err.message}`)
        failed++
      }
    }

    if (hasUpdate) {
      try {
        await prisma.userModelConfigV2.update({
          where: { userId: config.userId },
          data: updates,
        })
      } catch (err: any) {
        console.error(`  ❌ Update failed for user ${config.userId}: ${err.message}`)
        failed++
        migrated -= hasUpdate
      }
    }
  }

  console.log(`  Summary: ${migrated} encrypted, ${skipped} already encrypted/empty, ${failed} failed`)
  return { migrated, skipped, failed }
}

async function migrateApiKey() {
  console.log('\n=== Migrating ApiKey ===')
  
  const keys = await prisma.apiKey.findMany({
    select: { id: true, provider: true, keyName: true, keyValue: true },
  })

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const key of keys) {
    if (!key.keyValue || key.keyValue.trim() === '') {
      skipped++
      continue
    }

    if (isEncrypted(key.keyValue)) {
      skipped++
      continue
    }

    try {
      // Verify it's plaintext
      try {
        decryptKey(key.keyValue)
        skipped++
        continue
      } catch {
        // It's plaintext
      }

      const encrypted = encryptKey(key.keyValue)
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { keyValue: encrypted },
      })
      migrated++
      console.log(`  🔐 ApiKey "${key.keyName}" (${key.provider}) encrypted`)
    } catch (err: any) {
      console.error(`  ❌ ApiKey "${key.keyName}" (${key.provider}) FAILED: ${err.message}`)
      failed++
    }
  }

  console.log(`  Summary: ${migrated} encrypted, ${skipped} already encrypted/empty, ${failed} failed`)
  return { migrated, skipped, failed }
}

async function verifyMigration() {
  console.log('\n=== Verifying Migration ===')
  
  // Check for any remaining plaintext keys
  const plaintextPatterns = ['sk-', 'AIza', 'key-', 'sk_']
  
  // Check UserModelConfigV2
  const configs = await prisma.userModelConfigV2.findMany()
  let plaintextCount = 0
  
  for (const config of configs) {
    const keyFields = ['imageApiKey', 'videoApiKey', 'ttsApiKey', 'llmApiKey', 'musicApiKey', 'visionUnderstandApiKey'] as const
    for (const field of keyFields) {
      const val = config[field]
      if (!val) continue
      if (plaintextPatterns.some(p => val.toLowerCase().includes(p.toLowerCase()))) {
        plaintextCount++
        console.log(`  ⚠️  UserModelConfigV2.${field} for ${config.userId.substring(0, 8)}... still plaintext`)
      }
    }
  }
  
  // Check ApiKey
  const apiKeys = await prisma.apiKey.findMany()
  for (const key of apiKeys) {
    if (plaintextPatterns.some(p => key.keyValue.toLowerCase().includes(p.toLowerCase()))) {
      plaintextCount++
      console.log(`  ⚠️  ApiKey "${key.keyName}" still plaintext`)
    }
  }
  
  if (plaintextCount === 0) {
    console.log('  ✅ All keys are encrypted!')
  } else {
    console.log(`  ⚠️  ${plaintextCount} keys still in plaintext`)
  }
  
  return plaintextCount
}

async function main() {
  console.log('🔑 API Key Encryption Migration')
  console.log('=' .repeat(50))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log(`Encryption key configured: ${!!process.env.CRYPTO_ENCRYPTION_KEY}`)

  if (!process.env.CRYPTO_ENCRYPTION_KEY) {
    console.error('❌ CRYPTO_ENCRYPTION_KEY not set in environment!')
    process.exit(1)
  }

  const userResults = await migrateUserModelConfigV2()
  const apiKeyResults = await migrateApiKey()
  const plaintextRemaining = await verifyMigration()

  console.log('\n' + '='.repeat(50))
  console.log('Migration Complete!')
  console.log(`Total encrypted: ${userResults.migrated + apiKeyResults.migrated}`)
  console.log(`Already encrypted: ${userResults.skipped + apiKeyResults.skipped}`)
  console.log(`Failed: ${userResults.failed + apiKeyResults.failed}`)
  console.log(`Plaintext remaining: ${plaintextRemaining}`)
  console.log(`Finished at: ${new Date().toISOString()}`)
}

main()
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
