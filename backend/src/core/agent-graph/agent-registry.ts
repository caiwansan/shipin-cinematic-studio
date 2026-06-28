/**
 * P3 — AgentRegistry（Agent 注册中心）
 *
 * 所有可用的 Agent 定义在这里注册。
 * Agent 只声明 Capability，不声明 Provider。
 *
 * 用法：AgentRegistry.get('script_analysis') → { name, capability, ... }
 */

import { Capability } from '../runtime/capabilities.js'
import type { AgentNode } from './agent-node.js'

export interface AgentDefinition {
  name: string
  capability: Capability
  description: string
  defaultInputTransform?: (context: Map<string, any>) => any
}

class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map()

  constructor() {
    this.registerDefaults()
  }

  register(id: string, def: AgentDefinition): void {
    this.agents.set(id, def)
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id)
  }

  list(): Array<{ id: string } & AgentDefinition> {
    return Array.from(this.agents.entries()).map(([id, def]) => ({ id, ...def }))
  }

  private registerDefaults(): void {
    this.register('script_analysis', {
      name: '剧本分析 Agent',
      capability: Capability.SCRIPT_ANALYSIS,
      description: '分析剧本，提取角色、场景、分镜',
    })
    this.register('character_extraction', {
      name: '角色提取 Agent',
      capability: Capability.SCRIPT_ANALYSIS,
      description: '从剧本中提取角色描述',
    })
    this.register('prompt_optimization', {
      name: 'Prompt 优化 Agent',
      capability: Capability.PROMPT_OPTIMIZATION,
      description: '对角色/场景 prompt 做语义增强',
    })
    this.register('image_generation', {
      name: '图片生成 Agent',
      capability: Capability.IMAGE_GENERATION,
      description: '根据优化后的 prompt 生成图片',
    })
    this.register('video_generation', {
      name: '视频生成 Agent',
      capability: Capability.VIDEO_GENERATION,
      description: '生成视频片段',
    })
    this.register('voice_generation', {
      name: '语音生成 Agent',
      capability: Capability.VOICE_GENERATION,
      description: '生成 TTS 语音',
    })
  }
}

export const agentRegistry = new AgentRegistry()
