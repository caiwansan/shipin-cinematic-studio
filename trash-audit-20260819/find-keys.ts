import { prisma } from './src/utils/index.js'
import { decryptKey } from './src/services/crypto.service.js'

async function findKeys() {
  const creds = await prisma.providerCredential.findMany({ where: { provider: 'deepseek' } })
  console.log('Deepseek credentials:', creds.length)
  for (const c of creds) {
    console.log('  - org:', c.organizationId?.slice(0,8), 'status:', c.status, 'health:', c.healthStatus)
    try {
      const key = decryptKey(c.encryptedKey)
      console.log('    key (first 20):', key.slice(0, 20) + '...')
    } catch (e: any) {
      console.log('    decrypt failed:', e.message)
    }
  }
  await prisma.$disconnect()
}
findKeys().catch(e => { console.error(e.message); process.exit(1) })
