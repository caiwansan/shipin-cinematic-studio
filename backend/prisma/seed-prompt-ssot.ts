/**
 * seed-prompt-ssot.ts — Prompt SSOT 收敛种子（Phase 4 / Sprint-ShortDrama-Reality-Recovery-01）
 *
 * 执行：npx tsx prisma/seed-prompt-ssot.ts
 *
 * 目的：补全运行时依赖但 DB 缺失的 PromptTemplate key，以及迁移历史硬编码 prompt。
 * 全部 upsert（幂等，可重复执行）。
 *
 * 覆盖：
 * 1. aigc-prompt            ← src/routes/aigc-prompt.txt（历史 txt 迁移）
 * 2. plot-supervisor        ← src/prompts/agents/plot-supervisor.txt（历史 txt 迁移）
 * 3. scene-image-prompt-agent ← director-v2 场景图优化依赖（缺失 key 补全）
 * 4. image-prompt-optimizer ← ai-optimize-image-prompt.ts 硬编码迁移（广告工作台生产链）
 * 5. storyboard-shot-generator ← storyboards.ts 硬编码迁移
 * 6. narrative-analyzer     ← narrative-llm.ts NARRATIVE_SYSTEM_PROMPT 硬编码迁移
 * 7. character-visual-prompt ← narrative-llm.ts regen-spec 角色硬编码迁移
 * 8. scene-visual-prompt    ← narrative-llm.ts regen-spec 场景硬编码迁移
 *
 * 原则：只增不改。已有 key 不覆盖（update: {}），避免破坏线上内容。
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'node:fs'
import * as path from 'node:path'

const prisma = new PrismaClient()

const ROOT = path.resolve(__dirname, '..')

function readTxt(rel: string): string {
  // 绝对路径直接读；相对路径基于仓库根
  const full = rel.startsWith('/') ? rel : path.join(ROOT, rel)
  return fs.readFileSync(full, 'utf8').trim()
}

interface PromptSeed {
  name: string
  description: string
  category: string
  content: Record<string, any>
}

const PROMPTS: PromptSeed[] = [
  // ─── 1. aigc-prompt：从历史 txt 迁移（deep-analyze / studio-create-work 依赖） ───
  {
    name: 'aigc-prompt',
    description: 'AIGC 影视短剧制作规划师（历史 txt 迁移，SSOT Phase 4）',
    category: 'narrative',
    content: { prompt: readTxt('src/routes/aigc-prompt.txt') },
  },

  // ─── 2. plot-supervisor：从历史 txt 迁移（director-v2 依赖，英文 key） ───
  {
    name: 'plot-supervisor',
    description: '剧情总指挥（director-v2 兼容 key，内容与历史 txt 一致）',
    category: 'orchestrator',
    content: { prompt: readTxt('src/prompts/agents/plot-supervisor.txt') },
  },

  // ─── 3. scene-image-prompt-agent：director-v2 场景图优化依赖（缺失 key 补全） ───
  {
    name: 'scene-image-prompt-agent',
    description: '场景图 AI 提示词优化 Agent（director-v2 依赖，SSOT Phase 4 补全）',
    category: 'scene',
    content: {
      prompt: `你是一位专业的 AI 场景图提示词设计师。根据每个场景的需求表单，生成优化的英文文生图提示词。

【输出格式 — 严格 JSON 数组】
只输出 JSON 数组，不要任何额外文字，不要 markdown 代码块包裹。
数组顺序必须与输入需求表单顺序一致。每个元素：
{
  "scenePrompt": "英文场景图提示词（80-200 词，包含：环境、光线、色调、氛围、构图、材质细节）",
  "negativePrompt": "负面提示词（默认：people, character, person, figure, silhouette, text, watermark, signature）"
}

【规则】
1. 场景图中禁止出现任何人、动物、角色。
2. 必须保留需求表单中的环境类型、时间、天气、情绪基调。
3. 提示词用英文输出，包含画质标签（cinematic, high detail, 8k）。`,
    },
  },

  // ─── 4. image-prompt-optimizer：广告工作台硬编码迁移 ───
  {
    name: 'image-prompt-optimizer',
    description: 'AI 图像生成提示词优化（原 ai-optimize-image-prompt.ts 硬编码迁移）',
    category: 'image',
    content: {
      prompt: '你是一位专业的 AI 图像生成提示词工程师。将用户输入的原始描述，优化为结构化的中文图生图提示词。要求：1. 清晰描述主体、背景、光影、色调、构图  2. 每个元素用逗号分隔  3. 保留广告视觉风格  4. 输出简洁有效，不超过 200 字  5. **所有输出必须用中文**，不要使用英文描述',
    },
  },

  // ─── 5. storyboard-shot-generator：storyboards.ts 硬编码迁移（占位符 {charInfo}） ───
  {
    name: 'storyboard-shot-generator',
    description: '影视分镜师（原 storyboards.ts 硬编码迁移，{charInfo} 为角色信息占位符）',
    category: 'storyboard',
    content: {
      prompt: `你是一个专业的影视分镜师。根据用户的场景描述，生成 3~6 个分镜头。

每个分镜必须包含以下字段：
- shotIndex: 序号（从0开始）
- sceneDescription: 该镜头的场景描述（中文，50字以内）
- cameraAngle: 镜头角度（全景/中景/近景/特写/俯拍/仰拍/过肩镜头）
- movement: 运镜方式（固定镜头/缓慢推进/缓慢拉远/平移/跟拍/摇镜头/推轨）
- lens: 焦段（35mm/50mm/85mm/24-70mm/16-35mm/70-200mm）
- duration: 时长秒数（3-8）
- prompt: 该镜头的英文 prompt（用于 AI 绘画/视频生成，包含主体、场景、光线、氛围等详细描述，30-80词）

{charInfo}
请以 JSON 数组格式返回，不要其他文字。`,
    },
  },

  // ─── 6. narrative-analyzer：narrative-llm.ts NARRATIVE_SYSTEM_PROMPT 迁移 ───
  {
    name: 'narrative-analyzer',
    description: '电影叙事分析师（原 narrative-llm.ts NARRATIVE_SYSTEM_PROMPT 硬编码迁移）',
    category: 'narrative',
    content: { prompt: readTxt('/tmp/narrative-analyzer.txt') },
  },

  // ─── 7. character-visual-prompt：narrative-llm.ts regen-spec 角色硬编码迁移 ───
  {
    name: 'character-visual-prompt',
    description: '角色视觉设计师（原 narrative-llm.ts regen-spec 硬编码迁移）',
    category: 'character',
    content: { prompt: readTxt('/tmp/character-visual-prompt.txt') },
  },

  // ─── 8. scene-visual-prompt：narrative-llm.ts regen-spec 场景硬编码迁移 ───
  {
    name: 'scene-visual-prompt',
    description: '场景设计师（原 narrative-llm.ts regen-spec 硬编码迁移）',
    category: 'scene',
    content: { prompt: readTxt('/tmp/scene-visual-prompt.txt') },
  },
]

async function main() {
  for (const p of PROMPTS) {
    const existing = await prisma.promptTemplate.findUnique({ where: { name: p.name } })
    if (existing) {
      console.log(`⏭️  已存在（跳过）: ${p.name}`)
      continue
    }
    await prisma.promptTemplate.create({
      data: {
        name: p.name,
        description: p.description,
        category: p.category,
        content: p.content,
        variables: {},
      },
    })
    console.log(`✅ 创建: ${p.name} (${String(p.content.prompt || '').length} chars)`)
  }
  console.log('\nSeed 完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
