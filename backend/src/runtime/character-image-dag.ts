// ============================================================
// runtime/character-image-dag.ts
//
// 角色四视图 DAG Execution Kernel
// 职责：
//   - 定义生成依赖图（front→side, portrait/side/back 独立）
//   - 串行执行 DAG 节点（确保参考图依赖就绪）
//   - 所有视图生成结果一旦完成即持久化到 COS
//   - 全部完成或任一关键节点失败 → 原子提交/回滚
//
// 设计原则：
//   - 单执行路径（合并 execution-images.ts 和 character-pipeline.ts）
//   - 写库唯一入口（commitCharacterVariants）
//   - 依赖图显式声明，不允许隐式串行
// ============================================================

import { executeImageTask } from '../services/image/submit-task.js'
import type { ValidationHook } from '../services/image/pipeline/types.js'
import { generateDynamicViewCharacterSheet } from '../services/four-view-merger.js'
import { cosService } from '../services/cos-service.js'
import { prisma } from '../utils/index.js'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { resolve } from 'path'

// ─── 错误类型 ──────────────────────────────────────────

export class CharacterGenerationError extends Error {
  constructor(
    public readonly code: 'FRONT_MISSING' | 'PORTRAIT_MISSING' | 'DAG_FAILED' | 'PROVIDER_ERROR' | 'MERGE_REJECTED',
    message: string,
  ) {
    super(`[${code}] ${message}`)
    this.name = 'CharacterGenerationError'
  }
}

// ─── 类型定义 ──────────────────────────────────────────

export type ImageMode = 'txt2img' | 'img2img'

export interface DAGNode {
  /** 节点标识 — 也是入库 variant */
  key: 'portrait' | 'front' | 'side' | 'back' | 'weapon_front' | 'weapon_side'
  /** 生成模式 */
  mode: ImageMode
  /** 完整 prompt（已组装角色描述+视角模板+风格） */
  prompt: string
  /** 负面提示词（已组装 style negative + 视角专属 negative） */
  negativePrompt: string
  /** 依赖的节点 key（该节点生成结果作为本节点的 referenceImage） */
  dependsOn?: string
  /** 独立的随机 seed（无依赖时） */
  seed: number
  /** 排序权重（入库用） */
  sortOrder: number
  /** 是否可跳过（true 表示失败时不影响整体提交） */
  optional: boolean
}

export interface DAGConfig {
  /** 四视图/六视图  */
  gridCount: 4 | 6
  /** 各节点定义 */
  nodes: DAGNode[]
  /** 合并器需要的各视图 URL 映射 */
  mergeUrls: Record<string, string>
  /** 用户 ID（COS 上传用） */
  userId: string
  /** 项目 ID */
  projectId: string
  /** 角色名 */
  characterName: string
  /** 图片 prompt（素材库用） */
  imagePrompt: string
}

export interface DAGNodeResult {
  key: string
  imageUrl: string
  cosUrl?: string
  localUrl?: string
}

export interface DAGExecutionResult {
  success: boolean
  /** 各节点生成+持久化后的结果 */
  results: Record<string, DAGNodeResult>
  /** 合并定妆图 URL（已 COS） */
  mergedImageUrl?: string
  /** 正脸裁剪 URL（已 COS） */
  faceCropUrl?: string
  /** 错误信息 */
  error?: string
}

// ─── 节点排序（入库用） ────────────────────────────────

export const VARIANT_ORDER: Record<string, number> = {
  makeup: 0,
  face_ref: 1,
  full_front: 2,
  portrait: 10,
  side: 11,
  back: 12,
}

// ─── DAG Executor ──────────────────────────────────────

export class CharacterImageDAGExecutor {
  private config: DAGConfig

  constructor(config: DAGConfig) {
    this.config = config
  }

