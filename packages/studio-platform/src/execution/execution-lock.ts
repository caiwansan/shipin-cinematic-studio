/**
 * Execution Lock Manager — 资源锁定接口
 *
 * 防止同一资源被并发执行的任务冲突访问。
 * 适用于：
 * - 同一个 project 不能被两个 KQ 工作流同时处理
 * - 同一个 asset 不能被两个处理任务同时修改
 * - 同一个 workspace 不能被两个同步操作同时操作
 *
 * @package @studio/platform/execution
 */

/**
 * ExecutionLockManager — 分布式锁接口
 *
 * 实现选择：
 * - 内存锁: 适用于单进程/测试环境
 * - Redis 锁: 适用于多进程/生产环境
 * - ZooKeeper 锁: 适用于大规模分布式系统
 *
 * 当前 C2 提供 InMemoryLockManager 作为默认实现。
 */
export interface ExecutionLockManager {
  /**
   * 尝试获取锁
   * @param resourceId - 资源标识符（如 projectId, assetId）
   * @param taskId - 请求锁的任务 ID
   * @param ttl - 锁的自动过期时间 (ms)
   * @returns 是否成功获取锁
   */
  acquire(resourceId: string, taskId: string, ttl: number): Promise<boolean>;

  /**
   * 释放锁
   * @param resourceId - 资源标识符
   * @param taskId - 持有锁的任务 ID
   */
  release(resourceId: string, taskId: string): Promise<void>;

  /**
   * 检查资源是否被锁定
   * @param resourceId - 资源标识符
   * @returns 是否被锁定
   */
  isLocked(resourceId: string): Promise<boolean>;
}

/**
 * InMemoryLockManager — 内存级锁实现
 *
 * 适用于：
 * - 测试环境
 * - 单进程开发环境
 * - 不需要跨进程同步的场景
 *
 * 不适用于：
 * - 多进程生产环境（应使用 Redis 锁）
 */
export class InMemoryLockManager implements ExecutionLockManager {
  private locks: Map<string, { taskId: string; expiresAt: number }> = new Map();

  async acquire(resourceId: string, taskId: string, ttl: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(resourceId);

    // 如果锁已存在且未过期，则获取失败
    if (existing && existing.expiresAt > now) {
      return false;
    }

    // 如果锁已过期，覆盖
    this.locks.set(resourceId, {
      taskId,
      expiresAt: now + ttl,
    });

    return true;
  }

  async release(resourceId: string, taskId: string): Promise<void> {
    const existing = this.locks.get(resourceId);
    if (existing && existing.taskId === taskId) {
      this.locks.delete(resourceId);
    }
  }

  async isLocked(resourceId: string): Promise<boolean> {
    const existing = this.locks.get(resourceId);
    if (!existing) return false;
    if (existing.expiresAt <= Date.now()) {
      this.locks.delete(resourceId);
      return false;
    }
    return true;
  }

  /**
   * 清理所有过期的锁（内部维护）
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.locks) {
      if (value.expiresAt <= now) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * 清除所有锁（测试用）
   */
  clear(): void {
    this.locks.clear();
  }

  /**
   * 获取当前锁数量
   */
  get size(): number {
    this.cleanExpired();
    return this.locks.size;
  }
}
