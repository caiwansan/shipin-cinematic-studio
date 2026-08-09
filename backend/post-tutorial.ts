import { prisma } from './src/utils/index.js'
import jwt from 'jsonwebtoken'
import http from 'http'
import fs from 'fs'

async function main() {
  const SECRET = process.env.JWT_SECRET || 'jwt_secret_dev_only_change_in_production'
  const user = await prisma.user.findUnique({ where: { username: '南波万' } })
  if (!user) { console.log('user not found'); process.exit(1) }
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' })

  const content = fs.readFileSync('/root/.openclaw/workspace/tutorial-media-workbench.md', 'utf8')
  const body = JSON.stringify({
    title: '新媒体运营工作台操作教程：从零开始，一步步教你使用昆仑镜',
    content,
    category: 'tutorial',
    tags: '教程,入门,工作台,AI员工',
  })

  const req = http.request({
    hostname: 'localhost',
    port: 4002,
    path: '/api/community/posts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': `Bearer ${token}`,
    },
  }, (res) => {
    let data = ''
    res.on('data', (chunk) => data += chunk)
    res.on('end', () => {
      console.log('STATUS:', res.statusCode)
      try {
        const parsed = JSON.parse(data)
        console.log('POST_ID:', parsed.post?.id || 'N/A')
        console.log('ERROR:', parsed.error || parsed.message || 'none')
        console.log('DAILY:', JSON.stringify(parsed.daily))
      } catch {
        console.log('RAW:', data.slice(0, 500))
      }
    })
  })
  req.write(body)
  req.end()

  await prisma.$disconnect()
}
main().catch(e => { console.error(e.message); process.exit(1) })