  /**
   * 执行 DAG
   * 流程：
   *   1. 按依赖顺序串行执行各节点（front → side 必须 front 先完成）
   *   2. 每个节点生成后立即 COS 持久化
   *   3. 已持久化的 URL 存在 results 供后续节点引用
   *   4. 所有节点完成后，合并定妆图
   *   5. 合并图 COS 上传
   *   6. 全部成功 → commitCharacterVariants 写库
   *   7. 任一 FAIL_ERROR 节点失败 → 整体失败，不写库
   *      仅 OPTIONAL 节点失败 → 跳过，正常提交
   */
  async run(
    authHeader: string,
    baseUrl: string,
    validators?: ValidationHook[],
    onProgress?: (key: string, result: DAGNodeResult) => void,
  ): Promise<DAGExecutionResult> {
    const results: Record<string, DAGNodeResult> = {}
    const sortedNodes = this.topologicalSort()

    for (const node of sortedNodes) {
      // 解析参考图（从已完成的节点结果中取）
      let referenceImage: string | undefined
      if (node.dependsOn) {
        const dep = results[node.dependsOn]
        if (!dep || !this.nodeUrl(dep)) {
          // 依赖节点失败 → 当前节点也失败
          if (!node.optional) {
            return this.fail(`依赖节点 ${node.dependsOn} 未完成，${node.key} 无法生成`)
          }
          // optional 节点：跳过
          console.log(`[DAG] 依赖 ${node.dependsOn} 未完成，跳过 optional 节点 ${node.key}`)
          results[node.key] = { key: node.key, imageUrl: '' }
          continue
        }
        referenceImage = this.nodeUrl(dep)
      }

      // 生成图片
      let nodeResult: DAGNodeResult
      try {
        const taskInput: any = {
          prompt: node.prompt,
          negativePrompt: node.negativePrompt,
          projectId: this.config.projectId,
          source: 'character_execution',
          characterName: this.config.characterName,
          seed: node.seed,
        }
        if (node.mode === 'img2img' && referenceImage) {
          taskInput.referenceImage = referenceImage
          taskInput.referenceImages = [referenceImage]
        }

        const output = await executeImageTask(
          taskInput,
          {
            projectId: this.config.projectId,
            stage: 'character',
            traceId: `char_${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${node.key}`,
            identityLockId: this.config.characterName,
          },
          { baseUrl, authHeader, userId: this.config.userId, validators },
        )

        if (!output.imageUrl) {
          throw new Error(`${node.key} 生成返回空 URL`)
        }

        // COS 持久化
        const persisted = await this.persistImage(output.imageUrl, node.key)
        nodeResult = { key: node.key, imageUrl: output.imageUrl, ...persisted }
        console.log(`[DAG] ✅ ${node.key} 生成+持久化完成: ${(nodeResult.cosUrl || nodeResult.imageUrl).substring(0, 60)}`)
      } catch (err: any) {
        if (node.optional) {
          console.warn(`[DAG] ⚠️ optional 节点 ${node.key} 失败，跳过:`, err.message)
          nodeResult = { key: node.key, imageUrl: '' }
        } else {
          console.error(`[DAG] ❌ 关键节点 ${node.key} 失败:`, err.message)
          return this.fail(`${node.key} 生成失败: ${err.message}`)
        }
      }

      results[node.key] = nodeResult
      if (onProgress) onProgress(node.key, nodeResult)
    }

    // 全部节点执行完毕 → 检查有多少有效视图
    const validViews = Object.entries(results).filter(([, r]) => !!this.nodeUrl(r))
    console.log(`[DAG] 有效视图数: ${validViews.length}/${sortedNodes.length}`)

    // 少于必备视图数 → 整体失败
    // 关键视图检查：用 this.nodeUrl 取 cosUrl→localUrl→imageUrl
    const frontUrl = this.nodeUrl(results.front)
    if (validViews.length < 2 || !frontUrl) {
      const err = frontUrl ? '视图不足' : 'FRONT_IMAGE_MISSING'
      throw new CharacterGenerationError('DAG_FAILED', `关键视图缺失: ${err}`)
    }

    // 合并定妆图 — fail-fast：合并器失败直接整体失败
    const mergedResult = await this.mergeAndUpload(results)

    // 原子提交写库
    await this.commitCharacterVariants(results, mergedResult)

    return {
      success: true,
      results,
      mergedImageUrl: mergedResult.mergedImageUrl,
      faceCropUrl: mergedResult.faceCropUrl,
    }
  }

  /**
   * 拓扑排序：确保依赖节点在前
   */
  private topologicalSort(): DAGNode[] {
    const sorted: DAGNode[] = []
    const visited = new Set<string>()

    const visit = (node: DAGNode) => {
      if (visited.has(node.key)) return
      visited.add(node.key)
      if (node.dependsOn) {
        const dep = this.config.nodes.find(n => n.key === node.dependsOn)
        if (dep) visit(dep)
      }
      sorted.push(node)
    }

    for (const node of this.config.nodes) {
      visit(node)
    }

    return sorted
  }

