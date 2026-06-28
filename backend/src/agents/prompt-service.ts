import { prisma } from '../utils/index.js'

export interface PromptBuildOptions {
  agentName: string     // PromptTemplate.name
  contentKey?: string   // 从 content 字段读哪个 key（默认 'prompt'）
}

export interface PromptBuildResult {
  prompt: string
  outputSchema?: string
  sources: string[]
}

export async function buildPrompt(opts: PromptBuildOptions): Promise<PromptBuildResult> {
  const sources: string[] = []

  // 1. 从 PromptTemplate 表读取
  const template = await prisma.promptTemplate.findUnique({
    where: { name: opts.agentName },
  })

  if (!template?.content || typeof template.content !== 'object') {
    throw new Error(`PromptTemplate.${opts.agentName} 不存在或内容为空`)
  }

  const content = template.content as Record<string, any>
  const key = opts.contentKey || 'prompt'
  const prompt = content[key] as string
  const outputSchema = content.output_schema as string | undefined

  if (!prompt) {
    throw new Error(`PromptTemplate.${opts.agentName}.${key} 为空`)
  }

  sources.push(opts.agentName)

  return { prompt, outputSchema, sources }
}

// 可选：简单 TTL 缓存（避免频繁查 DB）
const promptCache = new Map<string, { result: PromptBuildResult; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟

export async function buildPromptCached(opts: PromptBuildOptions): Promise<PromptBuildResult> {
  const key = `${opts.agentName}:${opts.contentKey || 'prompt'}`
  const cached = promptCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result
  }
  const result = await buildPrompt(opts)
  promptCache.set(key, { result, timestamp: Date.now() })
  return result
}
