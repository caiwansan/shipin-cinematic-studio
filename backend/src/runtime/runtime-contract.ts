/**
 * runtime/runtime-contract.ts — Runtime Constitution Final Contract
 *
 * Phase 4, Rule 6: adapter registry 是单一事实源
 * 所有模型执行必须经过且仅经过 modelAdapterRegistry.execute(runtime, model, input)
 */

export const RuntimeContract = {
  version: '1.0',

  /** RuntimePayload 必需字段 */
  required: [
    'userId',
    'provider',
    'model',
    'taskType',
    'apiKey',
  ],

  /** 唯一执行入口 */
  execute: 'modelAdapterRegistry.execute(runtime, model, input)',
} as const
