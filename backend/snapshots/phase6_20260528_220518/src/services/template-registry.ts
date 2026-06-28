/**
 * G2 Template Registry — 模板系统
 *
 * 预置模板：用户无需理解 AI 细节，选择模板 → 填剧本 → 出视频
 * 模板驱动 C1/C2 + D1/D2 流水线
 */

export interface TemplateSchema {
  id: string
  name: string
  description: string
  category: 'short_video' | 'storytelling' | 'cinematic' | 'explainer'
  defaultAgents: {
    orchestrator?: boolean
    characterAgent?: boolean
    sceneAgent?: boolean
    storyboardAgent?: boolean
    optimizationAgent?: boolean
  }
  promptTemplate: string
  outputStyle: string
  estimatedDuration: string // e.g. "30s", "60s"
  requiredFields: string[]  // e.g. ["script", "characters"]
  minPlan: string           // free | pro | studio | enterprise
}

const builtinTemplates: TemplateSchema[] = [
  {
    id: 'quick_story',
    name: '快速故事',
    description: '输入剧本，AI 自动生成分镜 + 角色 + 场景 + 视频',
    category: 'short_video',
    defaultAgents: { orchestrator: true, characterAgent: true, sceneAgent: true, storyboardAgent: true },
    promptTemplate: `根据以下剧本，生成一个{{duration}}秒的短视频：
剧本：{{script}}
角色：{{characters}}
风格：{{style}}`,
    outputStyle: 'cinematic',
    estimatedDuration: '30s',
    requiredFields: ['script'],
    minPlan: 'free',
  },
  {
    id: 'character_film',
    name: '角色短片',
    description: '聚焦角色塑造的叙事性短片，适合剧情类内容',
    category: 'storytelling',
    defaultAgents: { orchestrator: true, characterAgent: true, sceneAgent: true, storyboardAgent: true, optimizationAgent: true },
    promptTemplate: `生成一个角色驱动的叙事短片：
剧本：{{script}}
角色设定：{{characters}}
场景描述：{{scenes}}
风格：{{style}}`,
    outputStyle: 'narrative',
    estimatedDuration: '60s',
    requiredFields: ['script', 'characters'],
    minPlan: 'pro',
  },
  {
    id: 'cinematic_scene',
    name: '电影级场景',
    description: '高品质电影级画面生成，适合宣传片和开头场景',
    category: 'cinematic',
    defaultAgents: { orchestrator: true, sceneAgent: true, storyboardAgent: true, optimizationAgent: true },
    promptTemplate: `生成电影级场景视频：
场景描述：{{scenes}}
氛围：{{atmosphere}}
镜头风格：{{camera_style}}`,
    outputStyle: 'cinematic',
    estimatedDuration: '15s',
    requiredFields: ['scenes'],
    minPlan: 'studio',
  },
  {
    id: 'product_demo',
    name: '产品演示',
    description: '快速生成产品展示视频，适合电商和营销',
    category: 'explainer',
    defaultAgents: { orchestrator: true, storyboardAgent: true },
    promptTemplate: `生成产品演示视频：
产品名称：{{product}}
核心卖点：{{features}}
使用场景：{{usage_scene}}`,
    outputStyle: 'clean',
    estimatedDuration: '20s',
    requiredFields: ['product', 'features'],
    minPlan: 'free',
  },
]

export class TemplateRegistry {
  private templates = new Map<string, TemplateSchema>()

  constructor() {
    for (const t of builtinTemplates) {
      this.templates.set(t.id, t)
    }
  }

  list(): TemplateSchema[] {
    return Array.from(this.templates.values())
  }

  get(id: string): TemplateSchema | undefined {
    return this.templates.get(id)
  }

  register(template: TemplateSchema): void {
    this.templates.set(template.id, template)
  }

  /**
   * 用模板填充生成请求
   */
  fillPrompt(templateId: string, fields: Record<string, string>): string {
    const tmpl = this.get(templateId)
    if (!tmpl) throw new Error(`模板 ${templateId} 不存在`)

    let prompt = tmpl.promptTemplate
    for (const [key, value] of Object.entries(fields)) {
      prompt = prompt.replace(`{{${key}}}`, value)
    }
    return prompt
  }
}

export const templateRegistry = new TemplateRegistry()
