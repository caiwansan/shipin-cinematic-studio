import { prisma } from './src/utils/index.js'

async function main() {
  // Check adminUser table
  const admin = await prisma.adminUser.findUnique({ where: { username: 'admin' } })
  console.log('AdminUser:', admin ? { id: admin.id, username: admin.username, email: admin.email } : 'NOT FOUND')
  
  // Check if there's a User with the same email
  if (admin?.email) {
    const user = await prisma.user.findUnique({ where: { email: admin.email } })
    console.log('User by admin email:', user ? { id: user.id, email: user.email } : 'NOT FOUND')
  }
  
  // Check User with email admin@scs.com
  const user = await prisma.user.findUnique({ where: { email: 'admin@scs.com' } })
  console.log('User admin@scs.com:', user ? { id: user.id, email: user.email } : 'NOT FOUND')
}

main().catch(console.error).finally(() => prisma.$disconnect())
