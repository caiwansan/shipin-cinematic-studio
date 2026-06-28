import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const prompts = await prisma.promptTemplate.findMany()
  console.log(`Found ${prompts.length} prompt templates`)

  let created = 0
  for (const p of prompts) {
    // 检查是否已有 v1
    const existing = await prisma.promptVariant.findUnique({
      where: { name_version: { name: p.name, version: 'v1' } },
    })
    if (existing) continue

    await prisma.promptVariant.create({
      data: {
        name: p.name,
        version: 'v1',
        label: 'stable',
        description: p.description || undefined,
        content: p.content || {},
        parentVersion: undefined,
      },
    })
    created++
  }

  console.log(`Created ${created} variant v1 records (skipped ${prompts.length - created} existing)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
