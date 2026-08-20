/**
 * routes/prompt-registry.ts — PromptRegistry 前端 API 路由
 *
 * 供前端 PromptRegistryClient 调用，统一 prompt 获取入口。
 * 禁止返回任何硬编码 prompt。
 *
 * @phase3-prompt-api
 */

import { FastifyInstance } from 'fastify'
import { getPrompt, getPromptEntry, getPromptBatch } from '../runtime/prompt/PromptRegistry.js'

export default async function promptRegistryRoutes(app: FastifyInstance) {
  // POST /api/ai/prompt-registry/get — 获取单条 prompt
  app.post('/api/ai/prompt-registry/get', async (request: any, reply: any) => {
    const { name, context } = request.body as any
    if (!name) {
      return reply.status(400).send({ success: false, error: '缺少 name 字段' })
    }
    try {
      const prompt = await getPrompt(name, context)
      return { success: true, prompt }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/ai/prompt-registry/batch — 批量获取
  app.post('/api/ai/prompt-registry/batch', async (request: any, reply: any) => {
    const { names, context } = request.body as any
    if (!names || !Array.isArray(names)) {
      return reply.status(400).send({ success: false, error: '缺少 names 字段' })
    }
    try {
      const prompts: Record<string, string> = {}
      for (const name of names) {
        try {
          prompts[name] = await getPrompt(name, context)
        } catch (e: any) {
          prompts[name] = ''
          console.warn(`[PromptRegistry-API] get("${name}") failed:`, e.message)
        }
      }
      return { success: true, prompts }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/ai/prompt-registry/entry — 获取结构化 entry
  app.post('/api/ai/prompt-registry/entry', async (request: any, reply: any) => {
    const { name, context } = request.body as any
    if (!name) {
      return reply.status(400).send({ success: false, error: '缺少 name 字段' })
    }
    try {
      const entry = await getPromptEntry(name, context)
      return { success: true, data: entry }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
