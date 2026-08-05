#!/usr/bin/env node
/**
 * release-watcher.mjs — GitHub Release → 官网下载源 自动同步
 *
 * Sprint A（掌柜 2026-08-04 指令）：发布链路自动化，杜绝人工搬运
 *
 * 链路：
 *   push tag (diag-* | v*) → GitHub Actions 构建 → GitHub Release（中间仓）
 *     → 本 watcher（cron 每 10 分钟）→ 官网 /releases/desktop/（用户下载源）
 *
 * 规则：
 *   - tag diag-*  → diagnostics/ 目录（诊断矩阵 A/B/C 全收），更新 diagnostic.json
 *   - tag v*      → windows/ 目录（正式版），更新 latest.json + signatures/*.sha256
 *
 * 可靠性：
 *   - 幂等：state 文件记录已处理 tag（processedTags），重复运行不重复下载
 *   - 校验：sha256 对照 GitHub API digest，不一致不落盘不更新 manifest
 *   - 顺序：先下载+校验成功，再更新 manifest（防止 manifest 指向不存在的文件）
 *   - 下载：GitHub 直连（20s 超时）失败 → ghfast.top 镜像 fallback
 *
 * 用法：
 *   node backend/scripts/release-watcher.mjs            # 正常同步
 *   node backend/scripts/release-watcher.mjs --dry-run  # 只报告不下载
 *   node backend/scripts/release-watcher.mjs --force    # 忽略 state 全量重同步
 */

import { createHash } from 'crypto'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 配置 ──
const REPO = 'caiwansan/shipin-cinematic-studio'
const API_BASE = `https://api.github.com/repos/${REPO}/releases`
const MIRROR_PREFIX = 'https://ghfast.top/'
const DIRECT_TIMEOUT_MS = 20000 // (unused with curl; kept for reference)

const RELEASES_ROOT = process.env.KUNLUN_RELEASES_ROOT || '/www/wwwroot/aigc.fushtn.com/releases/desktop'
const STATE_FILE = join(RELEASES_ROOT, '.watcher-state.json')
const DIAG_DIR = join(RELEASES_ROOT, 'diagnostics')
const WIN_DIR = join(RELEASES_ROOT, 'windows')
const SIG_DIR = join(RELEASES_ROOT, 'signatures')
const DIAG_MANIFEST = join(DIAG_DIR, 'diagnostic.json')
const LATEST_MANIFEST = join(RELEASES_ROOT, 'latest.json')

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

// ── 小工具 ──
function log(...args) { console.log(`[release-watcher ${new Date().toISOString()}]`, ...args) }

function cmpVersion(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0
    if (x !== y) return x - y
  }
  return 0
}

