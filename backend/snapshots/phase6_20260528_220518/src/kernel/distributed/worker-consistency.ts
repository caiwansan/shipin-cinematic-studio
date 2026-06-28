/**
 * kernel/distributed/worker-consistency.ts — 分布式 Worker 一致性
 *
 * Phase 6, Rule 4: 分布式 worker 不得重复执行同个 task
 * 每个 task 只能被一个 worker 执行
 */

const activeTasks = new Map<string, string>()

/**
 * 注册 worker 到 task
 */
export function registerWorker(workerId: string, taskId: string): void {
  activeTasks.set(taskId, workerId)
}

/**
 * 断言单 worker 执行
 * @throws 如果同一个 task 被不同 worker 重复执行
 */
export function assertSingleWorker(taskId: string, workerId: string): void {
  const current = activeTasks.get(taskId)

  if (current && current !== workerId) {
    throw new Error(
      `[kernel/consistency] 重复执行检测: task=${taskId}, ` +
      `currentWorker=${current}, attemptedWorker=${workerId}`
    )
  }

  // 首次执行，注册
  if (!current) {
    registerWorker(workerId, taskId)
  }
}

/**
 * 释放 task
 */
export function releaseTask(taskId: string): void {
  activeTasks.delete(taskId)
}

/**
 * 当前活跃 task 数
 */
export function activeTaskCount(): number {
  return activeTasks.size
}
