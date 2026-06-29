/**
 * Execution Kernel — 核心类型定义
 *
 * 定义整个平台执行模型的标准类型：
 * - ExecutionRequest: 外部提交的执行请求
 * - ExecutionTask: 内核内部跟踪的任务
 * - ExecutionResult: 执行结果
 * - ExecutionError: 标准错误格式
 *
 * 所有 Workspace (GEO/Video/Novel/PPT) 都使用这些类型。
 * Kernel 层不包含任何 workspace 特定逻辑。
 *
 * @package @studio/platform/execution
 * @see RUNTIME-SPEC.md §2.1
 */

import type { ExecutionContext } from './execution-context';
import type { ExecutionPipelineStage } from './execution-pipeline';
import type { AssetRecord } from '../../capability/types';

/**
 * 执行状态枚举
 * 覆盖执行任务的完整生命周期
 */
export type ExecutionStatus =
  | 'pending'
  | 'validating'
  | 'planning'
  | 'acquiring'
  | 'executing'
  | 'persisting'
  | 'publishing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

/**
 * 执行请求 — 外部系统提交的入口
 *
 * 所有 workspace 通过 Engine.submit() 提交 ExecutionRequest，
 * Engine 将其转换为内部 ExecutionTask 进行处理。
 */
export interface ExecutionRequest {
  /** 请求唯一 ID（调用方生成） */
  id: string;

  /** 执行类型: 'workflow' | 'agent' | 'capability' | 'pipeline' */
  type: string;

  /** Workspace 类型 */
  workspaceType: string;

  /** 所属项目 ID */
  projectId: string;

  /** 发起用户 ID */
  userId: string;

  /** 执行负载（被 Pipeline handler 消费） */
  payload: unknown;

  /** 执行选项 */
  options?: {
    /** 超时时间 (ms) */
    timeout?: number;
    /** 优先级（数字越小优先级越高） */
    priority?: number;
    /** 重试策略 */
    retry?: {
      max: number;
      delay: number;
      backoff: 'linear' | 'exponential';
    };
    /** 自定义标签 */
    tags?: string[];
  };
}

/**
 * 执行任务 — 内核内部跟踪的执行单元
 *
 * 由 Engine 从 ExecutionRequest 创建，
 * 贯穿整个 Pipeline 生命周期。
 */
export interface ExecutionTask {
  /** 任务唯一 ID */
  id: string;

  /** 原始请求 ID */
  requestId: string;

  /** 分布式追踪 ID */
  traceId: string;

  /** 执行类型 */
  type: string;

  /** 当前状态 */
  status: ExecutionStatus;

  /** 执行上下文（所有 agent/task 共享的单一上下文） */
  context: ExecutionContext;

  /** Pipeline 阶段列表（按顺序执行） */
  pipeline: ExecutionPipelineStage[];

  /** 当前所在的 Pipeline 阶段索引 */
  currentStage: number;

  /** 执行结果 */
  result?: ExecutionResult;

  /** 执行错误 */
  error?: ExecutionError;

  /** 创建时间戳 (ms) */
  createdAt: number;

  /** 最后更新时间戳 (ms) */
  updatedAt: number;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;

  /** 结果数据 */
  data?: unknown;

  /** 错误信息（仅 success=false 时） */
  error?: ExecutionError;

  /** 总执行时长 (ms) */
  duration: number;

  /** 追踪 ID */
  traceId: string;

  // Future fields — reserved for C2.2+ / Observability

  /** Digital asset records (C2.2 Digital Asset Platform) */
  assets?: AssetRecord[];

  /** Performance metrics */
  metrics?: Record<string, number>;

  /** Token usage & cost tracking */
  cost?: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };

  /** Source citations */
  citations?: string[];

  /** Execution logs */
  logs?: string[];
}

/**
 * 执行错误 — 标准错误格式
 */
export interface ExecutionError {
  /** 机器可读的错误码 */
  code: string;

  /** 人类可读的错误描述 */
  message: string;

  /** 出错阶段 */
  stage?: string;

  /** 是否可重试 */
  retryable: boolean;

  /** 额外调试信息 */
  details?: Record<string, unknown>;
}
