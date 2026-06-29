// ============================================================
// StructuredGeneration — KMKI-RUNTIME-009
// 昆仑镜平台结构化生成统一入口
// 所有 Agent 的唯一结构化生成入口，禁止绕过
// ============================================================

import { structuredExecute, type StructuredInput, type StructuredResult, type ProviderConfig } from './StructuredExecutor'
import { createGenerationContext, type GenerationContext } from './GenerationContext'
import type { SchemaField } from './SchemaValidator'

export interface GenerationOptions {
  /** 项目 ID（透传给 Usage/Trace） */
  projectId?: string
  /** 用户 ID（用于解析 Provider） */
  userId?: string
  /** 工作流 ID */
  workflowId?: string
  /** 执行 ID */
  executionId?: string
}

/**
 * 统一结构化生成入口
 * Agent 只调用这个函数，不执行任何底层操作
 *
 * @example
 * ```ts
 * const result = await structuredGenerate<EntityOutput>({
 *   promptKey: 'entity.v1',
 *   schema: createEntityArraySchema(),
 *   agent: 'geo.entity',
 *   variables: { topic: 'https://example.com', maxEntities: '12' },
 * })
 * ```
 */
export async function structuredGenerate<T = any>(
  input: {
    promptKey: string
    promptVersion?: string
    schema?: SchemaField[]
    agent: string
    variables: Record<string, string | number | boolean | string[] | undefined | null>
    provider?: ProviderConfig
    options?: GenerationOptions
  },
): Promise<StructuredResult<T>> {
  const ctx = createGenerationContext(input.agent, input.promptKey, input.promptVersion || 'latest', {
    projectId: input.options?.projectId,
    userId: input.options?.userId,
    workflowId: input.options?.workflowId,
    executionId: input.options?.executionId,
  })

  const execInput: StructuredInput = {
    promptKey: input.promptKey,
    promptVersion: input.promptVersion,
    schema: input.schema,
    context: ctx,
    variables: input.variables,
    providerConfig: input.provider,
  }

  return structuredExecute<T>(execInput)
}

export { StructuredExecutor } from './StructuredExecutor'
