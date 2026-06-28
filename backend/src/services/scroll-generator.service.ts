/**
 * scroll-generator.service.ts — 动作套路卷轴生成器
 *
 * ⚠️ 宪法层：所有套路模板数据来源于 DB（action_templates 表）
 * 启动时自动从 JSON 文件同步到 DB，运行期只从 DB 读取
 *
 * 功能：
 * 1. 从 DB 加载套路定义
 * 2. 根据文本检测匹配最佳套路模板
 * 3. 返回卷轴 prompt 和模板完整数据
 */

import fs from 'fs'
import path from 'path'
import { prisma } from '../utils/index.js'

export interface ActionChar {
  id: string
  headMark: string
  action: string
  position: string
  expression: string
}

export interface ActionRound {
  roundNumber: number
  label: string
  description: string
  chars: ActionChar[]
  camera: string
  effects: string[]
  physics: string
  duration: number
}

export interface CameraDef {
  id: string
  label: string
  x: number
  y: number
  movement: string
}

export interface ActionTemplate {
  id: string
  name: string
  category: string
  school?: string
  description: string
  totalRounds: number
  matchKeywords: string[]
  rounds: ActionRound[]
  cameraLayout: {
    cameras: CameraDef[]
  }
  scrollImageUrl?: string | null
}

// ─── 启动时：从 JSON 目录同步到 DB ───
export async function syncJsonTemplatesToDB(): Promise<number> {
  const templatesDir = path.join(__dirname, '..', 'data', 'action-templates')
  if (!fs.existsSync(templatesDir)) {
    console.warn('[scroll-generator] ⚠️ action-templates 目录不存在，跳过同步')
    return 0
  }

  const cats = ['fight', 'chase', 'performance', 'war']
  let count = 0

  for (const cat of cats) {
    const dir = path.join(templatesDir, cat)
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
        const tpl = JSON.parse(raw) as ActionTemplate
        await prisma.actionTemplate.upsert({
          where: { id: tpl.id },
          update: {
            name: tpl.name,
            category: tpl.category,
            school: tpl.school || null,
            description: tpl.description,
            totalRounds: tpl.totalRounds,
            matchKeywords: tpl.matchKeywords as any,
            templateData: tpl as any,
            isActive: true,
          },
          create: {
            id: tpl.id,
            name: tpl.name,
            category: tpl.category,
            school: tpl.school || null,
            description: tpl.description,
            totalRounds: tpl.totalRounds,
            matchKeywords: tpl.matchKeywords as any,
            templateData: tpl as any,
            isActive: true,
          },
        })
        count++
      } catch (e) {
        console.warn(`[scroll-generator] ⚠️ 同步模板失败: ${cat}/${file}`, (e as Error).message)
      }
    }
  }

  console.log(`[scroll-generator] ✅ ${count} 个套路模板已同步到 DB`)
  return count
}

// ─── 从 DB 加载所有激活模板 ───
export async function getTemplatesFromDB(): Promise<ActionTemplate[]> {
  const rows = await prisma.actionTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { totalRounds: 'asc' }],
  })

  return rows.map(row => {
    const td = row.templateData as any
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      school: row.school || undefined,
      description: row.description,
      totalRounds: row.totalRounds,
      matchKeywords: (row.matchKeywords as string[]) || [],
      rounds: td.rounds || [],
      cameraLayout: td.cameraLayout || { cameras: [] },
      scrollImageUrl: row.scrollImageUrl,
    }
  })
}

