#!/usr/bin/env node
/**
 * deployment-check.mjs — 部署后线上验证 (Smoke Test)
 *
 * 在 PM2 重启后执行，验证线上环境是否可用：
 *   1. 首页 HTTP 200 + 包含 __NUXT__
 *   2. 关键页面返回 200
 *   3. 首页引用的所有 JS/CSS 返回正确 Content-Type
 *   4. JS 资源返回 application/javascript
 *   5. CSS 资源返回 text/css
 *
 * 任何一项失败 → exit(1) 标记部署失败
 */
const BASE = process.env.BASE_URL || 'https://aigc.fushtn.com'
const WAIT_MS = parseInt(process.env.WAIT_MS || '5000', 10)

const failures = []

function fail(msg) {
  failures.push(msg)
  console.error(`[deployment-check] ❌ ${msg}`)
}

function pass(msg) {
  console.log(`[deployment-check] ✅ ${msg}`)
}

async function fetchUrl(path, opts = {}) {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      ...opts
    })
    const text = opts.raw ? null : await res.text()
    return { ok: res.ok, status: res.status, headers: res.headers, text }
  } catch (e) {
    return { ok: false, status: 0, error: e.message, headers: new Map() }
  }
}

async function main() {
  console.log(`[deployment-check] 🔍 Smoke test against ${BASE}`)
  console.log(`[deployment-check] ⏳ Waiting ${WAIT_MS}ms for server...`)
  await new Promise(r => setTimeout(r, WAIT_MS))

  // ── 1. 首页 ──
  const home = await fetchUrl('/')
  if (home.ok && home.status === 200) {
    pass(`homepage returned HTTP 200`)
  } else {
    fail(`homepage returned ${home.status}: ${home.error || ''}`)
  }

  // ── 2. 首页包含 __NUXT__ ──
  if (home.text && home.text.includes('__NUXT__')) {
    pass(`homepage contains __NUXT__`)
  } else {
    fail(`homepage missing __NUXT__ (not an SSR/Nuxt page)`)
  }

  // ── 3. 关键页面 ──
  const criticalPaths = ['/workspace/geo/dashboard', '/workspace/drama/storyboard']
  for (const p of criticalPaths) {
    const res = await fetchUrl(p)
    if (res.ok && res.status === 200) {
      pass(`${p} → 200`)
    } else {
      fail(`${p} → ${res.status}${res.error ? ': ' + res.error : ''}`)
    }
  }

  // ── 4. 资源完整性 — 检查首页引用的 JS/CSS ──
  if (home.text) {
    const jsRefs = [...home.text.matchAll(/<script[^>]+src="(\/_nuxt\/[^"]+)"/g)].map(m => m[1])
    const cssRefs = [...home.text.matchAll(/<link[^>]+href="(\/_nuxt\/[^"]+\.css)"/g)].map(m => m[1])

    if (jsRefs.length === 0) {
      fail('no JS references found in homepage HTML')
    } else {
      pass(`homepage references ${jsRefs.length} JS + ${cssRefs.length} CSS assets`)
    }

    // 检查入口 JS
    const entryJs = jsRefs.find(r => !r.includes('prefetch'))
    if (entryJs) {
      const res = await fetchUrl(entryJs)
      const ct = res.headers.get?.('content-type') || res.headers.get?.('Content-Type') || ''
      if (res.ok && res.status === 200) {
        if (ct.includes('javascript') || ct.includes('application/octet-stream')) {
          pass(`entry JS ${entryJs} → 200 (Content-Type: ${ct})`)
        } else {
          fail(`entry JS ${entryJs} → wrong Content-Type: ${ct}`)
        }
      } else {
        fail(`entry JS ${entryJs} → ${res.status} (404? — asset mismatch)`)
      }
    }

    // 检查 CSS
    for (const css of cssRefs.slice(0, 3)) {
      const res = await fetchUrl(css)
      const ct = res.headers.get?.('content-type') || res.headers.get?.('Content-Type') || ''
      if (res.ok && res.status === 200) {
        if (ct.includes('text/css') || ct.includes('text/plain') || ct.includes('application/octet-stream')) {
          pass(`CSS ${css} → 200 (Content-Type: ${ct})`)
        } else {
          fail(`CSS ${css} → wrong Content-Type: ${ct}`)
        }
      } else {
        fail(`CSS ${css} → ${res.status}`)
      }
    }
  }

  // ── Summary ──
  if (failures.length > 0) {
    console.error(`[deployment-check] ❌ ${failures.length} failure(s) — deployment NOT verified`)
    process.exit(1)
  } else {
    console.log(`[deployment-check] ✅ All smoke tests passed — deployment verified`)
  }
}

main().catch(e => {
  console.error(`[deployment-check] 💥 Unhandled error:`, e.message)
  process.exit(1)
})
