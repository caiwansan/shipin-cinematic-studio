/**
 * ExecutionContext — 单一执行上下文对象
 *
 * 这是整个平台执行模型中 ALL agents 和 ALL tasks 接收的
 * 唯一上下文对象。不存在多个不同上下文。
 *
 * 原则：
 * - ExecutionContext 是唯一的
 * - 所有 handler/agent/worker 都从 ExecutionContext 派生所需信息
 * - WORSPACE 特定逻辑不允许出现在 ExecutionContext 中
 * - capabilities 是 Map<string, unknown>，workspace 自行类型断言
 *
 * @package @studio/platform/execution
 * @see RUNTIME-SPEC.md §2
 */

/**
 * ExecutionContext — 单一上下文对象
 *
 * 包含执行所需的所有信息：
 * - 身份标识：requestId, traceId, userId, projectId 等
 * - 运行时能力：capabilities Map
 * - 生命周期控制：cancellationToken, timeout
 * - 重试状态：retryCount, maxRetries
 * - 自定义元数据：metadata
 */
export interface ExecutionContext {
  // ============ Identity（身份标识） ============

  /** 请求唯一 ID */
  requestId: string;

  /** 分布式追踪 ID（跨服务可追踪） */
  traceId: string;

  /** 发起用户 ID */
  userId: string;

  /** 所属项目 ID */
  projectId: string;

  /** 租户 ID（多租户支持） */
  tenantId?: string;

  /** Agent 会话 ID */
  sessionId?: string;

  /** Workspace 类型 */
  workspaceType: string;

  /** Workspace 实例 ID */
  workspaceId: string;

  // ============ Runtime Capabilities（运行时能力） ============

  /** 取消令牌（用于优雅取消） */
  cancellationToken: AbortSignal;

  /** 平台可用能力集合（非 LLM 能力，而是平台级能力如锁、存储等） */
  capabilities: Map<string, unknown>;

  // ============ Lifecycle（生命周期控制） ============

  /** 开始执行时间戳 (ms) */
  startedAt: number;

  /** 超时时间 (ms) */
  timeoutMs: number;

  /** 当前重试次数 */
  retryCount: number;

  /** 最大重试次数 */
  maxRetries: number;

  // ============ Locale（国际化） ============

  /** 语言区域（如 'zh-CN', 'en-US'） */
  locale?: string;

  /** 时区（如 'Asia/Shanghai', 'America/New_York'） */
  timezone?: string;

  // ============ Metadata（自定义元数据） ============

  /** 自定义元数据 */
  metadata: Record<string, unknown>;
}
