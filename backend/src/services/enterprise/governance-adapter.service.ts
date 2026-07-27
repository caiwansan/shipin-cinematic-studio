/**
 * Engineering & Governance Adapter — ER-05-TASK-01
 * OpenClaw Identity Registration
 *
 * 让昆仑镜知道:
 *   OpenClaw type: ENGINEERING_AGENT
 *   scope: SYSTEM_GOVERNANCE
 * 不是: Employee Agent
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface GovernanceAgentIdentity {
  id: string
  type: 'ENGINEERING_AGENT' | 'AUDIT_AGENT' | 'GOVERNANCE_AGENT'
  name: string
  scope: 'SYSTEM_GOVERNANCE' | 'CODE_REVIEW' | 'ARCHITECTURE_REVIEW' | 'AUDIT'
  organizationId: string
  capabilities: string[]
  registeredAt: string
}

// ─── Service ─────────────────────────────────────────────

export class GovernanceAdapterService {

  /**
   * 注册 OpenClaw 治理身份
   */
  async registerIdentity(identity: {
    type: 'ENGINEERING_AGENT' | 'AUDIT_AGENT' | 'GOVERNANCE_AGENT'
    name: string
    scope: string
    organizationId: string
    capabilities: string[]
  }): Promise<GovernanceAgentIdentity> {
    const record: GovernanceAgentIdentity = {
      id: `governance-${Date.now()}`,
      type: identity.type,
      name: identity.name,
      scope: identity.scope as any,
      organizationId: identity.organizationId,
      capabilities: identity.capabilities,
      registeredAt: new Date().toISOString(),
    }

    // 存储到 AgentMemory (governance_identity type)
    await prisma.agentMemory.create({
      data: {
        agentId: 'agent_camera',
        memoryType: 'governance_identity',
        content: JSON.stringify(record),
        embeddingVector: null,
      },
    })

    return record
  }

  /**
   * 获取治理身份
   */
  async getIdentity(organizationId: string): Promise<GovernanceAgentIdentity | null> {
    // 从 AgentMemory 读取治理身份
    const mem = await prisma.agentMemory.findFirst({
      where: {
        agentId: 'agent_camera',
        memoryType: 'governance_identity',
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!mem) return null
    try {
      return JSON.parse(mem.content)
    } catch {
      return null
    }
  }

  /**
   * 检查是否为治理 Agent
   */
  async isGovernanceAgent(organizationId: string): Promise<boolean> {
    const identity = await this.getIdentity(organizationId)
    return !!identity
  }
}

export const governanceAdapterService = new GovernanceAdapterService()
