/**
 * Legal System Config Routes — 系统配置管理
 * 支持 Embedding API Key / BaseURL 等后台配置
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import * as fs from 'fs'
import * as path from 'path'

const EMBED_ENV_KEYS = ['LEGAL_EMBEDDING_API_KEY', 'LEGAL_EMBEDDING_BASE_URL', 'LEGAL_EMBEDDING_PROVIDER', 'LEGAL_EMBEDDING_MODEL']
const LLM_ENV_KEYS = ['LEGAL_LLM_API_KEY', 'LEGAL_LLM_BASE_URL', 'LEGAL_LLM_MODEL']
const ALLOWED_KEYS = new Set([
  'defaultModel', 'defaultPrompt', 'uploadLimit', 'ocrEnabled', 'maxFileSize', 'analysisParams',
  ...EMBED_ENV_KEYS,
  ...LLM_ENV_KEYS,
])

export default async function legalConfigRoutes(app: FastifyInstance) {
  // GET /api/admin/legal/config — 获取系统配置（合并所有配置行）
  app.get('/api/admin/legal/config', { preHandler: [app.authenticate] }, async () => {
    const rows = await prisma.legalSystemConfig.findMany()
    const config: Record<string, any> = {}
    for (const row of rows) {
      if (row.configValue !== null && row.configValue !== undefined) {
        // 对 API Key 脱敏返回
        if ((row.configKey === 'LEGAL_EMBEDDING_API_KEY' || row.configKey === 'LEGAL_LLM_API_KEY') && typeof row.configValue === 'string') {
          config[row.configKey] = maskApiKey(row.configValue as string)
        } else {
          config[row.configKey] = row.configValue
        }
      }
    }
    return { success: true, data: config }
  })

  // PUT /api/admin/legal/config — 保存系统配置
  app.put('/api/admin/legal/config', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as Record<string, any>
    const envUpdates: Record<string, string> = {}

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) continue

      // 过滤脱敏值（用户可能把脱敏后的 sk-xxx...xxx 又发回来了）
      if ((key === 'LEGAL_EMBEDDING_API_KEY' || key === 'LEGAL_LLM_API_KEY') && typeof value === 'string') {
        if (value.includes('***')) continue // 脱敏值，跳过
      }

      // configValue 为 String? 类型，非字符串值转为字符串
      const strValue = value === null || value === undefined ? null : String(value)

      await prisma.legalSystemConfig.upsert({
        where: { configKey: key },
        update: { configValue: strValue },
        create: { configKey: key, configValue: strValue },
      })

      // 如果是 Embedding 或 LLM 相关的 key，存入 process.env + 记录到 envUpdates
      if (EMBED_ENV_KEYS.includes(key) || LLM_ENV_KEYS.includes(key)) {
        if (strValue && !strValue.includes('***')) {
          process.env[key] = strValue
          envUpdates[key] = strValue
        }
      }
    }

    // 如果有 embedding key 更新，追加写入 .env（保证重启后不丢失）
    if (Object.keys(envUpdates).length > 0) {
      appendToEnvFile(envUpdates)
    }

    return { success: true, data: { message: '配置已保存' } }
  })
}

/** API Key 脱敏：sk-abc...xyz */
function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key
  const prefix = key.startsWith('sk-') ? 'sk-' : ''
  const body = prefix ? key.slice(3) : key
  const masked = body.slice(0, 3) + '***' + body.slice(-3)
  return prefix + masked
}

/** 追加/更新 .env 中的指定变量 */
function appendToEnvFile(updates: Record<string, string>) {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) {
      const lines = Object.entries(updates).map(([k, v]) => `${k}=${v}`)
      fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8')
      return
    }

    let content = fs.readFileSync(envPath, 'utf-8')
    const lines = content.split('\n')

    for (const [key, value] of Object.entries(updates)) {
      const idx = lines.findIndex(l => l.startsWith(`${key}=`))
      if (idx >= 0) {
        // 只更新未注释的
        if (!lines[idx].trim().startsWith('#')) {
          lines[idx] = `${key}=${value}`
        } else {
          // 注释状态，在末尾追加
          lines.push(`${key}=${value}`)
        }
      } else {
        lines.push(`${key}=${value}`)
      }
    }

    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8')
  } catch (err: any) {
    console.error(`[Config] 写入 .env 失败: ${err.message}`)
  }
}
