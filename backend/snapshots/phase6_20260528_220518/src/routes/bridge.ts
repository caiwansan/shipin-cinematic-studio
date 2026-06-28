import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Bridge Routes — 控制 Legacy Bridge 迁移状态的 API
 *
 * POST /api/v2/bridge/mode  — 设置迁移模式
 * GET  /api/v2/bridge/config — 获取当前迁移配置
 * GET  /api/v2/bridge/plan   — 获取迁移路线图
 * POST /api/v2/bridge/phase  — 执行一个迁移阶段
 */

import { FastifyInstance } from 'fastify'
import { legacyBridge, BridgeMode, LegacyBridgeConfig } from '../core/bridge/legacy-provider-bridge.js'

// 路径名称到中文描述
const PATH_LABELS: Record<string, string> = {
  image: '图片生成',
  tts: 'TTS 语音合成',
  voice: '路由 voice.ts',
  video: '视频生成',
  queue: '旧队列系统 ai-tasks.ts',
  director: '导演编排 director-v2',
  continuity: '连续性管线 continuity.ts',
}

// 迁移阶段定义
const MIGRATION_PHASES = [
  {
    phase: 0,
    name: 'Bridge 建立',
    description: 'Legacy Bridge 架构就绪，所有路径在 direct 模式（当前状态）',
    action: 'EPVH 扫描 + Bridge 初始化',
    paths: [] as string[],
    mode: 'direct' as BridgeMode,
  },
  {
    phase: 1,
    name: '安全替换（Class A）',
    description: 'tts.ts / voice.ts → bridge bridged 模式',
    action: '包装到 executionCutover，bridged 模式允许 fallback',
    paths: ['tts', 'voice'],
    mode: 'bridged' as BridgeMode,
  },
  {
    phase: 2,
    name: 'Payload 转换迁移（Class B）',
    description: 'images.ts → bridge bridged 模式',
    action: '需处理 payload 结构差异，bridged 模式',
    paths: ['image', 'video'],
    mode: 'bridged' as BridgeMode,
  },
  {
    phase: 3,
    name: '旧队列迁移（Class B）',
    description: 'ai-tasks.ts / scheduler.ts → partial migration',
    action: '业务逻辑前置，queue 作为后端',
    paths: ['queue'],
    mode: 'bridged' as BridgeMode,
  },
  {
    phase: 4,
    name: '架构重构（Class C）',
    description: 'director-v2 / continuity.ts → 架构重构',
    action: '保留 orchestration layer，只替换 provider 调用点',
    paths: ['director', 'continuity'],
    mode: 'bridged' as BridgeMode,
  },
  {
    phase: 5,
    name: '完全收敛',
    description: '所有路径 cutover 模式，legacy 代码可删除',
    action: '全部切换到 executionCutover，遗留代码冻结',
    paths: ['image', 'tts', 'voice', 'video', 'queue', 'director', 'continuity'],
    mode: 'cutover' as BridgeMode,
  },
]

export default async function bridgeRoutes(app: FastifyInstance) {
  // 设置迁移模式
  app.post<{ Body: { path: string; mode: string } }>('/api/v2/bridge/mode', async (req) => {
    const { path, mode } = req.body

    if (!legacyBridge.getConfig()[path as keyof LegacyBridgeConfig]) {
      return { success: false, error: `未知路径: ${path}，可用: ${Object.keys(legacyBridge.getConfig()).join(', ')}` } satisfies ApiResponse<unknown>;

    }

    if (!['direct', 'bridged', 'cutover'].includes(mode)) {
      return { success: false, error: `未知模式: ${mode}，可用: direct, bridged, cutover` } satisfies ApiResponse<unknown>;

    }

    legacyBridge.setMode(path as any, mode as BridgeMode)
    return { success: true, data: { path, mode, config: legacyBridge.getConfig() } } satisfies ApiResponse<unknown>;

  })

  // 获取当前配置
  app.get('/api/v2/bridge/config', async () => {
    return {
      success: true,
      data: {
        config: legacyBridge.getConfig(),
        currentMode: Object.fromEntries(
          Object.entries(legacyBridge.getConfig()).map(([k, v]) => [k, v.mode])
        ),
      },
    }
  })

  // 获取迁移路线图
  app.get('/api/v2/bridge/plan', async () => {
    const currentConfig = legacyBridge.getConfig()

    const phasesWithStatus = MIGRATION_PHASES.map(phase => {
      const pathMods: Record<string, string> = {}
      for (const p of phase.paths) {
        const cfg = currentConfig[p as keyof typeof currentConfig]
        pathMods[p] = cfg?.mode ?? 'unknown'
      }

      const allMatch = phase.paths.length === 0 || phase.paths.every(p => {
        const cfg = currentConfig[p as keyof typeof currentConfig]
        return cfg?.mode === phase.mode
      })

      return {
        ...phase,
        pathLabels: phase.paths.map(p => PATH_LABELS[p] || p),
        currentModes: pathMods,
        completed: allMatch,
      }
    })

    return {
      success: true,
      data: {
        phases: phasesWithStatus,
        currentPhase: phasesWithStatus.map((p, i) => p.completed ? i : -1).filter(i => i >= 0).pop() ?? -1,
        totalBypasses: 32,
        bypassesByPath: {
          image: 7,
          tts: 3,
          voice: 1,
          video: 2,
          queue: 2,
          director: 1,
          continuity: 1,
        },
      },
    }
  })

  // 执行迁移阶段
  app.post<{ Body: { phase: number } }>('/api/v2/bridge/phase', async (req) => {
    const phaseIndex = req.body.phase

    if (phaseIndex < 0 || phaseIndex >= MIGRATION_PHASES.length) {
      return { success: false, error: `无效阶段: ${phaseIndex}，可用: 0-${MIGRATION_PHASES.length - 1}` } satisfies ApiResponse<unknown>;

    }

    const phase = MIGRATION_PHASES[phaseIndex]
    const mode = phase.mode

    const result: Record<string, string> = {}
    for (const path of phase.paths) {
      legacyBridge.setMode(path as any, mode)
      result[path] = mode
    }

    return {
      success: true,
      data: {
        phase: phaseIndex,
        name: phase.name,
        appliedTo: result,
        totalBypassesResolved: phaseIndex === MIGRATION_PHASES.length - 1 ? 32 : undefined,
      },
    }
  })
}
