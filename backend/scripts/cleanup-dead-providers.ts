/**
 * 清理脚本 — 移除硬编码 API_KEY 的死代码
 *
 * 这些旧 Provider 采用了 const API_KEY = '' 模式，
 * 已被 ModelAdapterRegistry 中的新 Adapter 取代。
 *
 * 注意：
 *   volcengine.image.ts — 无对应新 Adapter，需要保留内容但改造
 *   其余已有新 Adapter 的可安全删除
 *
 * 执行: rm -f 文件路径
 */

const DEAD_FILES = [
  // ❌ 旧 Video Provider — 被 model-adapters/video/volcengine-video.adapter.ts 取代
  '/root/shipin-cinematic-studio/backend/src/production-loop/video/volcengine.video.ts',
  // ❌ 旧 Mock Provider — Demo 用，应删除
  '/root/shipin-cinematic-studio/backend/src/production-loop/video/mock.video.ts',
  // ❌ 旧 Bailian Provider — 无配置 + 被新 adapter 取代
  '/root/shipin-cinematic-studio/backend/src/production-loop/video/bailian.video.ts',
  // ❌ 旧 Replicate Provider — 无配置
  '/root/shipin-cinematic-studio/backend/src/production-loop/video/replicate.video.ts',
  // ❌ 旧 Provider Registry — 被 init.ts 取代
  '/root/shipin-cinematic-studio/backend/src/production-loop/video/init.ts',
]

// 需要改造的文件
const FILES_TO_REFACTOR = [
  // ⚠️ volcengine.image.ts — 没有对应的 Model Adapter，需要保留并接入 Credential 注入
  '/root/shipin-cinematic-studio/backend/src/production-loop/video/volcengine.image.ts',
]

console.log('=== 死代码清理清单 ===')
DEAD_FILES.forEach(f => console.log(`  删除: ${f}`))
console.log('')
console.log('=== 待改造文件 ===')
FILES_TO_REFACTOR.forEach(f => console.log(`  改造: ${f}`))
