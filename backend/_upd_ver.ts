import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } })
  if (!row) { console.log('NO ROW'); return }
  const v = row.value as any  // 已是对象
  console.log('BEFORE latestVersion=', v.latestVersion, 'apkUrl=', v.apkUrl, 'versionCode=', v.versionCode)
  v.latestVersion = '1.2.1'
  v.apkUrl = 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.1.apk'
  if (v.versionCode !== undefined) v.versionCode = 1201
  await prisma.routeConfig.update({ where: { scope_key: { scope: 'tea', key: 'config' } }, data: { value: v } })
  const back = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } })
  const v2 = back.value as any
  console.log('AFTER  latestVersion=', v2.latestVersion, 'apkUrl=', v2.apkUrl)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
