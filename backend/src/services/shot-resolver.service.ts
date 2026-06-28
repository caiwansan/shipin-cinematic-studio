/**
 * D2-1 Shot Resolver — 镜头解析器
 *
 * 将 AssetGraph + ContinuityLink → ShotPlan
 * 为每个镜头绑定版本化资产，解析 prompt 链
 */

import { prisma } from '../utils/index.js'

export interface ShotPlan {
  shots: Shot[]
  promptChain: string[]
  keyframes: any[]
}

export interface Shot {
  shotIndex: number
  assetId: string
  versionId?: string
  content: any
  prompt?: any
  headFrame?: string
  tailFrame?: string
}

export class ShotResolver {
  /**
   * 从项目资产图生成镜头计划
   */
  async resolveShotPlan(projectId: string): Promise<ShotPlan> {
    // 获取所有关联资产（按 sortOrder 排序）
    const assets = await prisma.assetRegistry.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })

    const shots: Shot[] = []
    const promptChain: string[] = []
    const keyframes: any[] = []

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]

      // 获取最新版本
      const latestVersion = await prisma.assetVersion.findFirst({
        where: { assetRegistryId: asset.id },
        orderBy: { version: 'desc' },
      })

      const shot: Shot = {
        shotIndex: i + 1,
        assetId: asset.id,
        versionId: latestVersion?.id,
        content: latestVersion?.content || {},
        prompt: latestVersion?.prompt || {},
      }

      // 帧继承：前一个镜头尾帧 = 当前镜头头帧
      if (i > 0) {
        const prevShot = shots[i - 1]
        shot.headFrame = prevShot.tailFrame
        keyframes.push({
          shotIndex: i,
          type: 'headFrameInherited',
          assetId: shot.assetId,
          inheritedFrom: prevShot.assetId,
        })
      }

      // 提取 prompt 用于后续视频生成
      if (latestVersion?.prompt) {
        const promptContent = (latestVersion.prompt as any)?.task || ''
        if (promptContent) promptChain.push(promptContent)
      }

      shots.push(shot)
    }

    // 首尾帧自动连接（视频连续性）
    if (shots.length > 1) {
      shots[0].headFrame = shots[shots.length - 1].tailFrame
    }

    return { shots, promptChain, keyframes }
  }

  /**
   * 获取指定镜头的完整 prompt（含上下文）
   */
  async buildShotPrompt(shotIndex: number, projectId: string): Promise<string> {
    const plan = await this.resolveShotPlan(projectId)
    const shot = plan.shots[shotIndex - 1]
    if (!shot) throw new Error(`Shot #${shotIndex} not found`)

    // 获取前后镜头上下文
    const contextShots = []
    if (shotIndex > 1) contextShots.push(plan.shots[shotIndex - 2])
    if (shotIndex < plan.shots.length) contextShots.push(plan.shots[shotIndex])

    let prompt = `## 镜头 ${shot.shotIndex}/${plan.shots.length}\n\n`
    prompt += `内容: ${JSON.stringify(shot.content, null, 2)}\n`

    if (shot.prompt) {
      prompt += `\nPrompt 元数据: ${JSON.stringify(shot.prompt, null, 2)}\n`
    }

    if (contextShots.length > 0) {
      prompt += `\n上下文镜头:\n`
      for (const ctx of contextShots) {
        prompt += `  镜头 ${ctx.shotIndex}: ${JSON.stringify(ctx.content, null, 2).slice(0, 100)}...\n`
      }
    }

    prompt += `\n注意：保持 ${shotIndex > 1 ? '帧连续：尾帧无缝衔接上一镜头' : '场景开场帧清晰'}`
    return prompt
  }
}

export const shotResolver = new ShotResolver()
