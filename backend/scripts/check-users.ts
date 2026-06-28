import { PrismaClient } from '@prisma/client'
async function main() {
  const p = new PrismaClient()
  const users = await p.user.findMany({ take: 3, select: { id: true, email: true, username: true, createdAt: true } })
  for (const u of users) {
    console.log(`${u.id} | ${u.email || '(no email)'} | ${u.username || '(no username)'} | ${u.createdAt}`)
  }
  // Check if there are any tokens in the session table
  const sessions = await p.session.findMany({ take: 2 })
  if (sessions.length > 0) {
    console.log(`\nSessions exist: ${sessions.length} total`)
    console.log(`First session: ${sessions[0].id} | expires: ${sessions[0].expiresAt}`)
  } else {
    console.log('\nNo sessions found')
  }
  await p.\$disconnect()
}
main()
