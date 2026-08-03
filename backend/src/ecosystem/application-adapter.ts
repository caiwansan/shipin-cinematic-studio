/**
 * SPRINT-ECO-01 — Application Adapter Layer
 * 应用身份抽象层：让现有工作台拥有 Application Identity / Lifecycle /
 * Metadata / Capability Boundary，统一进入生态。
 *
 * 纪律（技术总监冻结）：
 * - Adapter 只负责「告诉生态平台这个应用是谁」
 * - 不负责业务，不执行任务，不改工作台代码
 * - 状态：BUILT_IN（平台内置）/ PUBLISHED（未来开发者应用）
 * - 生命周期：DRAFT → INSTALLED → ACTIVE → SUSPENDED → DEPRECATED
 */

export interface ApplicationMetadata {
  /** 应用唯一标识（slug）：kunlun-media */
  id: string;
  /** 显示名：Kunlun Media */
  name: string;
  /** 语义版本：1.0.0 */
  version: string;
  /** 分类：media | drama | novel | recruit | legal | mall | music | ad | geo */
  category: string;
  /** 图标 URL（可选） */
  icon?: string;
  /** 一句话描述 */
  description?: string;
}

export interface CapabilityDeclaration {
  /** 能力编码：media.read_metrics */
  code: string;
  /** 能力名称 */
  name: string;
  /** 能力描述 */
  description?: string;
  /** 关联插件挂载点（未来 ECO-02 使用）：media.analytics */
  mountPoint?: string;
}

export interface PermissionManifest {
  /** 权限编码：browser | content | analytics ... */
  permission: string;
  /** 权限名称 */
  name: string;
  /** 权限描述 */
  description?: string;
}

export interface HealthStatus {
  /** ok | degraded | unavailable */
  status: 'ok' | 'degraded' | 'unavailable';
  /** 最近检测时间 */
  checkedAt: string;
  /** 备注 */
  message?: string;
}

/**
 * Application Adapter 契约（冻结版，技术总监 2026-08-03 拍板）
 *
 * Adapter 职责边界：
 * ✅ getMetadata / getCapabilities / getWorkspaceEntry / getPermissionManifest / getHealthStatus
 * ❌ 执行任务 / 管理业务 / 修改工作台
 */
export interface ApplicationAdapter {
  /** 应用唯一标识 */
  readonly id: string;
  /** 显示名 */
  readonly name: string;
  /** 当前版本 */
  readonly version: string;

  /** 应用元数据（身份） */
  getMetadata(): ApplicationMetadata;
  /** 能力声明（供未来插件调用） */
  getCapabilities(): CapabilityDeclaration[];
  /** 工作台入口（前端路由，如 /workspaces/media） */
  getWorkspaceEntry(): string;
  /** 权限清单（browser/content/analytics...） */
  getPermissionManifest(): PermissionManifest[];
  /** 健康状态（真实检测，不伪造） */
  getHealthStatus(): Promise<HealthStatus>;
}
