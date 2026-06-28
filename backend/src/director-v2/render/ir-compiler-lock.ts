/**
 * ir-compiler-lock.ts — Phase 6D.1: IR Compiler Lock
 *
 * 把 render adapter 的 raw IR 编译为 immutable locked IR：
 *   raw IR → version injection → hash computation → Object.freeze → locked IR
 *
 * 锁的契约：
 *   1. hash 基于 sceneChain + shotChain + frameInstructions + constraints + temporalAnchors
 *   2. metadata / version / sessionId 不参与 hash（允许注入运行时信息）
 *   3. Object.freeze() 深冻结防止运行时突变
 *   4. validateIR() 在每次使用前验证完整性
 */

import crypto from 'node:crypto'
import type {
  CinematicRenderIR,
  RenderScene,
  RenderShot,
  FrameInstruction,
  IRConstraints,
  TemporalAnchors,
} from './render-ir.js'

import {
  type DirectorStatus,
  type ScenePreview,
  type ShotPlan,
  type IntentTimeline,
} from '../runtime/director-projection.js'

import { renderAdapter } from './render-adapter.js'

// ============================================================
// IR Compiler Lock
// ============================================================

export class IRCompilerLock {
  private compileCount: number = 0

  /**
   * 编译 locked CinematicRenderIR
   * 输入：projection 层的安全数据（与 renderAdapter.compile 相同签名）
   * 输出：版本化 + 哈希锁定 + 不可变的 IR
   */
  compile(
    status: DirectorStatus,
    scenes: ScenePreview[],
    timeline: IntentTimeline,
    shotsByScene: Record<string, ShotPlan[]>,
    sessionId: string = 'unknown',
  ): CinematicRenderIR {
    this.compileCount++

    // Step 1: 从 render adapter 获取 raw IR（不含 lock）
    const rawIR = renderAdapter.compile(status, scenes, timeline, shotsByScene)

    // Step 2: 转换结构为 locked IR schema
    const sceneChain: RenderScene[] = rawIR.scenes.map(s => ({
      sceneId: s.sceneId,
      index: s.index,
      mood: s.mood,
      pacing: s.pacing,
      narrativeFunction: s.narrativeFunction,
      emotionalWeight: s.emotionalWeight,
      shots: s.shots.map(sh => sh.shotId),
      forbiddenStates: s.forbiddenStates,
    }))

    const shotChain: RenderShot[] = rawIR.scenes.flatMap(s => s.shots.map(sh => ({
      shotId: sh.shotId,
      sceneId: s.sceneId,
      shotType: sh.shotType,
      emotionalTension: sh.emotionalTension,
      colorGuide: {
        primary: sh.colorGuide.primary,
        palette: sh.colorGuide.palette,
        lighting: sh.colorGuide.lighting,
      },
      motionIntensity: sh.motionIntensity,
      cameraMotion: sh.cameraMotion,
      visualKeywords: sh.visualKeywords,
      frameIds: sh.frames.map(f => `${sh.shotId}_${f.type}`),
    })))

    const frameInstructions: FrameInstruction[] = rawIR.scenes.flatMap(s =>
      s.shots.flatMap(sh => sh.frames.map(f => ({
        frameId: `${sh.shotId}_${f.type}`,
        type: f.type,
        contrast: f.contrast,
        brightnessOffset: f.brightnessOffset,
        renderDescription: f.renderDescription,
        forbiddenStyles: f.forbiddenStyles,
      })))
    )

    const constraints: IRConstraints = {
      characterContinuity: rawIR.globalConstraints.characterContinuity,
      visualConsistency: rawIR.globalConstraints.visualConsistency,
      toneLocked: rawIR.globalConstraints.toneLocked,
      maxMotionIntensity: rawIR.globalConstraints.maxMotionIntensity,
      forbiddenVisualStates: [...rawIR.globalConstraints.forbiddenVisualStates],
    }

    const temporalAnchors: TemporalAnchors = {
      characters: this.extractCharacters(status),
      locations: this.extractLocations(scenes),
      objects: this.extractObjects(scenes, status),
    }

    // Step 3: 构造完整的 IR（此时 hash 为空）
    const ir: CinematicRenderIR = {
      version: '1.0.0',
      irId: `IR_${Date.now()}_${this.compileCount}`,
      hash: '', // 占位
      sessionId,
      sceneChain,
      shotChain,
      frameInstructions,
      constraints,
      temporalAnchors,
      metadata: {
        createdAt: Date.now(),
        sourceProjectTitle: status.projectTitle,
        stabilityAtCompile: status.stability,
      },
    }

    // Step 4: 计算 hash 并冻结
    return this.freezeIR(ir)
  }

