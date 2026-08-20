import 'dotenv/config'
const { PrismaClient } = await import('@prisma/client')
const p = new PrismaClient()
const r = await p.$queryRawUnsafe('select id, industry, day, brief, created_at::float8 as ca from news_fetch_log order by id desc limit 6')
console.log(JSON.stringify((r||[]).map((x: any) => ({ id: Number(x.id), ind: x.industry, day: x.day, brief: !!x.brief, ca: x.ca })), null, 0))
process.exit(0)
