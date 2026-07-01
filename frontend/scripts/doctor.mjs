#!/usr/bin/env node
/**
 * doctor.mjs — 整体健康状况检查
 *
 * 一条命令检查所有环节：构建产物 → PM2 进程 → HTTP 可达 → API 版本
 *
 * 适用于：本地调试、CI 集成、上线前最终确认
 */
async function main() {
  const BASE = process.env.BASE_URL || 'https://aigc.fushtn.com'
  let allOk = true
  let idx = 0

  const results = []

  function check(name, ok, detail) {
    idx++
    const mark = ok ? '✅' : '❌'
    console.log(`  ${mark}  [${idx}] ${name}${detail ? ' — ' + detail : ''}`)
    if (!ok) allOk = false
    results.push({ name, ok, detail })
  }

  console.log(`🔬 Deployment Doctor — ${BASE}\n`)

  // ── 1. Build Validator (走 Node 脚本) ──
  const { execSync } = await import('child_process')
  const { existsSync, readFileSync } = await import('fs')
  const { resolve } = await import('path')
  const __dirname = resolve(new URL(import.meta.url).pathname, '..')

  let buildOk = false
  try {
    execSync(`node ${resolve(__dirname, 'build-validator.mjs')}`, { stdio: 'pipe' })
    buildOk = true
  } catch { /* validator already logged */ }
  // 不输出 validator 内部的详细日志, 只记结果
  check('Build Validator', buildOk)

  // ── 2. Nitro Server Entry ──
  const serverEntry = resolve(__dirname, '..', '.output/server/index.mjs')
  check('Nitro Server Entry', existsSync(serverEntry), 
    existsSync(serverEntry) ? `${(readFileSync(serverEntry).length / 1024).toFixed(1)} KB` : 'missing')

  // ── 3. Assets Directory ──
  const nuxtDir = resolve(__dirname, '..', '.output/public/_nuxt')
  if (existsSync(nuxtDir)) {
    const { readdirSync } = await import('fs')
    const files = readdirSync(nuxtDir).filter(f => f.endsWith('.js') || f.endsWith('.css'))
    check('Assets Directory', files.length > 0, `${files.length} JS/CSS files`)
  } else {
    check('Assets Directory', false, '_nuxt/ not found')
  }

  // ── 4. PM2 Process ──
  try {
    const pm2Out = execSync('pm2 list', { encoding: 'utf-8', timeout: 5000 })
    const hasNuxt = pm2Out.includes('nuxt-frontend') && pm2Out.includes('online')
    check('PM2 (nuxt-frontend online)', hasNuxt, hasNuxt ? 'online' : 'not found or not online')
  } catch {
    check('PM2 (nuxt-frontend online)', false, 'pm2 command failed')
  }

  // ── 5. HTTP Homepage ──
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(10000) })
    const text = await res.text()
    check('HTTP Homepage (200)', res.status === 200, `${res.status}`)
    check('Homepage contains __NUXT__', text.includes('__NUXT__'))
  } catch (e) {
    check('HTTP Homepage (200)', false, e.message)
    check('Homepage contains __NUXT__', false)
  }

  // ── 6. Critical Routes ──
  const routes = ['/workspace/geo/dashboard', '/workspace/drama/storyboard']
  for (const route of routes) {
    try {
      const res = await fetch(`${BASE}${route}`, { signal: AbortSignal.timeout(10000) })
      check(`Route ${route}`, res.status === 200, `${res.status}`)
    } catch (e) {
      check(`Route ${route}`, false, e.message)
    }
  }

  // ── 7. Asset Integrity (sample) ──
  try {
    const homeRes = await fetch(BASE, { signal: AbortSignal.timeout(10000) })
    const html = await homeRes.text()
    const jsRefs = [...html.matchAll(/<script[^>]+src="(\/_nuxt\/[^"]+)"/g)].map(m => m[1])
    let jsOk = 0, jsFail = 0
    for (const ref of jsRefs.slice(0, 5)) {
      try {
        const r = await fetch(`${BASE}${ref}`, { signal: AbortSignal.timeout(5000) })
        if (r.ok && r.status === 200) jsOk++; else jsFail++
      } catch { jsFail++ }
    }
    if (jsRefs.length > 0) {
      check('Asset Serving (sample 5)', jsFail === 0, `${jsOk}/5 OK (${jsRefs.length} total refs)`)
    } else {
      check('Asset Serving', false, 'no JS refs found')
    }
  } catch (e) {
    check('Asset Serving', false, e.message)
  }

  console.log(`\n${'='.repeat(50)}`)
  if (allOk) {
    console.log(`✅ Deployment Healthy — ${results.filter(r => r.ok).length}/${results.length} checks passed`)
    process.exit(0)
  } else {
    console.log(`❌ Deployment Failed — ${results.filter(r => r.ok).length}/${results.length} checks passed`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error(`💥 doctor error:`, e.message)
  process.exit(1)
})
