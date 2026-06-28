const { PrismaClient } = require('@prisma/client')
const jwt = require('jsonwebtoken')

async function main() {
  const p = new PrismaClient()
  const user = await p.user.findUnique({ where: { id: '5cbabc6d-60f1-48e6-b8fe-cb4a15ac50e0' } })
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'your-secret-key-change-in-production'
  const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '24h' })
  console.log('TOKEN=' + token)
  await p.$disconnect()
}
main()