// ─── 文本匹配最佳模板 ───
export async function matchBestTemplateFromDB(
  text: string,
  category?: string
): Promise<ActionTemplate | null> {
  const templates = await getTemplatesFromDB()
  let candidates = templates
  if (category) {
    candidates = templates.filter(t => t.category === category)
  }

  let bestScore = 0
  let best: ActionTemplate | null = null

  for (const tpl of candidates) {
    let score = 0
    for (const kw of tpl.matchKeywords) {
      if (text.includes(kw)) score += 1
    }
    for (const rd of tpl.rounds) {
      const rdKws = rd.label + rd.description
      for (const kw of tpl.matchKeywords) {
        if (rdKws.includes(kw)) score += 0.5
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = tpl
    }
  }

  if (best && bestScore >= 2) return best
  return null
}

// ─── 构造卷轴图生成用的 Prompt ───
export function buildScrollPrompt(template: ActionTemplate, charNameA?: string, charNameB?: string): string {
  const charALabel = charNameA || '角色A'
  const charBLabel = charNameB || '角色B'

  let prompt = `生成一张水平长条火柴人示意卷轴图，纯黑线条极简风格，背景纯白。
卷轴水平排列${template.totalRounds}格，从左到右依次展示动作套路「${template.name}」的每个回合。

角色标记规则：
- ${charALabel}用○形头部标记（大圆点）
- ${charBLabel}用△形头部标记（三角形）
- 如有多余角色，C用□形头部标记

每格内容包括：
`

  for (const rd of template.rounds) {
    prompt += `\n【第${rd.roundNumber}回合：${rd.label}】${rd.description}\n`
    for (const ch of rd.chars) {
      const charName = ch.id === 'A' ? charALabel : (ch.id === 'B' ? charBLabel : `角色${ch.id}`)
      prompt += `  - ${charName}（头部${ch.headMark}）: ${ch.action}，站位${ch.position}，表情${ch.expression}\n`
    }
    prompt += `  机位: ${rd.camera}\n`
  }

  prompt += `
底部单独一栏（用虚线框分隔）：摄像机机位俯视图
- 用▲符号表示摄像机位置，标注C1/C2/C3
- 摄像机坐标和运动方式：
`
  for (const cam of template.cameraLayout.cameras) {
    prompt += `  ▲${cam.id}(${cam.label}) 坐标(${cam.x},${cam.y}) 移动:${cam.movement}\n`
  }

  prompt += `
整体要求：
1. 纯黑线条+白色背景，极简风格
2. 每格顶部标注 R1/R2/R3 等序号
3. 角色之间的动作关系用虚线箭头表示移动方向
4. 摄像机位置标注清晰
5. 整体卷轴宽高比约4:1，宽度约1024像素
6. 不要添加任何非必要文字（只需要序号和摄像机编号）
`
  return prompt
}

// ─── 生成卷轴图（返回 prompt 文本，供上层调用图片模型） ───
export function buildScrollPromptFromTemplate(
  template: ActionTemplate,
  charNameA?: string,
  charNameB?: string
): string {
  return buildScrollPrompt(template, charNameA, charNameB)
}

// ─── 通用卷轴 prompt：从原始视频描述 + 对话 + 特效 直接生成 ───
export function buildGenericScrollPrompt(
  narrative: string,
  dialogue?: string,
  effects?: string,
  firstFrameDesc?: string,
  lastFrameDesc?: string,
  optimizedShots?: Array<{ second: string | number; camera: string; action: string; expression: string; fx: string }>,
): string {
  // 如果有 optimizedShots（逐秒拍摄脚本），用它作为每格的内容
  // 否则用原始 narrative 分段
  const segments: { time: string; desc: string }[] = []

  if (optimizedShots && optimizedShots.length > 0) {
    // 按 second 排序
    const sorted = [...optimizedShots].sort((a, b) => {
      const as = typeof a.second === 'string' ? parseInt(a.second.split('-')[0]) : (a.second ?? 0)
      const bs = typeof b.second === 'string' ? parseInt(b.second.split('-')[0]) : (b.second ?? 0)
      return as - bs
    })
    // 合并为每格描述
    let currentGroup: string[] = []
    let currentTime = ''
    for (const shot of sorted) {
      const secStr = String(shot.second ?? '')
      const parts: string[] = []
      if (shot.camera) parts.push(`机位:${shot.camera}`)
      if (shot.action) parts.push(`动作:${shot.action}`)
      if (shot.expression) parts.push(`表情:${shot.expression}`)
      if (shot.fx) parts.push(`特效:${shot.fx}`)
      const line = `[${secStr}秒] ` + parts.join('，')
      currentGroup.push(line)
      if (!currentTime) currentTime = secStr
    }
    // 分组合并为段（每 2-3 个组分一组）
    const groupSize = Math.max(1, Math.ceil(sorted.length / 4))
    for (let i = 0; i < currentGroup.length; i += groupSize) {
      const group = currentGroup.slice(i, i + groupSize)
      const firstSec = group[0]?.match(/\[([\d.-]+)秒\]/)
      const lastSec = group[group.length - 1]?.match(/\[([\d.-]+)秒\]/)
      const timeRange = firstSec && lastSec ? `${firstSec[1]}s-${lastSec[1]}s` : `${i * 3 + 1}s-${(i + groupSize) * 3}s`
      segments.push({ time: timeRange, desc: group.join('\n') })
    }
  } else {
    // Fallback：用原始 narrative 分段
    const charsPerSeg = 80
    const rawText = [narrative, dialogue].filter(Boolean).join('\n')
    const segCount = Math.min(Math.max(3, Math.ceil(rawText.length / charsPerSeg)), 10)
    let remaining = rawText
    let startTime = 0
    for (let i = 0; i < segCount; i++) {
      if (!remaining.trim() && i > 0) break
      let segText = ''
      if (i < segCount - 1) {
        const dotIdx = remaining.indexOf('。')
        if (dotIdx > 0 && dotIdx <= charsPerSeg + 20) {
          segText = remaining.substring(0, dotIdx + 1)
          remaining = remaining.substring(dotIdx + 1).trim()
        } else {
          segText = remaining.substring(0, charsPerSeg)
          remaining = remaining.substring(charsPerSeg).trim()
        }
      } else {
        segText = remaining
      }
      if (segText.trim()) {
        const endTime = startTime + Math.max(2, Math.ceil(segText.length / 20))
        segments.push({ time: `T${startTime}s-T${endTime}s`, desc: segText.trim() })
        startTime = endTime
      }
    }
  }

  let prompt = `生成一张水平长条火柴人示意卷轴图，纯黑线条极简风格，背景纯白。
卷轴水平排列 ${segments.length} 格，从左到右逐格展示这段视频的完整时间线。

角色标记规则：
- 主要角色用 ○ 形头部
- 次要角色用 △ 形头部
- 如有多余角色用 □ 形头部

每格内容包括：角色站位、动作方向、摄像机机位、特效位置、时间节点。
`

  for (let i = 0; i < segments.length; i++) {
    prompt += `\n【第${i + 1}格 ${segments[i].time}】\n`
    prompt += `  剧情：${segments[i].desc}\n`
  }

  if (effects) {
    prompt += `\n特效标注（用 ★ 在对应时间位置标记）：${effects}\n`
  }
  if (firstFrameDesc) {
    prompt += `\n开场画面参考（第0秒）：${firstFrameDesc}\n`
  }
  if (lastFrameDesc) {
    prompt += `\n结束画面参考：${lastFrameDesc}\n`
  }

  prompt += `
整体要求：
1. 纯黑线条 + 纯白背景，极简手绘风格，无需上色
2. 每格顶部标注时间轴节点
3. 角色之间的动作关系用虚线和箭头表示移动方向
4. 摄像机位置用 ▲ 标注（含推拉摇移方向 →←↑↓）
5. 特效位置用 ★ 标注
6. 画布宽高比 21:9，宽画幅
7. 不要添加任何非必要中文文字（只需时间轴数字和摄像机编号）
8. 每格之间用垂直虚线分隔，整体像一卷展开的导演分镜草稿
`
  return prompt
}

// ═══════════════════════════════════════════════════════════
// 卷轴图生成：调用户图片模型 → COS 上传
// ═══════════════════════════════════════════════════════════

export async function _callImageModel(
  userId: string,
  scrollPrompt: string
): Promise<string | null> {
  try {
    const { apiRouter } = await import('./api-router.service.js')
    const provider = await apiRouter.selectProvider(userId, 'image', true)
    if (!provider) {
      console.warn(`[scroll-generator] ❌ selectProvider('image') returned null for user ${userId}`)
      return null
    }
    console.log(`[scroll-generator] ✅ selectProvider success: provider=${provider.provider}, modelName=${provider.modelName}, baseUrl=${provider.baseUrl}`)

    const { prisma: _prisma } = await import('../utils/index.js')
    const v2 = await _prisma.userModelConfigV2.findUnique({ where: { userId } })
    if (!v2) {
      console.warn(`[scroll-generator] ❌ UserModelConfigV2 not found for user ${userId}`)
      return null
    }
    console.log(`[scroll-generator] ✅ v2 found: imageEnabled=${v2.imageEnabled}, imageProvider=${v2.imageProvider}, imageModel=${v2.imageModel}, hasImageKey=${!!v2.imageApiKey}`)

    const { decryptKey } = await import('./crypto.service.js')
    const apiKey = v2.imageApiKey ? decryptKey(v2.imageApiKey) : ''
    if (!apiKey) {
      console.warn(`[scroll-generator] ❌ imageApiKey is empty after decryption`)
      return null
    }

    const baseUrl = v2.imageBaseUrl || v2.baseUrl || provider.baseUrl || ''
    const modelName = provider.modelName || v2.imageModel || 'wanx2.1-t2i-turbo'

    console.log(`[scroll-generator] 🚀 calling modelAdapterRegistry.execute: model=${modelName}, ratio=4:1, prompt length=${scrollPrompt.length}`)

    const runtimePayload = {
      provider: provider.provider,
      model: modelName,
      userId,
      apiKey,
      baseURL: baseUrl,
      metadata: { baseUrlMap: {} },
    } as any

    const { modelAdapterRegistry } = await import('../model-adapters/index.js')
    const imageResult = await modelAdapterRegistry.execute(runtimePayload as any, runtimePayload.model, {
      model: modelName,
      prompt: scrollPrompt,
      ratio: '4:1',
      n: 1,
      apiKey,
      baseUrl,
      perCapabilityBaseUrl: {},
    })

    console.log(`[scroll-generator] ✅ modelAdapterRegistry.execute completed, result type: ${typeof imageResult}`)

    let imageUrl = ''
    if (imageResult && typeof imageResult === 'object') {
      const ir = imageResult as any
      if (ir.images?.[0]?.url) {
        imageUrl = ir.images[0].url
        console.log(`[scroll-generator] result has images[0].url: ${imageUrl.substring(0, 60)}`)
      } else if (ir.url) {
        imageUrl = ir.url
        console.log(`[scroll-generator] result has url: ${imageUrl.substring(0, 60)}`)
      } else {
        console.warn(`[scroll-generator] ⚠️ 图片模型返回无可用URL fields: ${JSON.stringify(Object.keys(ir))}`)
      }
    } else {
      console.warn(`[scroll-generator] ⚠️ 图片模型返回非对象: ${JSON.stringify(imageResult)}`)
    }

    if (!imageUrl) {
      console.warn('[scroll-generator] ⚠️ 图片模型返回无 URL，返回 null')
      return null
    }

    // 上传到 COS
    console.log(`[scroll-generator] 📤 uploading to COS: ${imageUrl.substring(0, 60)}`)
    const { cosService } = await import('./cos-service.js')
    const cosResult = await cosService.uploadFile(imageUrl, 'image', userId)
    console.log(`[scroll-generator] ✅ COS upload success: ${cosResult.cosUrl}`)
    return cosResult.cosUrl

  } catch (err: any) {
    console.error(`[scroll-generator] ❌ 卷轴图生成失败: ${err.message}`)
    console.error(`[scroll-generator] stack: ${err.stack?.substring(0, 300)}`)
    return null
  }
}

/** 根据套路模板生成卷轴图 */
export async function generateScrollImage(
  template: ActionTemplate,
  userId: string,
  charNameA?: string,
  charNameB?: string
): Promise<string | null> {
  const scrollPrompt = buildScrollPrompt(template, charNameA, charNameB)
  const cosUrl = await _callImageModel(userId, scrollPrompt)
  if (cosUrl) {
    await prisma.actionTemplate.update({
      where: { id: template.id },
      data: { scrollImageUrl: cosUrl },
    })
    console.log(`[scroll-generator] ✅ 套路卷轴图已生成: ${template.name} → ${cosUrl.substring(0,60)}`)
  }
  return cosUrl
}

/** 从任意视频描述生成通用卷轴图（不依赖套路模板） —— @deprecated 请直接用 generate-scroll 路由，不再经过此函数 */
export async function generateGenericScrollImage(
  userId: string,
  narrative: string,
  optimizedShots: any[],
  firstFrameDesc?: string,
  lastFrameDesc?: string,
  effects?: string,
): Promise<string | null> {
  console.warn('[scroll-generator] ⚠️ generateGenericScrollImage 已废弃，请通过 /api/ai/generate-scroll 路由走队列')
  const scrollPrompt = buildGenericScrollPrompt(narrative, '', effects, firstFrameDesc, lastFrameDesc, optimizedShots)
  const cosUrl = await _callImageModel(userId, scrollPrompt)
  return cosUrl
}

// 保留向下兼容的同步函数
/** @deprecated 使用 matchBestTemplateFromDB */
export function matchBestTemplate(text: string, category?: string): ActionTemplate | null {
  throw new Error('[scroll-generator] 请使用异步 matchBestTemplateFromDB，代替同步 matchBestTemplate')
}

/** @deprecated 使用 getTemplatesFromDB */
export function getTemplates(): ActionTemplate[] {
  throw new Error('[scroll-generator] 请使用异步 getTemplatesFromDB，代替同步 getTemplates')
}
