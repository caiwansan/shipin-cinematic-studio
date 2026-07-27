/**
 * agent-runtime/context/runtime-context.service.ts
 * Runtime Context — 调用上下文管理
 */

import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@prisma/client';
import { IRuntimeContextService } from '../interfaces/runtime-context.interface.js';
import { RuntimeContext } from '../types/agent-runtime.types.js';

export class RuntimeContextService implements IRuntimeContextService {
  constructor(private prisma: PrismaClient) {}

  createContext(params: {
    organizationId: string;
    actorId: string;
    agentId?: string;
    permissionScope?: string[];
  }): RuntimeContext {
    return {
      organizationId: params.organizationId,
      actorId: params.actorId,
      agentId: params.agentId,
      permissionScope: params.permissionScope || ['agent:read'],
      requestId: uuidv4(),
    };
  }

  async validateAccess(context: RuntimeContext, agentId: string): Promise<boolean> {
    const agent = await (this.prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: agentId },
      select: { organizationId: true, tenantId: true },
    });

    if (!agent) return false;

    // 严格租户隔离：优先匹配 organizationId，fallback 到 tenantId
    const agentOrg = agent.organizationId || agent.tenantId
    return agentOrg === context.organizationId;
  }

  hasPermission(context: RuntimeContext, permission: string): boolean {
    return context.permissionScope.includes(permission);
  }
}
