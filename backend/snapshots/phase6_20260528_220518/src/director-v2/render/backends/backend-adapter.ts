/**
 * backend-adapter.ts — Phase 6D.2: Multi-Backend Adapter Layer
 *
 * Backend Adapter 接口 + 注册系统。
 * 所有 backend adapter 必须实现 IVideoBackendAdapter 接口。
 *
 * 契约：
 *   1. Adapter 只能读 ExecutionPlan（不能直接读 IR）
 *   2. Adapter 输出是 model-specific prompt string
 *   3. 不可在 adapter 中修改 plan 结构
 *   4. 注册后通过 BackendRouter.dispatch() 路由
 */

import type { ExecutionPlan } from './execution-plan.js'

// ============================================================
// Backend Adapter Interface
// ============================================================

export interface IVideoBackendAdapter {
  /** 后端名称（唯一标识） */
  name: string

  /**
   * 从 ExecutionPlan 编译为模型 prompt
   * ⚠ 只能读 plan，不能修改 plan
   */
  compile(plan: ExecutionPlan): BackendPromptResult

  /** 验证后端输出（可选） */
  validateOutput?(output: unknown): boolean
}

export interface BackendPromptResult {
  /** 后端名称 */
  backend: string
  /** 编译后的 prompt */
  prompt: string
  /** 模型特定的参数 */
  parameters: Record<string, unknown>
  /** 警告（如有 lossy 翻译） */
  warnings: string[]
  /** prompt 是否完全保留了 plan 结构 */
  structuralFidelity: 'full' | 'partial' | 'lossy'
}

// ============================================================
// Backend Router — 注册 + 调度
// ============================================================

export class BackendRouter {
  private adapters: Map<string, IVideoBackendAdapter> = new Map()

  /** 注册 backend adapter */
  register(adapter: IVideoBackendAdapter): void {
    if (this.adapters.has(adapter.name)) {
      console.warn(`[BackendRouter] Overwriting existing adapter: ${adapter.name}`)
    }
    this.adapters.set(adapter.name, adapter)
  }

  /**
   * 调度执行
   * 先验证 IR integrity（hash check），然后 normalize → compile
   */
  dispatch(
    plan: ExecutionPlan,
    backendName: string,
    validateIR?: () => boolean,
  ): BackendPromptResult {
    // Step 1: 验证 IR 完整性（由调用方提供验证器）
    if (validateIR && !validateIR()) {
      throw new Error(`[BACKEND_ROUTER] IR integrity check failed — cannot dispatch to ${backendName}`)
    }

    // Step 2: 查找 adapter
    const adapter = this.adapters.get(backendName)
    if (!adapter) {
      throw new Error(`[BACKEND_ROUTER] Unsupported backend: ${backendName}. Registered: ${this.listBackends().join(', ')}`)
    }

    // Step 3: 编译
    return adapter.compile(plan)
  }

  /** 列出所有注册的后端 */
  listBackends(): string[] {
    return Array.from(this.adapters.keys())
  }

  /** 是否有指定后端 */
  hasBackend(name: string): boolean {
    return this.adapters.has(name)
  }

  /** 移除后端 */
  unregister(name: string): boolean {
    return this.adapters.delete(name)
  }
}

/** 全局单例 */
export const backendRouter = new BackendRouter()

// ============================================================
// Built-in Adapters
// ============================================================

/**
 * Runway Gen-3 Adapter
 * Runway 强风格化但动作弱，Motion Intensity 走上限补偿
 */
export const RunwayAdapter: IVideoBackendAdapter = {
  name: 'runway',

  compile(plan: ExecutionPlan): BackendPromptResult {
    const warnings: string[] = []
    const scenes = plan.scenes.map((scene, si) => {
      const shots = scene.shots.map((shot, shi) => {
        // Runway 的动作强度需补偿上限
        const compensatedIntensity = Math.min(shot.motion.intensity * 1.3, 1.0)
        if (compensatedIntensity > shot.motion.intensity) {
          warnings.push(`Runway: motion intensity compensated ${(shot.motion.intensity * 100).toFixed(0)}% → ${(compensatedIntensity * 100).toFixed(0)}% for shot ${shot.shotId}`)
        }
        return `[Shot ${shi + 1}] ${shot.shotType} | ${shot.camera.motion} | motion: ${(compensatedIntensity * 100).toFixed(0)}% | ${shot.renderDescriptions.join(' → ')}`
      })
      return `[Scene ${si + 1}: ${scene.mood}] ${shots.join('\n  ')}`
    }).join('\n')

    return {
      backend: 'runway',
      prompt: `Runway Gen-3 Cinematic:\n${scenes}\n\nStyle: cinematic_realism\nContinuity: ${plan.globalConstraints.characterContinuity ? 'strict' : 'relaxed'}\nMax Motion: ${(plan.globalConstraints.maxMotionIntensity * 100).toFixed(0)}%`,
      parameters: { model: 'gen-3', style: 'cinematic', motionBoost: true },
      warnings,
      structuralFidelity: plan.scenes.length > 3 ? 'partial' as const : 'full' as const,
    }
  },
}

/**
 * Pika Adapter
 * Pika 动作强但结构弱 — 需要显式 scene boundary 约束
 */
export const PikaAdapter: IVideoBackendAdapter = {
  name: 'pika',

  compile(plan: ExecutionPlan): BackendPromptResult {
    const sceneCount = plan.scenes.length
    const warnings: string[] = []

    const prompt = plan.scenes.map((scene, si) => {
      const shotDescs = scene.shots.map((shot, shi) => {
        const intensityLabel = shot.motion.intensity > 0.7 ? 'high' : shot.motion.intensity > 0.4 ? 'medium' : 'low'
        return `Shot${shi + 1}: ${shot.shotType} (${intensityLabel} motion, ${shot.camera.motion})`
      }).join('\n')

      return `=== Scene ${si + 1}: ${scene.mood} (pacing: ${scene.pacing}) ===\n${shotDescs}`
    }).join('\n\n')

    if (sceneCount > 4) {
      warnings.push('Pika: Scene count > 4 may cause structural drift — suggested splitting into multiple generations')
    }

    return {
      backend: 'pika',
      prompt: `Pika Cinematic:\n${prompt}\n\n---\nStyle: ${plan.globalConstraints.visualConsistency ? 'consistent' : 'dynamic'}\nCharacter continuity: ${plan.continuityAnchors.characters.join(', ')}`,
      parameters: { motionStrength: 'auto', sceneBoundary: 'hard' },
      warnings,
      structuralFidelity: sceneCount <= 4 ? 'full' as const : 'partial' as const,
    }
  },
}

// ============================================================
// Register default adapters
// ============================================================

// Auto-registered on module import
backendRouter.register(RunwayAdapter)
backendRouter.register(PikaAdapter)