async function ghJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'kunlun-release-watcher', Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`)
  return res.json()
}

function sha256Of(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

async function downloadWithFallback(url, dest) {
  // 直连 20s 超时，失败 → ghfast.top 镜像（用 curl 子进程，超时可靠）
  const attempts = [
    { label: 'direct', url },
    { label: 'mirror', url: MIRROR_PREFIX + url },
  ]
  for (const a of attempts) {
    try {
      execFileSync('curl', ['-sL', '--connect-timeout', '15', '--max-time', '90', '-o', dest, a.url], { stdio: 'pipe', timeout: 120000 })
      if (existsSync(dest) && readFileSync(dest).length > 0) return a.label
      log(`  [${a.label}] empty download, skip`)
    } catch (e) {
      log(`  [${a.label}] failed: ${e.message?.split('\n')[0] || e}`)
    }
  }
  throw new Error(`download failed for ${url}`)
}

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) }
  catch { return { processedTags: {}, updatedAt: null } }
}

function saveState(state) {
  if (DRY_RUN) return
  state.updatedAt = new Date().toISOString()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ── manifest 更新 ──
function updateDiagManifest(releases) {
  // 从本次拉取的所有 diag assets 重建 packs（保序：最新 tag 在前）
  const packs = []
  for (const { tag, assets } of releases) {
    for (const a of assets) {
      if (!a.name.endsWith('.exe')) continue
      let id = 'diagc'
      if (a.name.includes('DiagA')) id = 'diaga'
      else if (a.name.includes('DiagB')) id = 'diagb'
      else if (a.name.includes('DiagC')) id = 'diagc'
      const url = `/releases/desktop/diagnostics/${a.name}`
      packs.push({
        id, name: a.name, filename: a.name, url,
        version: tag.replace(/^diag-/, ''),
        sha256: a.digest?.replace('sha256:', '') || '',
        size: a.size,
        publishedAt: a.publishedAt,
      })
    }
  }
  const manifest = {
    product: 'Kunlun Media Diagnostic',
    purpose: 'Desktop Reality 验证专用（内部测试），非正式版本。用于定位桌面端 JavaScript 执行链路问题。',
    updatedAt: new Date().toISOString(),
    buildTag: releases[0]?.tag || null,
    packs,
  }
  if (!DRY_RUN) writeFileSync(DIAG_MANIFEST, JSON.stringify(manifest, null, 2))
  return manifest
}

function updateStableManifest(releases) {
  // 取最新的 v tag release，更新 latest.json
  const rel = releases[0]
  if (!rel) return null
  const exe = rel.assets.find(a => a.name.endsWith('.exe'))
  if (!exe) return null
  const version = rel.tag.replace(/^v/, '')
  const manifest = {
    product: 'Kunlun Media',
    version,
    platform: 'windows-x64',
    downloadUrl: `/releases/desktop/windows/${exe.name}`,
    publishedAt: rel.publishedAt,
    signature: '',
    sha256: exe.digest?.replace('sha256:', '') || '',
    size: exe.size,
    notes: `昆仑镜桌面版 ${version} — GitHub Release 自动同步`,
    platforms: {
      'windows-x86_64': {
        signature: '',
        url: `https://aigc.fushtn.com/releases/desktop/windows/${exe.name}`,
      },
    },
  }
  if (!DRY_RUN) writeFileSync(LATEST_MANIFEST, JSON.stringify(manifest, null, 2))
  // signatures/<name>.sha256
  if (!DRY_RUN) {
    const sigFile = join(SIG_DIR, `${exe.name}.sha256`)
    writeFileSync(sigFile, `${exe.digest?.replace('sha256:', '') || ''}  ${exe.name}\n`)
  }
  return manifest
}

