// ════════════════════════════════════════════════════════════
// P2A-000 — Distribution Contract（冻结）
// ════════════════════════════════════════════════════════════
// 所有 Publisher 的统一输入/输出协议。
// 不修改 DistributionEngine / Planner / Registry / ExecutionGraph。
// ════════════════════════════════════════════════════════════

/**
 * PublishRequest — DistributionTarget 的唯一输入
 */
export interface PublishRequest {
  packageId: string
  planId: string
  targets: string[]
  initiatedBy?: string
}

/**
 * PublishResult — 每个 Target 执行后的统一输出
 */
export interface PublishResult {
  target: string
  status: 'success' | 'failed' | 'skipped'
  files: PublishFile[]
  duration: number    // ms
  artifactHash?: string
  warnings?: string[]
  errors?: string[]
}

/**
 * PublishFile — 单次发布生成的一个文件
 */
export interface PublishFile {
  fileName: string
  filePath: string
  mimeType: string
  content: string
  size: number
  contentHash: string
}

/**
 * PublishRecord — 写入 DB 的持久化发布记录
 */
export interface PublishRecordData {
  packageId: string
  target: string
  status: string
  startedAt: Date
  finishedAt?: Date
  duration?: number
  outputPath?: string
  artifactHash?: string
  publisherVersion?: string
  warnings?: string[]
  errors?: string[]
}

/**
 * Publisher — 统一的 Publisher 接口（用于替换旧的 DistributionTarget 接口）
 *
 * 每个 Publisher 负责将 KnowledgePackage 转换为一个或多个可发布的文件。
 * 输出为 PublishFile[]，不包含路径或部署逻辑（只生成内容）。
 *
 * 使用方式：
 *   const publisher = new WebsitePublisher()
 *   const files = await publisher.publish(packageId)
 *   // files → [{ fileName: 'index.html', content: '...' }, ...]
 */
export interface Publisher {
  name: string
  type: string

  /**
   * 读取 KnowledgePackage 并生成发布文件。
   * packageId 是 KnowledgePackage 表的 ID，Publisher 内部读取三张表。
   */
  publish(packageId: string): Promise<PublishFile[]>
}
