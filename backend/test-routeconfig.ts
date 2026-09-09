import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const row = await prisma.routeConfig.findUnique({
    where: { scope_key: { scope: 'route:admin-global-config', key: 'providers' } }
  })
  console.log('Found:', !!row)
  if (row) {
    console.log('Value type:', typeof row.value)
    console.log('Is array:', Array.isArray(row.value))
    console.log('Length:', JSON.stringify(row.value).length)
    console.log('First 200 chars:', JSON.stringify(row.value).slice(0, 200))
  }
}
main().catch(e => console.error('ERROR:', e.message)).finally(() => prisma.$disconnect())