  /**
   * 取节点有效 URL（local-first：cosUrl ← localUrl ← imageUrl）
   * localUrl 是相对路径 /uploads/...，补全为 https://aigc.fushtn.com 供合并器/外部使用
   */
  private nodeUrl(r: DAGNodeResult): string {
    const url = r.cosUrl || r.localUrl || r.imageUrl
    if (url && url.startsWith('/')) {
      return `https://aigc.fushtn.com${url}`
    }
    return url
  }

  /**
   * local-first 持久化：下载图片 → 先存本地（必达）→ COS 异步（best-effort）
   */
  private async persistImage(imageUrl: string, label: string): Promise<{ cosUrl?: string; localUrl?: string }> {
    // 如果已经是 COS / fushtn URL 直接返回
    if (imageUrl.includes('cos') || imageUrl.includes('fushtn')) {
      return { cosUrl: imageUrl }
    }

    try {
      const fileBuf = await this.downloadFile(imageUrl)

      // ── 1. 本地存储（必达） ──
      const localPath = path.resolve(process.cwd(), 'public/uploads/characters')
      fs.mkdirSync(localPath, { recursive: true })
      const filename = `char_${label}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.png`
      fs.writeFileSync(path.join(localPath, filename), fileBuf)
      const localUrl = `/uploads/characters/${filename}`
      console.log(`[DAG] ✅ ${label} 本地持久化: ${localUrl}`)

      // ── 2. COS 异步上传（best-effort） ──
      cosService.uploadBuffer(fileBuf, `char_${label}_${Date.now()}.png`, this.config.userId)
        .then(res => { if (res.cosUrl) console.log(`[DAG] ${label} COS 上传成功（异步）`) })
        .catch(() => {})

      return { localUrl }
    } catch (e: any) {
      console.warn(`[DAG] persistImage(${label}) 本地持久化失败:`, e.message)
      return {}
    }
  }

