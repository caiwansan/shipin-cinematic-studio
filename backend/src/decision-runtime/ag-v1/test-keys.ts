// 测试用户 LLM API Key 连通性
// 用法: cd /root/shipin-cinematic-studio/backend && tsx /tmp/test-keys.ts

import { Client } from 'pg'
import crypto from 'crypto'

const ENCRYPTION_KEY_HEX = process.env.CRYPTO_ENCRYPTION_KEY!
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex')

function decryptKey(encrypted: string): string {
  const [ivHex, tagHex, ciphertext] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)
  let d = decipher.update(ciphertext, 'hex', 'utf8')
  d += decipher.final('utf8')
  return d
}

function mask(text: string): string {
  if (!text || text.length < 10) return '****'
  return text.substring(0, 8) + '****' + text.substring(text.length - 4)
}

async function testDeepSeek(key: string) {
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }),
    signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) return `HTTP ${r.status}: ${(await r.text()).substring(0, 80)}`
  const d: any = await r.json()
  return `✅ ${d?.choices?.[0]?.message?.content || 'ok'}`
}

async function testVolcengine(key: string) {
  const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'doubao-seed-2-0-plus-260428', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }),
    signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) return `HTTP ${r.status}: ${(await r.text()).substring(0, 80)}`
  const d: any = await r.json()
  return `✅ ${d?.choices?.[0]?.message?.content || 'ok'}`
}

async function testSiliconflow(key: string) {
  const r = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'deepseek-ai/DeepSeek-R1', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }),
    signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) return `HTTP ${r.status}: ${(await r.text()).substring(0, 80)}`
  const d: any = await r.json()
  return `✅ ${d?.choices?.[0]?.message?.content || 'ok'}`
}

const testers: Record<string, (k: string) => Promise<string>> = {
  deepseek: testDeepSeek,
  volcengine: testVolcengine,
  siliconflow: testSiliconflow,
}

async function main() {
  console.log('========================================')
  console.log('  LLM API Key 连通性测试')
  console.log('========================================\n')

  const client = new Client({ host: 'localhost', port: 5432, database: 'aigc_scs', user: 'postgres', password: 'postgres' })
  await client.connect()
  const res = await client.query(`SELECT "userId", "llmProvider", "llmModel", "llmApiKey" FROM "UserModelConfigV2" WHERE "llmApiKey" IS NOT NULL AND "llmApiKey" != '' AND "llmEnabled" = true ORDER BY "updatedAt" DESC`)
  await client.end()

  console.log(`共 ${res.rows.length} 条配置\n`)

  let ok = 0, fail = 0
  for (const row of res.rows) {
    const uid = (row.userId as string).substring(0, 8)
    const prov = row.llmProvider
    const model = row.llmModel || '(?)'
    let key: string
    try { key = decryptKey(row.llmApiKey) } catch (e: any) {
      console.log(`❌ [${uid}] ${prov}/${model} — 解密失败`)
      fail++; continue
    }
    console.log(`🔍 [${uid}] ${prov}/${model} key=${mask(key)}`)

    const tester = testers[prov]
    const result = tester ? await tester(key) : await testDeepSeek(key)
    if (result.startsWith('✅')) {
      console.log(`   ${result}`); ok++
    } else {
      console.log(`   ❌ ${result}`); fail++
    }
  }

  console.log(`\n结果: ✅ ${ok} 可用 | ❌ ${fail} 不可用 | 共 ${res.rows.length} 条`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
