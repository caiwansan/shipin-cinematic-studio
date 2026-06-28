/**
 * scripts/aes-v3/index.ts — AES v3 主入口
 *
 * 执行顺序：
 *   1. 一致性检查（AST baseline vs Graph baseline）
 *   2. 重放确定性验证（可选，需要 replay result 输入）
 *
 * 退出码：0 = 通过，1 = 基线偏离
 */

import { checkConsistency } from './consistency-checker.js'

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  OpenClaw Architecture Enforcement v3')
  console.log('  Provable Architecture Integrity')
  console.log('═══════════════════════════════════════')

  const consistent = await checkConsistency()

  if (!consistent) {
    console.error('\n❌ AES v3: 架构基线偏离')
    console.error('   运行 npm run aes:baseline-update 更新基线')
    process.exit(1)
  }

  console.log('\n✅ AES v3: 架构完整性验证通过')
}

main().catch(err => { console.error(err); process.exit(1) })
