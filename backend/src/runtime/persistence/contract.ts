/**
 * persistence/contract.ts — Phase W.0 Runtime Persistence Contract
 *
 * ═══════════════════════════════════════════════════════════════
 * 这是昆仑镜 Runtime Persistence 的底层数据契约。
 *
 * 宪法级规则（不可违反）：
 *   W.0.1 RuntimeStateV1 是 append-only，禁止删除/重命名字段
 *   W.0.2 RuntimeAdapter 是所有工作台的唯一序列化入口
 *   W.0.3 禁止绕过 RuntimeAdapter 直接操作 RuntimeState
 *   W.0.4 未来升级到 V2 时必须提供 migration path
 *   W.0.5 禁止在 W.0 阶段写任何 Serializer/Snapshot/Replay 逻辑
 *
 * 升级规则：
 *   V1 → V2：新增字段必须 optional，删除字段必须 deprecated
 *   V2 → V3：同前
 *   不允许：breaking change without migration
 *
 * W.1 宪法补充（2026-06-19）：
 *   W.1.1 所有历史 Snapshot 系统必须通过 Adapter 兼容
 *   W.1.2 禁止结构性迁移旧数据模型
 *   W.1.3 禁止重写 legacy schema
 *   W.1.4 Adapter 是桥梁，不是拆迁队
 * ═══════════════════════════════════════════════════════════════
 */

// ─── W.0 宪法版本 ─────────────────────────────────────────────

/** Phase W.0 宪法版本号 */
export const PERSISTENCE_CONTRACT_VERSION = '1.0'

// ─── RuntimeStateV1 ──────────────────────────────────────────

/**
 * RuntimeStateV1 — 通用运行时快照数据格式
 *
 * 这是所有工作台（PPT/短剧/小说等）的统一持久化格式。
 * 各工作台通过 RuntimeAdapter 的 serialize/deserialize 来转换。
 *
 * @version 1.0
 */
export interface RuntimeStateV1 {
  /** Schema 版本，用于未来迁移 */
  schemaVersion: '1.0'

  /** 工作台唯一标识 */
  workbenchId: string

  /** 元数据 */
  metadata: {
    /** 工作台类型：ppt | storyboard | novel */
    type: string
    title?: string
    createdAt?: string
    updatedAt?: string
  }

  /** 实体池：所有工作台创建的实体（角色/场景/镜头/页面等） */
  entities: Record<string, unknown>

  /** 运行时图：实体间的拓扑关系 */
  graph: {
    nodes: unknown[]
    edges: unknown[]
  }

  /** 运行时状态：各子系统的运行时数据 */
  runtime: Record<string, unknown>

  /** 已生成的资产引用 */
  artifacts: {
    images: unknown[]
    videos: unknown[]
    audio: unknown[]
    documents?: unknown[]
  }

  /** UI 用户界面状态（滚动位置/展开状态/选中项等） */
  uiState: Record<string, unknown>
}

// ─── RuntimeAdapter ──────────────────────────────────────────

/**
 * RuntimeAdapter — 工作台运行时与持久化层之间的契约
 *
 * 每个工作台类型（ppt/storyboard/novel）必须实现此接口。
 * serialize/deserialize 必须互为逆操作，即：
 *   serialize(deserialize(serialize(runtime))) -> 等价的 RuntimeStateV1
 */
export interface RuntimeAdapter {
  /**
   * 将当前运行时序列化为统一快照格式
   */
  serialize(): Promise<RuntimeStateV1>

  /**
   * 从统一快照格式恢复运行时状态
   */
  deserialize(state: RuntimeStateV1): Promise<void>
}

// ─── 类型守卫（可选，用于运行时校验） ─────────────────────────

/**
 * 检查一个对象是否符合 RuntimeStateV1 格式
 */
export function isRuntimeStateV1(obj: unknown): obj is RuntimeStateV1 {
  if (!obj || typeof obj !== 'object') return false
  const s = obj as Record<string, unknown>
  return (
    s.schemaVersion === '1.0' &&
    typeof s.workbenchId === 'string' &&
    typeof s.metadata === 'object' &&
    typeof s.entities === 'object' &&
    typeof s.graph === 'object' &&
    typeof s.runtime === 'object' &&
    typeof s.artifacts === 'object'
  )
}
