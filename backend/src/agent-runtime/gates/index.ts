/**
 * agent-runtime/gates — Sprint-10 Step 3A
 * Runtime Hardening Gates
 *
 * 所有执行路径必经的统一安全关卡：
 *   - MemoryAccessGate: 验证 agent memory namespace 租户归属
 *   - ToolPermissionRuntimeGate: 统一工具权限校验
 */

export { MemoryAccessGate } from './memory-access.gate.js';
export type { MemoryAccessGateParams, MemoryAccessGateResult } from './memory-access.gate.js';

export { ToolPermissionRuntimeGate } from './tool-permission.gate.js';
export type { ToolPermissionGateParams, ToolPermissionGateResult } from './tool-permission.gate.js';
export { TASK_TOOL_MAP, TOOL_EXEMPT_TASK_TYPES } from './tool-permission.gate.js';
