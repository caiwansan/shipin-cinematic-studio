/**
 * agent-runtime/interfaces/runtime-context.interface.ts
 * Runtime Context 接口
 */

import { RuntimeContext } from '../types/agent-runtime.types.js';

export interface IRuntimeContextService {
  /**
   * 创建 Runtime Context
   */
  createContext(params: {
    organizationId: string;
    actorId: string;
    agentId?: string;
    permissionScope?: string[];
  }): RuntimeContext;

  /**
   * 验证 Context 是否有权限操作 Agent
   */
  validateAccess(context: RuntimeContext, agentId: string): Promise<boolean>;

  /**
   * 验证 Context 是否有指定权限
   */
  hasPermission(context: RuntimeContext, permission: string): boolean;
}
