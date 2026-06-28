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
