/**
 * Execution Guard — 永不中断执行契约
 * 
 * 每个 pipeline step 的输出在返回前必须通过此 guard 检查。
 * 如果输出无效或失败，自动生成占位数据并标记 degraded。
 */

import { narrativeGateway } from './narrative-gateway.js'

// ============================================================
// Standardized Contract
// ============================================================

export interface ExecutionContract {
  ok: boolean
  degraded: boolean
  data: any
  node: string
  traceId?: string
  fallbackUsed: boolean
  next?: string
  error?: string
  jobId?: string
}

/**
 * 占位数据工厂 — 为不同类型的 node 生成合理的默认值
 */
export function createFallbackNode(type: string): any {
  switch (type) {
    case 'character':
    case 'character_design':
      return {
        characters: [{
          name: '主角',
          role: 'protagonist',
          gender: 'neutral',
          age: '青年',
          personality: ['勇敢', '善良'],
          appearance: '待设计',
          voiceStyle: 'neutral_standard',
        }],
      }
    case 'scene':
    case 'scene_design':
      return {
        scenes: [{
          id: 'scene_001',
          name: '开场场景',
          description: '故事发生的初始场景',
          mood: 'neutral',
          timeOfDay: '白天',
          weather: '晴',
          location: '待定',
        }],
      }
    case 'storyboard':
      return {
        storyboards: [{
          scene: '开场场景',
          shots: 3,
          description: '故事开场，默认分镜方案',
        }],
      }
    case 'audio':
    case 'voice':
      return {
        voices: [{
          characterName: '主角',
          voiceId: 'zh_female_sweet',
          emotion: 'neutral',
        }],
      }
    case 'shot_plan':
    case 'render_plan':
      return {
        shots: [],
        segments: [],
        totalDuration: 0,
      }
    case 'render':
      return {
        videos: [],
        status: 'placeholder',
      }
    default:
      return { placeholder: true, generatedBy: 'execution-guard-fallback' }
  }
}

/**
 * ExecutionGuard — 包装任何 node 输出
 * 如果输出无效 → degraded=true + fallback data
 * 管线绝不会因为某个 node 失败而中断
 */
export function ExecutionGuard(
  nodeResult: any,
  nodeType: string,
  traceId?: string,
): ExecutionContract {
  // 如果结果不存在或明确失败
  if (!nodeResult || nodeResult.ok === false || nodeResult._status === 'failed' || nodeResult._status === 'error') {
    const fallbackData = createFallbackNode(nodeType)
    return {
      ok: false,
      degraded: true,
      data: fallbackData,
      node: nodeType,
      traceId,
      fallbackUsed: true,
      next: nodeResult?.next || 'continue_graph',
      error: nodeResult?._error || nodeResult?.error || `${nodeType} 节点降级`,
    }
  }

  // 正常返回，标准化
  return {
    ok: true,
    degraded: nodeResult.degraded || false,
    data: nodeResult.data || nodeResult,
    node: nodeType,
    traceId: traceId || nodeResult.traceId,
    fallbackUsed: nodeResult.fallbackUsed || false,
    next: nodeResult.next || undefined,
    jobId: nodeResult.jobId || undefined,
  }
}

/**
 * 确保 LLM 响应是有效 JSON，如果不是则修复或 fallback
 */
export function safeJsonParse(content: string, fallback: any = null): { parsed: any; degraded: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { parsed: fallback, degraded: true, error: '空响应' }
  }

  try {
    // 尝试直接解析
    const parsed = JSON.parse(content)
    return { parsed, degraded: false }
  } catch {
    // 尝试从 markdown 代码块提取
    try {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim())
        return { parsed, degraded: false }
      }
    } catch {}

    // 尝试修复常见 JSON 错误
    // 尝试从 { 边界提取 JSON 片段
    try {
      const braceStart = content.indexOf("{")
      const braceEnd = content.lastIndexOf("}")
      if (braceStart >= 0 && braceEnd > braceStart) {
        const extracted = content.slice(braceStart, braceEnd + 1)
        const parsed = JSON.parse(extracted)
        return { parsed, degraded: false }
      }
    } catch {}

    try {
      const fixed = content
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(fixed)
      return { parsed, degraded: true, error: 'JSON 格式修复' }
    } catch {
      // 完全无可救药，返回 fallback
      return { parsed: fallback, degraded: true, error: 'JSON 解析失败，使用占位数据' }
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

