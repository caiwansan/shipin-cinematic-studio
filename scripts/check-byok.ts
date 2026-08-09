import { prisma } from '../src/utils/index.js'
import { encryptKey, decryptKey } from '../src/services/crypto.service.js'

async function check() {
  const cred = await prisma.providerCredential.findFirst({ where: { provider: 'deepseek' } })
  if (cred) {
    console.log('Deepseek credential found:')
    console.log('  org:', cred.organizationId)
    console.log('  provider:', cred.provider)
    console.log('  encryptedKey length:', cred.encryptedKey?.length)
    console.log('  status:', cred.status)
    console.log('  healthStatus:', cred.healthStatus)
    
    try {
      const decrypted = decryptKey(cred.encryptedKey)
      console.log('  decrypted (first 30):', decrypted.slice(0, 30) + '...')
    } catch (e: any) {
      console.log('  decrypt failed:', e.message)
    }
  }
  await prisma.$disconnect()
}
check().catch(e => { console.error(e.message); process.exit(1) })
