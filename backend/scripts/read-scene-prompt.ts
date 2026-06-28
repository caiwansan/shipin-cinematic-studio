import { PrismaClient } from '@prisma/client'
async function main() {
  const p = new PrismaClient()
  const r = await p.promptTemplate.findUnique({ where: { name: '场景设计师' } })
  if (r?.content && typeof r.content === 'object') {
    const prompt = (r.content as any).prompt || ''
    console.log('LENGTH: ' + prompt.length)
    console.log(prompt)
  } else {
    console.log('NOT FOUND')
    const all = await p.promptTemplate.findMany({ take: 20, select: { name: true } })
    console.log('Available:', all.map(x => x.name).join(', '))
  }
  await p.$disconnect()
}
main()