  /**
   * 验证 IR 完整性
   * 如果 hash 不匹配（IR 被下游篡改），抛出错误
   */
  validateIR(ir: CinematicRenderIR): boolean {
    const storedHash = ir.hash
    // 用空 hash 计算比对
    const computed = this.computeHash({ ...ir, hash: '' })
    if (storedHash !== computed) {
      throw new Error(
        `[IR_LOCK_VIOLATION] RenderIR integrity check failed: hash mismatch. ` +
        `Expected ${computed}, got ${storedHash}. IR has been modified after compilation.`
      )
    }
    return true
  }

  /**
   * 计算 IR hash（仅基于不可变字段）
   */
  computeHash(ir: CinematicRenderIR): string {
    const hashInput = {
      sceneChain: ir.sceneChain,
      shotChain: ir.shotChain,
      frameInstructions: ir.frameInstructions,
      constraints: ir.constraints,
      temporalAnchors: ir.temporalAnchors,
    }

    const normalized = JSON.stringify(hashInput, this.replacer)
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * 冻结 IR（深冻结）
   */
  freezeIR(ir: CinematicRenderIR): CinematicRenderIR {
    const hash = this.computeHash(ir)
    const locked: CinematicRenderIR = {
      ...ir,
      hash,
      sceneChain: Object.freeze(
        ir.sceneChain.map(s => Object.freeze({ ...s, shots: Object.freeze(s.shots), forbiddenStates: Object.freeze(s.forbiddenStates) }))
      ),
      shotChain: Object.freeze(
        ir.shotChain.map(sh => Object.freeze({
          ...sh,
          colorGuide: Object.freeze(sh.colorGuide),
          visualKeywords: Object.freeze(sh.visualKeywords),
          frameIds: Object.freeze(sh.frameIds),
        }))
      ),
      frameInstructions: Object.freeze(
        ir.frameInstructions.map(f => Object.freeze({ ...f, forbiddenStyles: Object.freeze(f.forbiddenStyles) }))
      ),
      constraints: Object.freeze({ ...ir.constraints, forbiddenVisualStates: Object.freeze(ir.constraints.forbiddenVisualStates) }),
      temporalAnchors: Object.freeze({ ...ir.temporalAnchors, characters: Object.freeze(ir.temporalAnchors.characters), locations: Object.freeze(ir.temporalAnchors.locations), objects: Object.freeze(ir.temporalAnchors.objects) }),
      metadata: Object.freeze(ir.metadata),
    }
    return Object.freeze(locked)
  }

  /** 获取 compile 次数 */
  getCompileCount(): number {
    return this.compileCount
  }

  /** 当前 schema 版本 */
  getVersion(): string {
    return '1.0.0'
  }

  // ============================================================
  // Helpers
  // ============================================================

  private extractCharacters(status: DirectorStatus): string[] {
    return [...status.keyCharacters]
  }

  private extractLocations(scenes: ScenePreview[]): string[] {
    const locs = new Set<string>()
    for (const scene of scenes) {
      for (const kw of scene.visualKeywords) {
        if (['夜景', '雨', '暗巷', '天台', '黎明', '闪光', '室内', '室外'].includes(kw)) {
          locs.add(kw)
        }
      }
    }
    return Array.from(locs)
  }

  private extractObjects(_scenes: ScenePreview[], _status: DirectorStatus): string[] {
    // 由下游 backend adapter 层填充具体道具
    return []
  }

  /** JSON.stringify replacer — 确保 frozen 对象也能正确序列化 */
  private replacer(_key: string, value: unknown): unknown {
    return value
  }
}

/** 全局单例 */
export const irCompilerLock = new IRCompilerLock()