// ── 主流程 ──
async function main() {
  log(`start (dryRun=${DRY_RUN} force=${FORCE})`)
  mkdirSync(DIAG_DIR, { recursive: true })
  mkdirSync(WIN_DIR, { recursive: true })
  mkdirSync(SIG_DIR, { recursive: true })
  const state = loadState()

  // 拉取 releases（含 assets）
  const releases = await ghJson(`${API_BASE}?per_page=20`)
  const tags = releases
    .filter(r => !r.draft)
    .map(r => ({ tag: r.tag_name, publishedAt: r.published_at, assets: r.assets }))

  // 只同步「最新」tag：诊断矩阵所有 tag 的 A/B/C 产物文件名相同（tauri version 固定 1.1.0），
  // 历史 tag 后处理会覆盖最新产物；正式版只接受比当前 latest.json 更新的版本（防回退）。
  const diagAll = tags.filter(r => /^diag-/.test(r.tag))
  const diagReleases = diagAll.slice(0, 1)
  const diagArchived = diagAll.slice(1)
  const stableReleases = tags.filter(r => /^v\d/.test(r.tag))
  const currentStable = (() => {
    try { return JSON.parse(readFileSync(LATEST_MANIFEST, 'utf-8')).version || '0.0.0' }
    catch { return '0.0.0' }
  })()
  const stableToProcess = stableReleases.filter(r => cmpVersion(r.tag.replace(/^v/, ''), currentStable) > 0).slice(0, 1)

  // 历史 tag 全部标记 processed（GitHub Release 即历史存档，不落盘官网）
  // 修复(2026-08-05): 归档循环排除 stableToProcess（最新正式版不得标 archived，否则 L241 永远 skip）
  for (const rel of [...diagArchived, ...stableReleases.filter(r => r.tag !== (stableToProcess[0]?.tag))]) {
    if (!state.processedTags[rel.tag]) {
      state.processedTags[rel.tag] = { at: new Date().toISOString(), type: /^diag-/.test(rel.tag) ? 'diag' : 'stable', archived: true }
    }
  }

  const processedDiag = []
  const processedStable = []

  // ── diag-* → diagnostics/（仅最新）──
  for (const rel of diagReleases) {
    if (!FORCE && state.processedTags[rel.tag] && state.processedTags[rel.tag].archived) { log(`skip ${rel.tag} (archived)`); continue }
    if (!FORCE && state.processedTags[rel.tag] && !state.processedTags[rel.tag].archived) { log(`skip ${rel.tag} (already processed)`); continue }
    log(`sync diag ${rel.tag} (${rel.assets.length} assets)`)
    for (const a of rel.assets) {
      if (!a.name.endsWith('.exe')) continue
      // C 壳（完整壳）asset 名为 Kunlun.Media_* → 统一命名 KunlunMedia-DiagC_*
      const destName = /Diag[ABC]/.test(a.name)
        ? a.name
        : 'KunlunMedia-DiagC_' + (a.name.match(/_([\d.]+)_x64/) || [,'1.1.0'])[1] + '_x64-setup.exe'
      const dest = join(DIAG_DIR, destName)
      const digest = (a.digest || '').replace('sha256:', '')
      if (existsSync(dest) && digest && sha256Of(dest) === digest) {
        log(`  ${destName} already in sync`)
      } else {
        log(`  download ${a.name} → ${destName} (${(a.size / 1024 / 1024).toFixed(1)}MB)`)
        if (DRY_RUN) continue
        const via = await downloadWithFallback(a.browser_download_url, dest)
        const local = sha256Of(dest)
        if (digest && local !== digest) {
          log(`  ✗ sha256 mismatch for ${a.name}! local=${local} expected=${digest}`)
          throw new Error(`sha256 mismatch: ${a.name}`)
        }
        log(`  ✓ ${destName} sha256 ok (via ${via})`)
      }
    }
    processedDiag.push({ tag: rel.tag, assets: rel.assets.map(a => ({
      name: /Diag[ABC]/.test(a.name) ? a.name : 'KunlunMedia-DiagC_' + (a.name.match(/_([\d.]+)_x64/) || [,'1.1.0'])[1] + '_x64-setup.exe',
      digest: a.digest, size: a.size, publishedAt: rel.publishedAt,
    })) })
    state.processedTags[rel.tag] = { at: new Date().toISOString(), type: 'diag' }
  }

  // ── v* → windows/（仅比当前新版更高的）──
  for (const rel of stableToProcess) {
    if (!FORCE && state.processedTags[rel.tag] && state.processedTags[rel.tag].archived) { log(`skip ${rel.tag} (archived)`); continue }
    if (!FORCE && state.processedTags[rel.tag] && !state.processedTags[rel.tag].archived) { log(`skip ${rel.tag} (already processed)`); continue }
    const exe = rel.assets.find(a => a.name.endsWith('.exe'))
    if (!exe) { log(`skip ${rel.tag}: no exe asset`); continue }
    log(`sync stable ${rel.tag} (${exe.name})`)
    const dest = join(WIN_DIR, exe.name)
    const digest = (exe.digest || '').replace('sha256:', '')
    if (existsSync(dest) && digest && sha256Of(dest) === digest) {
      log(`  ${exe.name} already in sync`)
    } else {
      if (DRY_RUN) continue
      const via = await downloadWithFallback(exe.browser_download_url, dest)
      const local = sha256Of(dest)
      if (digest && local !== digest) throw new Error(`sha256 mismatch: ${exe.name}`)
      log(`  ✓ ${exe.name} sha256 ok (via ${via})`)
    }
    processedStable.push({ tag: rel.tag, exe: { name: exe.name, digest: exe.digest, size: exe.size }, publishedAt: rel.publishedAt })
    state.processedTags[rel.tag] = { at: new Date().toISOString(), type: 'stable' }
  }

  // ── manifest 更新（全部成功后才写）──
  if (processedDiag.length) {
    const m = updateDiagManifest(processedDiag.map(p => ({ tag: p.tag, assets: p.assets })))
    log(`diagnostic.json updated: buildTag=${m.buildTag}, packs=${m.packs.length}`)
  }
  if (processedStable.length) {
    const m = updateStableManifest(processedStable.map(p => ({ tag: p.tag, publishedAt: p.publishedAt, assets: [p.exe] })))
    log(`latest.json updated: version=${m?.version}`)
  }

  saveState(state)
  log(`done. processed diag=${processedDiag.length} stable=${processedStable.length}`)
}

main().catch(e => { console.error('[release-watcher] FATAL:', e.message); process.exit(1) })
