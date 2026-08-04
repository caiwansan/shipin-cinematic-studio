/**
 * routes/desktop-update.ts — Phase 4: 桌面端在线升级 API
 *
 * 提供桌面端版本检查、下载链接、版本发布管理。
 * 与 electron-updater 配合使用，支持：
 * - `latest.yml` 版本元数据文件（Windows）
 * - `latest-mac.yml`（macOS）
 * - `latest-linux.yml`（Linux）
 */

import { FastifyInstance } from 'fastify'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { createHash } from 'crypto'

// 官网下载源根目录（release-watcher 同步目标；与 backend 进程 cwd 无关）
const WEB_RELEASES_ROOT = process.env.KUNLUN_RELEASES_ROOT || '/www/wwwroot/aigc.fushtn.com/releases/desktop'

export default async function desktopUpdateRoutes(fastify: FastifyInstance) {

  // ── 发布产物存放目录（实际应配置到 COS/OSS） ──
  const RELEASES_DIR = resolve(process.cwd(), 'releases', 'desktop')

  // GET /api/desktop/update/check — 版本检查（electron-updater 调用）
  fastify.get('/api/desktop/update/check', async (request, reply) => {
    const { version, platform } = request.query as any
    if (!version) {
      return reply.status(400).send({ error: '缺少 version 参数' })
    }

    // 平台映射到 yml 文件名
    const platformMap: Record<string, string> = {
      win32: 'latest.yml',
      darwin: 'latest-mac.yml',
      linux: 'latest-linux.yml',
    }
    const ymlName = platformMap[platform as string] || 'latest.yml'
    const ymlPath = join(RELEASES_DIR, ymlName)

    if (!existsSync(ymlPath)) {
      return reply.send({ update: false })
    }

    try {
      const yml = readFileSync(ymlPath, 'utf-8')
      const lines = yml.split('\n')
      const latestVersion = lines.find(l => l.startsWith('version:'))
        ?.replace('version:', '')
        ?.trim()

      if (!latestVersion) {
        return reply.send({ update: false })
      }

      const current = version.split('.').map(Number)
      const latest = latestVersion.split('.').map(Number)
      const hasUpdate = latest[0] > current[0] ||
        (latest[0] === current[0] && latest[1] > current[1]) ||
        (latest[0] === current[0] && latest[1] === current[1] && latest[2] > current[2])

      // 生成下载 URL
      const baseUrl = 'https://aigc.fushtn.com/desktop'
      const pathMatch = lines.find(l => l.startsWith('path:'))
      const pathVal = pathMatch?.replace('path:', '')?.trim()

      reply.send({
        update: hasUpdate,
        version: latestVersion,
        url: pathVal ? `${baseUrl}/${pathVal}` : '',
        sha512: lines.find(l => l.startsWith('sha512:'))
          ?.replace('sha512:', '')
          ?.trim() || '',
        releaseDate: lines.find(l => l.startsWith('releaseDate:'))
          ?.replace('releaseDate:', '')
          ?.trim() || '',
      })
    } catch {
      return reply.send({ update: false })
    }
  })

  // GET /api/desktop/update/latest — 获取最新版本元数据
  fastify.get('/api/desktop/update/latest', async (request, reply) => {
    const { platform } = request.query as any
    const platformMap: Record<string, string> = {
      win32: 'latest.yml',
      darwin: 'latest-mac.yml',
      linux: 'latest-linux.yml',
    }
    const ymlName = platformMap[platform as string] || 'latest.yml'
    const ymlPath = join(RELEASES_DIR, ymlName)

    if (!existsSync(ymlPath)) {
      return reply.send({ success: false, error: '暂无版本信息' })
    }

    const yml = readFileSync(ymlPath, 'utf-8')
    return reply.send({ success: true, data: { yml, platform: platform as string } })
  })

  // GET /api/download/releases — 发布状态总览（桌面端自检 + 人工可观察）
  // Sprint A（掌柜 2026-08-04）：发布状态可观察，不靠人肉确认。
  // 返回各通道最新版本 + 状态 + 校验和；桌面端启动时也可调用此接口检查更新。
  fastify.get('/api/download/releases', async (_request, reply) => {
    const channels: Record<string, any> = {}

    // ── stable：latest.json ──
    const latestPath = join(WEB_RELEASES_ROOT, 'latest.json')
    if (existsSync(latestPath)) {
      try {
        const m = JSON.parse(readFileSync(latestPath, 'utf-8'))
        const filePath = join(WEB_RELEASES_ROOT, m.downloadUrl?.replace('/releases/desktop/', ''))
        let status = 'published'
        if (m.sha256 && existsSync(filePath)) {
          const actual = createHash('sha256').update(readFileSync(filePath)).digest('hex')
          if (actual !== m.sha256) status = 'checksum_mismatch'
        } else if (!existsSync(filePath)) {
          status = 'missing_artifact'
        }
        channels.stable = {
          channel: 'stable',
          version: m.version,
          status,
          checksum: m.sha256 || '',
          size: m.size || null,
          publishedAt: m.publishedAt || null,
          downloadUrl: m.downloadUrl || '',
          platform: m.platform || 'windows-x64',
        }
      } catch (e: any) {
        channels.stable = { channel: 'stable', status: 'manifest_error', error: e.message }
      }
    } else {
      channels.stable = { channel: 'stable', status: 'none' }
    }

    // ── diagnostic：diagnostics/diagnostic.json ──
    const diagPath = join(WEB_RELEASES_ROOT, 'diagnostics', 'diagnostic.json')
    if (existsSync(diagPath)) {
      try {
        const m = JSON.parse(readFileSync(diagPath, 'utf-8'))
        const packs = (m.packs || []).map((p: any) => {
          const filePath = join(WEB_RELEASES_ROOT, 'diagnostics', p.filename || '')
          const ok = existsSync(filePath)
          let status = ok ? 'published' : 'missing_artifact'
          if (ok && p.sha256) {
            const actual = createHash('sha256').update(readFileSync(filePath)).digest('hex')
            if (actual !== p.sha256) status = 'checksum_mismatch'
          }
          return { id: p.id, version: p.version, status, checksum: p.sha256 || '', size: p.size || null, downloadUrl: p.url || '' }
        })
        channels.diagnostic = {
          channel: 'diagnostic',
          version: (m.buildTag || '').replace(/^diag-/, '') || null,
          buildTag: m.buildTag || null,
          status: packs.every((p: any) => p.status === 'published') ? 'published' : 'partial',
          updatedAt: m.updatedAt || null,
          packs,
        }
      } catch (e: any) {
        channels.diagnostic = { channel: 'diagnostic', status: 'manifest_error', error: e.message }
      }
    } else {
      channels.diagnostic = { channel: 'diagnostic', status: 'none' }
    }

    return reply.send({ success: true, data: { updatedAt: new Date().toISOString(), channels } })
  })

  // GET /desktop/latest.yml — electron-updater 直接下载版本元数据（静态文件兼容）
  fastify.get('/desktop/latest.yml', async (_request, reply) => {
    const ymlPath = join(RELEASES_DIR, 'latest.yml')
    if (!existsSync(ymlPath)) {
      return reply.code(404).send({ error: 'not found' })
    }
    reply.type('text/yaml').send(readFileSync(ymlPath, 'utf-8'))
  })

  fastify.get('/desktop/latest-mac.yml', async (_request, reply) => {
    const ymlPath = join(RELEASES_DIR, 'latest-mac.yml')
    if (!existsSync(ymlPath)) {
      return reply.code(404).send({ error: 'not found' })
    }
    reply.type('text/yaml').send(readFileSync(ymlPath, 'utf-8'))
  })

  fastify.get('/desktop/latest-linux.yml', async (_request, reply) => {
    const ymlPath = join(RELEASES_DIR, 'latest-linux.yml')
    if (!existsSync(ymlPath)) {
      return reply.code(404).send({ error: 'not found' })
    }
    reply.type('text/yaml').send(readFileSync(ymlPath, 'utf-8'))
  })

  // GET /desktop/* — 下载安装包（静态文件代理）
  fastify.get('/desktop/:filename', async (request, reply) => {
    const { filename } = request.params as any
    if (!filename || filename.includes('..')) {
      return reply.code(400).send({ error: 'invalid filename' })
    }
    const filePath = join(RELEASES_DIR, filename)
    if (!existsSync(filePath)) {
      return reply.code(404).send({ error: 'not found' })
    }
    return reply.sendFile(filePath)
  })
}