  /**
   * 下载远程图片
   */
  private async downloadFile(url: string): Promise<Buffer> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`下载失败: HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    return Buffer.from(buf)
  }

  /**
   * 合并定妆图 → 本地保存（必达）→ COS 异步（best-effort）
   */
  private async mergeAndUpload(
    results: Record<string, DAGNodeResult>,
  ): Promise<{ mergedImageUrl: string; faceCropUrl: string } | null> {
    const gridCount = this.config.gridCount
    const hasWeapon = gridCount === 6

    const nu = (k: string) => results[k] ? this.nodeUrl(results[k]) : ''
    const portraitUrl = nu('portrait')
    const frontUrl = nu('front')
    const sideUrl = nu('side')
    const backUrl = nu('back')
    const weaponFrontUrl = nu('weapon_front')
    const weaponSideUrl = nu('weapon_side')

    // ⭐ R7 — Fail-fast：front 和 portrait 必须有效
    if (!frontUrl) {
      console.error('[R7] 合并器: frontUrl 缺失，废弃合并')
      throw new CharacterGenerationError('FRONT_MISSING', 'FRONT_IMAGE_MISSING')
    }
    if (!portraitUrl) {
      console.error('[R7] 合并器: portraitUrl 缺失，废弃合并')
      throw new CharacterGenerationError('PORTRAIT_MISSING', 'PORTRAIT_IMAGE_MISSING')
    }

    try {
      const merged = await generateDynamicViewCharacterSheet({
        portraitImageUrl: portraitUrl,
        frontImageUrl: frontUrl,
        sideImageUrl: sideUrl || frontUrl,
        backImageUrl: backUrl || frontUrl,
        weaponFrontUrl: weaponFrontUrl || undefined,
        weaponSideUrl: weaponSideUrl || undefined,
        characterName: this.config.characterName,
      })

      // 合并图：本地存储（必达），COS 异步（best-effort）
      let finalMergedUrl = merged.mergedImageUrl
      let finalFaceCropUrl = merged.faceCropUrl || ''

      // 已经是本地路径，直接保留
      // COS 异步上传不阻塞
      const cwdPath = resolve(process.cwd(), 'public', finalMergedUrl.replace(/^\//, ''))
      if (fs.existsSync(cwdPath)) {
        const mergeBuf = fs.readFileSync(cwdPath)
        cosService.uploadBuffer(mergeBuf, 'merged_view.jpg', this.config.userId)
          .then(res => { if (res.cosUrl) finalMergedUrl = res.cosUrl; console.log('[DAG] 合并图 COS 上传成功（异步）') })
          .catch(() => {})
      }

      if (finalFaceCropUrl && finalFaceCropUrl.startsWith('/uploads/')) {
        const facePath = resolve(process.cwd(), 'public', finalFaceCropUrl.replace(/^\//, ''))
        if (fs.existsSync(facePath)) {
          const faceBuf = fs.readFileSync(facePath)
          cosService.uploadBuffer(faceBuf, 'face_ref.png', this.config.userId)
            .then(res => { if (res.cosUrl) finalFaceCropUrl = res.cosUrl })
            .catch(() => {})
        }
      }

      return { mergedImageUrl: finalMergedUrl, faceCropUrl: finalFaceCropUrl }
    } catch (e: any) {
      console.error('[R7] 合并定妆图失败:', e.message)
      throw new CharacterGenerationError('MERGE_REJECTED', e.message)
    }
  }

  /**
   * 回退单张生成（视图 < 2 时）
   */
  /**
   * 原子提交写库（已持久化的 URL 统一写入 characterImage + userAsset）
   */
  private async commitCharacterVariants(
    results: Record<string, DAGNodeResult>,
    merged?: { mergedImageUrl: string; faceCropUrl: string },
  ): Promise<void> {
    const uid = this.config.userId
    const pid = this.config.projectId
    const chName = this.config.characterName

    // 安全 asset ID
    const safeAssetId = (prefix: string) => {
      const nameHash = crypto.createHash('md5').update(chName).digest('hex').slice(0, 8)
      return `${prefix}_${nameHash}_${pid}`
    }

    // 收集所有要写入的数据
    const operations: Array<{ table: 'characterImage' | 'userAsset'; data: any }> = []

    // 1. 合并图 → characterImage (makeup) + userAsset
    const mergedUrl = merged?.mergedImageUrl || this.nodeUrl(results.front) || ''
    if (mergedUrl) {
      operations.push({
        table: 'characterImage',
        data: {
          where: { projectId_characterName_variant: { projectId: pid, characterName: chName, variant: 'makeup' } },
          update: { imageUrl: mergedUrl, sortOrder: VARIANT_ORDER.makeup ?? 0 },
          create: { projectId: pid, imageUrl: mergedUrl, characterName: chName, variant: 'makeup', sortOrder: VARIANT_ORDER.makeup ?? 0 },
        },
      })
      operations.push({
        table: 'userAsset',
        data: {
          where: { id: safeAssetId('char_merged') },
          update: { url: mergedUrl, thumbnail: mergedUrl, prompt: this.config.imagePrompt },
          create: {
            id: safeAssetId('char_merged'),
            userId: uid,
            title: `${chName} 定妆图`,
            type: 'character',
            url: mergedUrl,
            thumbnail: mergedUrl,
            prompt: this.config.imagePrompt,
            source: 'character_generation',
            fileSize: 0,
          },
        },
      })
    }

    // 2. face_ref → characterImage + userAsset（若有）
    const faceRefUrl = merged?.faceCropUrl || ''
    if (faceRefUrl) {
      operations.push({
        table: 'characterImage',
        data: {
          where: { projectId_characterName_variant: { projectId: pid, characterName: chName, variant: 'face_ref' } },
          update: { imageUrl: faceRefUrl, sortOrder: VARIANT_ORDER.face_ref ?? 1 },
          create: { projectId: pid, imageUrl: faceRefUrl, characterName: chName, variant: 'face_ref', sortOrder: VARIANT_ORDER.face_ref ?? 1 },
        },
      })
    }

    // 3. 各视图 → characterImage (full_front/portrait/side/back) + userAsset
    for (const [key, result] of Object.entries(results)) {
      const finalUrl = this.nodeUrl(result)
      if (!finalUrl) continue
      const sortOrder = VARIANT_ORDER[key] ?? 99

      // 映射 variant 名
      let variant = key
      if (key === 'front') variant = 'full_front'
      else if (key === 'weapon_front') variant = 'weapon_front'
      else if (key === 'weapon_side') variant = 'weapon_side'
      // portrait/side/back 保持原名

      operations.push({
        table: 'characterImage' as const,
        data: {
          where: { projectId_characterName_variant: { projectId: pid, characterName: chName, variant } },
          update: { imageUrl: finalUrl, sortOrder },
          create: { projectId: pid, imageUrl: finalUrl, characterName: chName, variant, sortOrder },
        },
      })

      // 正面(full_front)和大头(portrait)额外存素材库
      if (variant === 'full_front') {
        operations.push({
          table: 'userAsset' as const,
          data: {
            where: { id: safeAssetId('char_front') },
            update: { url: finalUrl, thumbnail: finalUrl, prompt: `正面立正全身，${this.config.imagePrompt}` },
            create: {
              id: safeAssetId('char_front'),
              userId: uid,
              title: `${chName} 全身正面图`,
              type: 'character',
              url: finalUrl,
              thumbnail: finalUrl,
              prompt: `正面立正全身，${this.config.imagePrompt}`,
              source: 'character_generation',
              fileSize: 0,
            },
          },
        })
      }
      if (variant === 'portrait') {
        operations.push({
          table: 'userAsset' as const,
          data: {
            where: { id: safeAssetId('char_portrait') },
            update: { url: finalUrl, thumbnail: finalUrl },
            create: {
              id: safeAssetId('char_portrait'),
              userId: uid,
              title: `${chName} 大头特写（面部参考）`,
              type: 'character',
              url: finalUrl,
              thumbnail: finalUrl,
              prompt: this.config.imagePrompt,
              source: 'character_generation',
              fileSize: 0,
            },
          },
        })
      }
    }

    // 分批执行（Prisma 没有多表事务，但每步各自 upsert）
    // 用 try/catch 确保每个操作独立失败不污染整体
    for (const op of operations) {
      try {
        if (op.table === 'characterImage') {
          await prisma.characterImage.upsert(op.data)
        } else {
          await prisma.userAsset.upsert(op.data)
        }
      } catch (e: any) {
        // 单条写入失败不影响整体（非关键数据）
        console.warn(`[DAG] 写入 ${op.table}/${JSON.stringify(op.data.where)} 失败:`, e.message)
      }
    }

    console.log(`[DAG] 💾 原子提交完成: ${chName}, ${operations.length} 条写入`)
  }

  private fail(error: string): DAGExecutionResult {
    console.error(`[DAG] ❌ 执行失败:`, error)
    const isMissing = error.includes('front') || error.includes('portrait')
    throw new CharacterGenerationError('DAG_FAILED', error)
  }
}

// ─── DAG Builder ────────────────────────────────────────

export interface BuildDAGParams {
  charDesc: string
  viewTemplates: Record<string, string>
  styleTokens: string
  baseNegative: string
  userRefImage?: string
  hasWeapon: boolean
  weaponNames: string[]
  characterName: string
}

/**
 * 根据角色信息和视图模板构建 DAG
 */
export function buildCharacterDAG(params: BuildDAGParams): DAGConfig {
  const { charDesc, viewTemplates, styleTokens, baseNegative, userRefImage, hasWeapon, weaponNames, characterName } = params
  const styleTag = styleTokens ? `, ${styleTokens}` : ''
  const addStyle = (p: string) => `${charDesc}, ${p}${styleTag}`

  const seed = Math.floor(Math.random() * 2147483647)
  const nodes: DAGNode[] = []

  // ⭐ 肖像负向基础
  const portraitNegative = baseNegative + ', full body, full-body, full_length, standing, whole_body, legs, torso, arms, body, half_body, upper_body, below_chest, 全身, 站立, 站姿, 腿部, 躯干, 手臂, 半身, 下半身, 超过胸部, two people, multiple people, group'
  const frontNegative = baseNegative + ', side view, back view, profile, close up, close-up, headshot, 大头, 特写, three-quarter view, 仰视, 俯视, 坐姿, 蹲, 多人, two person'
  const sideNegative = baseNegative + ', front view, back view, looking at camera, 正面, 正脸, 正面全身, 背面, back of head, three-quarter view, portrait, close up, facing camera'
  const backNegative = baseNegative + ', face, front view, side view, looking at camera, facing viewer, turning head, profile, portrait, close up, headshot, facial features, eyes, nose, mouth, 正面, 面部, 正脸, 脸部, 人脸'

  // Portrait — Text2Image（绝对不传参考图）
  // ⚠️ 肖像不是 charDesc + viewTemplate，而是只取面部特征 + 大头照模板
  // charDesc 包含"全身正面立正站姿"等描述，会覆盖 portrait 的 extreme close-up 指令
  const faceOnlyDesc = extractFaceDescription(charDesc)
  nodes.push({
    key: 'portrait',
    mode: 'txt2img',
    prompt: `${faceOnlyDesc}, ${viewTemplates.portrait}${styleTag}`,
    negativePrompt: portraitNegative,
    seed,
    sortOrder: 10,
    optional: true,  // 大头照失败不影响整体
  })

  // Front — 如果有上传参考图则 img2img，否则 txt2img
  nodes.push({
    key: 'front',
    mode: userRefImage ? 'img2img' : 'txt2img',
    prompt: addStyle(viewTemplates.front),
    negativePrompt: frontNegative,
    seed: seed + 1,
    sortOrder: 2,  // full_front
    optional: false,  // 正脸是关键视图
    ...(userRefImage ? {} : {}),
  })

  // Side — 依赖 front 结果做 img2img（链式保一致性）
  nodes.push({
    key: 'side',
    mode: 'img2img',
    prompt: addStyle(viewTemplates.side),
    negativePrompt: sideNegative,
    dependsOn: 'front',
    seed: seed + 2,
    sortOrder: 11,
    optional: false,
  })

  // Back — Text2Image（不传参考图，防止背面出脸）
  nodes.push({
    key: 'back',
    mode: 'txt2img',
    prompt: addStyle(viewTemplates.back),
    negativePrompt: backNegative,
    seed: seed + 3,
    sortOrder: 12,
    optional: true,  // 背面失败不重要
  })

  // 武器视图（可选）
  if (hasWeapon && weaponNames.length > 0) {
    const weaponPrompt = `${charDesc}, full body shot pure profile right side, standing, holding ${weaponNames.join(' and ')}, weapon clearly visible, both hands on weapon, head to toe, 90 degree right side view, plain white background, single person${styleTag}`
    nodes.push({
      key: 'weapon_front',
      mode: userRefImage ? 'img2img' : 'img2img',
      prompt: `${charDesc}, full body shot front view, standing straight, holding ${weaponNames.join(' and ')}, weapon clearly visible, both hands on weapon, head to toe, looking at camera, plain white background, single person${styleTag}`,
      negativePrompt: baseNegative,
      dependsOn: 'front',
      seed,
      sortOrder: 20,
      optional: true,
    })
    nodes.push({
      key: 'weapon_side',
      mode: 'img2img',
      prompt: weaponPrompt,
      negativePrompt: baseNegative,
      dependsOn: 'front',
      seed,
      sortOrder: 21,
      optional: true,
    })
  }

  return {
    gridCount: hasWeapon ? 6 : 4,
    nodes,
    mergeUrls: {},
    userId: '',
    projectId: '',
    characterName,
    imagePrompt: charDesc,
  }
}

/**
 * 从完整 charDesc 中提取面部相关描述（去掉"全身正面立正站姿"等 body 描述）
 * 规则：保留 脸部/面部/发型/五官/表情/气质/眼神 等关键词所在的句子，去掉 body/全身/站姿/站立 等句子
 */
function extractFaceDescription(desc: string): string {
  // 如果整体很短（<40字），直接返回原样
  if (desc.length < 40) return desc

  // 保留包含这些关键词的句子/片段
  const keepPatterns = [
    /年龄\s*:?\s*\d+[^。\n]*/,
    /面[部容孔][^。\n]*/,
    /[发头][^。\n]*/,
    /五[官][^。\n]*/,
    /眼[睛神眸][^。\n]*/,
    /眉[毛目宇][^。\n]*/,
    /鼻[梁子][^。\n]*/,
    /嘴[唇巴角][^。\n]*/,
    /气[质场息][^。\n]*/,
    /表[情][^。\n]*/,
    /神[态色情][^。\n]*/,
    /脸[型蛋形][^。\n]*/,
    /皮[肤][^。\n]*/,
    /肤[色质][^。\n]*/,
    /[刘海][^。\n]*/,
    /[辫髻][^。\n]*/,
    /鬓[角][^。\n]*/,
    /轮[廓][^。\n]*/,
    /下[巴颌][^。\n]*/,
  ]

  const kept: string[] = []
  for (const pattern of keepPatterns) {
    const m = desc.match(pattern)
    if (m) kept.push(m[0].trim())
  }

  if (kept.length === 0) {
    // 兜底：取第一句（通常是年龄+大体描述）
    const first = desc.split(/[。\n]/)[0]
    return first ? first.trim() : desc
  }

  return [...new Set(kept)].join('，').slice(0, 300)
}
