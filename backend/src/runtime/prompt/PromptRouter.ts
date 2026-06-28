/**
 * PromptRouter.ts — Phase 4-A 确定性 Prompt 路由
 *
 * 职责：
 * 1. 在 PromptRegistry 上层提供版本路由
 * 2. 只允许三种策略：stable / canary / manual_override
 * 3. 将路由结果记录到 Runtime Logger
 * 4. 不允许：score routing, AI decision routing, auto-fallback learning
 *
 * 调用链路：
 *   getPrompt(name, context)
 *     → 确定 routing mode
 *     → 从 PromptVersionGraph 获取版本号
 *     → 记录日志（RuntimeLogger）
 *     → 返回 { version, routingMode }
 *
 * @phase-4a
 */

import { getStableVersion, getAllVersions } from './PromptVersionGraph.js'

// ─── 路由模式 ───

export type RoutingMode = 'stable' | 'canary' | 'override'

export interface RoutingResult {
  version: string
  routingMode: RoutingMode
}

// ─── 路由上下文 ───

export interface RoutingContext {
  enableCanary?: boolean      // 手动开启 canary
  promptVersionOverride?: string  // 手动指定版本（调试用）
  [key: string]: any
}

// ─── 路由函数 ───

/**
 * 根据上下文确定版本号（不执行 prompt，只返回版本信息）
 */
export async function resolvePromptVersion(
  name: string,
  context?: RoutingContext
): Promise<RoutingResult> {
  // 1. override 优先级最高（调试用）
  if (context?.promptVersionOverride) {
    return {
      version: context.promptVersionOverride,
      routingMode: 'override',
    }
  }

  // 2. canary（手动开启）
  if (context?.enableCanary) {
    const allVersions = await getAllVersions(name)
    // canary 模式返回最新版本（假设最新版 = canary 候选）
    if (allVersions.length > 1) {
      return {
        version: allVersions[allVersions.length - 1].version,
        routingMode: 'canary',
      }
    }
    // 只有一个版本时降级为 stable
  }

  // 3. stable（默认）
  const stableVersion = await getStableVersion(name)
  return {
    version: stableVersion,
    routingMode: 'stable',
  }
}
