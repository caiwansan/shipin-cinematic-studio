/**
 * Fix EnterpriseLlmConfig API key — decrypt from apiKey table, re-encrypt for LLM config
 */
import { PrismaClient } from '@prisma/client'
import { encryptKey, decryptKey } from '../src/services/crypto.service.js'
const p = new PrismaClient()

async function main() {
  // Get the raw deepseek key from apiKey table
  const keyRecord = await p.apiKey.findFirst({ where: { provider: 'deepseek' } })
  if (!keyRecord) { console.log('No api key found'); return }
  
  const rawEncryptedKey = keyRecord.keyValue
  console.log('Raw encrypted key:', rawEncryptedKey.slice(0, 30) + '...')
  
  // Decrypt the apiKey (it's encrypted by the crypto service)
  const decryptedKey = decryptKey(rawEncryptedKey)
  console.log('Decrypted key:', decryptedKey.slice(0, 15) + '...' + decryptedKey.slice(-4))
  
  // Re-encrypt for EnterpriseLlmConfig
  const reEncrypted = encryptKey(decryptedKey)
  
  // Update the LLM config for our user
  const userId = '4e2f6062-956f-4d9e-96c2-2d266ec8efa8'
  const result = await p.enterpriseLlmConfig.updateMany({
    where: { tenantId: userId },
    data: { encryptedApiKey: reEncrypted, modelName: 'deepseek-chat' }
  })
  console.log('Updated configs:', result.count)
  
  await p.$disconnect()
  console.log('✅ LLM config key fixed')
}

main().catch(e => { console.error(e); p.$disconnect(); process.exit(1) })
