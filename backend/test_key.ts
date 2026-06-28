import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const config = await prisma.userModelConfig.findUnique({
    where: {
      userId_provider: { userId: '5cbabc6d-60f1-48e6-b8fe-cb4a15ac50e0', provider: 'deepseek' }
    }
  })
  if (!config?.apiKey) { console.log('no key found'); return }

  const { decryptKey } = await import('./src/services/crypto.service.js')
  const decrypted = decryptKey(config.apiKey)
  console.log('KEY_LENGTH:', decrypted.length)
  console.log('KEY_PREFIX:', decrypted.substring(0, 15))
  
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${decrypted}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'say hi' }],
      max_tokens: 10
    })
  })
  const text = await res.text()
  console.log('STATUS:', res.status)
  console.log('BODY:', text.substring(0, 300))
}

main().catch(console.error).finally(() => prisma.$disconnect())
