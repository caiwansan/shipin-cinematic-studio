/**
 * Execution Worker — Worker 接口
 *
 * Worker 是任务的实际执行者。
 * Pipeline 的 execute 阶段将任务分派给 Worker 执行。
 *
 * Worker 类型：
 * - AgentWorker: 执行 AI Agent 任务
 * - CapabilityWorker: 执行能力调用（LLM, image, TTS 等）
 * - WorkflowWorker: 执行 DAG 工作流
 *
 * @package @studio/platform/execution
 */

import type { ExecutionContext } from './execution-context';
import type { ExecutionResult } from './types';

/**
 * Worker 执行参数
 */
export interface WorkerParams {
  /** Worker 类型标识 */
  workerType: string;

  /** 执行负载 */
  payload: unknown;

  /** 执行上下文 */
  context: ExecutionContext;
}

/**
 * Worker 接口
 *
 * 所有具体 Worker 实现此接口：
 * - AgentWorker: 调用 Agent handler
 * - CapabilityWorker: 调用 CapabilityRuntime
 * - WorkflowWorker: 调用 WorkflowRuntime
 */
export interface ExecutionWorker {
  /** Worker 类型标识 */
  readonly type: string;

  /**
   * 执行任务
   * @param params - 执行参数
   * @returns 执行结果
   */
  execute(params: WorkerParams): Promise<ExecutionResult>;

  /**
   * 取消当前执行
   */
  cancel(): Promise<void>;

  /**
   * 获取 Worker 健康状态
   */
  health(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Worker 注册表
 * Engine 通过 WorkerRegistry 发现 Worker
 */
export interface WorkerRegistry {
  /**
   * 注册一个 Worker
   */
  register(worker: ExecutionWorker): void;

  /**
   * 根据类型获取 Worker
   */
  get(type: string): ExecutionWorker | undefined;

  /**
   * 列出所有已注册的 Worker 类型
   */
  list(): string[];
}
