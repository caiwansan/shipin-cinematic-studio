import { prisma } from './src/utils/index.js'

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: '2281559777@qq.com' },
    select: { id: true, email: true, passwordHash: true },
  })
  if (user) {
    console.log('User found:', user.id, user.email)
    console.log('Password hash:', user.passwordHash?.substring(0, 20) + '...')
  } else {
    console.log('User not found')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
