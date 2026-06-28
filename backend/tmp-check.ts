import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const count = await p.userAsset.count()
  console.log('UserAsset count:', count)
  const sample = await p.userAsset.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true, url: true, userId: true } })
  console.log('Latest asset:', sample)
  await p.$disconnect()
}
main().catch(e => { console.error(e); p.$disconnect() })
