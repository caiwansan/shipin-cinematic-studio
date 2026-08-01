/**
 * Sprint-09E-01 Reality Gate — Quick Verification
 *
 * Simulates CareerSummaryGenerator output given different user histories.
 * Run: npx tsx scripts/reality/09e01-verify-context.ts
 */

import { prisma } from '../../src/utils/index.js'
import { careerAdvisorService } from '../../src/services/career/career-advisor.service.js'

async function run() {
  const userId = 'reality-test-user-001'

  // ── Case 1: 不重复已知信息 ──
  console.log('\n===== CASE 1: 不重复已知信息 =====')
  const result1 = await careerAdvisorService.execute({
    userId: 'anonymous',
    userInput: '我叫李大牛，20年全栈开发',
    historyMessages: [],
  })
  console.log('Round 1:', result1.reply.slice(0, 200))

  const result2 = await careerAdvisorService.execute({
    userId: 'anonymous',
    userInput: '我想做技术总监',
    historyMessages: [
      { role: 'user', content: '我叫李大牛，20年全栈开发', timestamp: Date.now() - 60000 },
      { role: 'assistant', content: result1.reply, timestamp: Date.now() - 30000 },
    ],
  })
  const reply2 = result2.reply.toLowerCase()
  const hasRepeat = /你叫/.test(reply2) || /名字/.test(reply2) || /姓名/.test(reply2) || /工作.*年/.test(reply2) && /20/.test(reply2)
  console.log('Round 2:', result2.reply.slice(0, 300))
  console.log('❌ 重复已知信息:', hasRepeat ? 'FAIL' : 'PASS')

  // ── Case 3: 行业隔离 ──
  console.log('\n===== CASE 3: 行业隔离 =====')
  const result3 = await careerAdvisorService.execute({
    userId: 'anonymous',
    userInput: '我是厨师，帮我做简历',
    historyMessages: [
      { role: 'user', content: '我是厨师', timestamp: Date.now() - 60000 },
    ],
  })
  const reply3 = result3.reply.toLowerCase()
  const techTerms = ['python', '程序员', '技术背景', '代码', '开发', '编程']
  const found = techTerms.filter(t => reply3.includes(t))
  console.log('Reply excerpt:', result3.reply.slice(0, 200))
  console.log('❌ 出现技术词汇:', found.length > 0 ? `FAIL (${found.join(', ')})` : 'PASS')

  // ── Case 4: 用户纠正 ──
  console.log('\n===== CASE 4: 用户纠正 =====')
  const result4 = await careerAdvisorService.execute({
    userId: 'anonymous',
    userInput: '不对，我之前说错了，我不是开发，我是运营',
    historyMessages: [
      { role: 'user', content: '我是技术开发，做后端5年', timestamp: Date.now() - 60000 },
      { role: 'assistant', content: '好的，我记录你为技术开发背景。', timestamp: Date.now() - 30000 },
    ],
  })
  const reply4 = result4.reply.toLowerCase()
  console.log('Reply:', result4.reply.slice(0, 300))
  console.log('❌ 出现旧信息"后端"或"开发":', /后端|技术开发/.test(reply4) ? 'CHECK' : 'GOOD')
  console.log('❌ 出现纠正确认语:',
    /已.*更新|更新为|修改为|已修改|已记录.*运营/.test(reply4) ? 'GOOD' : 'CHECK')

  console.log('\n===== 验证完成 =====')
}

run().catch(console.error)
