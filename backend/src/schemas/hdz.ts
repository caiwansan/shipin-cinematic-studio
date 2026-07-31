/**
 * HDZ 混沌珠 — Zod 输入校验模式
 *
 * 统一输入校验层，防止：
 * - 超大章节正文导致 DB/Token 膨胀
 * - 恶意 JSON / Prompt 注入
 * - 异常字段类型导致 500 错误
 *
 * 限制值参考：
 * - title <= 200     (标题)
 * - summary <= 5000  (摘要)
 * - content <= 500000 chars  (单章正文，约 25 万汉字)
 * - wordTarget <= 500000     (目标总字数)
 * - chapterWordTarget <= 50000  (单章目标字数)
 */

import { z } from 'zod'

// ─── 项目 ───

export const hdzCreateProjectSchema = z.object({
  title: z.string().min(1, '请输入小说标题').max(200, '标题不能超过 200 字').transform(s => s.trim()),
  genre: z.string().max(50, '小说类型不能超过 50 字').optional().nullable(),
  wordTarget: z.number().int('目标字数必须为整数').min(0).max(10000000, '目标字数不能超过 10,000,000').optional().nullable(),
  chapterWordTarget: z.number().int('单章目标字数必须为整数').min(0).max(50000, '单章目标字数不能超过 50,000').optional().nullable(),
  styleDesc: z.string().max(5000, '风格描述不能超过 5000 字').optional().nullable(),
})

export const hdzUpdateProjectSchema = z.object({
  title: z.string().max(200, '标题不能超过 200 字').transform(s => s.trim()).optional(),
  genre: z.string().max(50).optional().nullable(),
  wordTarget: z.number().int().min(0).max(500000).optional().nullable(),
  chapterWordTarget: z.number().int().min(0).max(50000).optional().nullable(),
  styleDesc: z.string().max(5000).optional().nullable(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
  authorNickname: z.string().max(100).optional().nullable(),
  coverPrompt: z.string().max(2000).optional().nullable(),
  coverImgUrl: z.string().max(500).optional().nullable(),
  masterStyle: z.string().max(50).optional().nullable(),
})

// ─── 章节 ───

const HdzChapterStatus = z.enum(['outline', 'draft', 'reviewed', 'final', 'needs_rewrite'])

export const hdzUpdateChapterSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500000, '单章正文不能超过 500,000 字').optional(),
  outline: z.string().max(10000).optional(),
  status: HdzChapterStatus.optional(),
  reviewNotes: z.array(z.object({
    issue: z.string().max(500).optional(),
    severity: z.enum(['critical', 'major', 'minor']).optional(),
    suggestion: z.string().max(1000).optional(),
  })).max(50).optional(),
})

// ─── 角色 ───

const HdzRole = z.enum(['protagonist', 'antagonist', 'supporting', 'minor'])

export const hdzCreateCharacterSchema = z.object({
  name: z.string().min(1, '请输入角色名称').max(100, '角色名不能超过 100 字').transform(s => s.trim()),
  role: HdzRole.default('supporting'),
  properties: z.record(z.any()).optional().default({}),
  relations: z.array(z.object({
    target: z.string().max(100),
    type: z.string().max(50),
    description: z.string().max(500).optional(),
  })).max(100).optional().default([]),
  arc: z.string().max(2000).optional().nullable(),
  // 扩充字段（合并到 properties）
  faction: z.string().max(100).optional(),
  appearance: z.string().max(2000).optional(),
  personality: z.string().max(2000).optional(),
  backstory: z.string().max(5000).optional(),
  skills: z.string().max(2000).optional(),
  growthArc: z.string().max(2000).optional(),
})

export const hdzUpdateCharacterSchema = hdzCreateCharacterSchema.partial()

// ─── 帮助函数 ───

import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * 通用校验中间件
 * 用法：在 route handler 内调用 validate(body, schema)
 */
export function validate<T>(data: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.errors[0]
    throw new ValidationError(firstError?.message || '输入校验失败')
  }
  return result.data
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * 带 HTTP 响应的校验（在 route handler 中使用）
 */
export function validateOrReject(data: unknown, schema: z.ZodSchema<any>, reply: FastifyReply): any {
  const result = schema.safeParse(data)
  if (!result.success) {
    reply.status(400).send({ success: false, error: result.error.errors[0]?.message || '输入校验失败' })
    return null
  }
  return result.data
}
