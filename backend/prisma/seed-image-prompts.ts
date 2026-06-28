/**
 * prisma/seed-image-prompts.ts — 图片提示词模板种子数据
 *
 * 执行方式：npx tsx prisma/seed-image-prompts.ts
 * 首次部署时执行，或需要重置初始模板时执行
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_DATA = [
  {
    type: 'portrait',
    templateKey: 'negative_prompt',
    title: '默认负面提示词',
    content:
      'ugly, deformed, blurry, low quality, extra limbs, bad anatomy, watermark, text, ' +
      'multiple views, disfigured, poorly drawn, mutation, bad proportions, extra fingers',
    sortOrder: 1,
    enabled: true,
    description: '默认负向 prompt，当角色图生成时作为 negative prompt 使用',
  },
  {
    type: 'portrait',
    templateKey: 'qc_prompt',
    title: '质量审核模板',
    content: `你是一位角色肖像提示词质量管理员。

你将收到【角色肖像优化需求表单】，请检查生成的提示词是否满足以下标准的 AIGC 提示词格式要求：

【标准格式要求】
- 角色名 + 外貌描述（年龄、发色、面部特征、服装、体型）
- 姿态: full body portrait, standing front view
- 表情描述（eg. calm expression, neutral expression）
- 背景: white background, character design sheet style
- 画质标签: high detail face, cinematic lighting, 8k, sharp focus

如果缺少上述要素，请重写提示词。
如果已包含全部要素，输出原始提示词不变。

输出必须是英文纯文本提示词，不要额外解释。`,
    sortOrder: 2,
    enabled: true,
    description:
      'LLM 质量审核的 system prompt，当 compose prompt 质量不达标时调用 LLM 精炼',
  },
  {
    type: 'portrait',
    templateKey: 'prompt_structure',
    title: 'Prompt 合成模板',
    content:
      'Portrait of {{name}}, {{appearance}}, full body portrait, standing front view, white background, character design sheet style, high detail face, cinematic lighting, 8k, sharp focus',
    sortOrder: 3,
    enabled: true,
    description:
      '提示词组装结构模板，{{name}} 替换为角色名，{{appearance}} 替换为外貌特征描述，{{quality_tags}} 替换为画质标签',
  },
  {
    type: 'portrait',
    templateKey: 'quality_rules',
    title: '质量检查规则',
    content: JSON.stringify({
      age: { regex: '\\d+\\s*(?:year|岁)', label: '年龄' },
      body: { regex: 'full body|全身', label: '全身' },
      front: { regex: 'front view|正面', label: '正面' },
      background: { regex: 'white background|plain background|solid background', label: '背景' },
      quality: { regex: '8k|high detail|sharp focus|cinematic', label: '画质' },
      english: { regex: '^[A-Za-z]', label: '英文' },
    }),
    sortOrder: 4,
    enabled: true,
    description: '质量门禁检查规则，JSON 格式包含各检查项的 regex 和 label',
  },
  {
    type: 'portrait',
    templateKey: 'composition_rules',
    title: '合成规则',
    content: JSON.stringify({
      minFeatures: 3,
      featureTypes: [
        'demographic',
        'hair',
        'eyes',
        'ethnicity',
        'build',
        'clothing',
        'notable',
        'expression',
      ],
      qualityTags: [
        'high detail face',
        'cinematic lighting',
        '8k',
        'sharp focus',
      ],
    }),
    sortOrder: 5,
    enabled: true,
    description: 'Prompt 合成规则，包括最小特征数阈值和允许的特征类型',
  },
]

async function main() {
  console.log('🌱 Seeding image_prompt_templates...')

  for (const item of SEED_DATA) {
    const existing = await prisma.imagePromptTemplates.findUnique({
      where: { type_templateKey: { type: item.type, templateKey: item.templateKey } },
    })

    if (existing) {
      await prisma.imagePromptTemplates.update({
        where: { id: existing.id },
        data: item,
      })
      console.log(`  ✅ Updated: ${item.type}/${item.templateKey}`)
    } else {
      await prisma.imagePromptTemplates.create({ data: item })
      console.log(`  ✅ Created: ${item.type}/${item.templateKey}`)
    }
  }

  console.log('✅ Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
