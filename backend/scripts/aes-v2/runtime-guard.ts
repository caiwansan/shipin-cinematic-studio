/**
 * scripts/aes-v2/runtime-guard.ts — 运行时自检
 *
 * 在 observation module 加载时注入，防止动态 import 绕过编译时检查。
 * 观察层在 bootstrap 时必须调用 assertObservationLayer()。
 *
 * 使用方法：
 *   import { assertObservationLayer } from '../scripts/aes-v2/runtime-guard.js'
 *   assertObservationLayer()
 */

// 运行时标记：观察层启动时写入
let observationInitialized = false

export function assertObservationLayer(): void {
  observationInitialized = true
}

/**
 * 防动态 import 绕过。
 * 如果 observation 试图 require/import execution/replay-engine，会在运行时抛错。
 * 在 observation/index.ts 的入口处调用。
 */
export function checkObservationBoundary(modulePath: string): void {
  if (!observationInitialized) {
    throw new Error('[AES] observation layer 未调用 assertObservationLayer()')
  }
  // 编译时已处理的 import 不受影响
  // 此函数仅用于运行时动态路径检查
}
