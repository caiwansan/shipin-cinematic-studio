/**
 * scripts/seed-ai-center-pricing.mjs — AI-CENTER-03 模型消费决策中心 价格/成本/余额接口 seed
 *
 * 掌柜指令（2026-08-01 修正版）：
 *   AI中心 = 全球 AI 模型消费决策中心（哪个AI适合我 / 多少钱 / 我的钱还剩多少）
 *   pricingInfo = 参考价（运营可改，展示标注「参考价，以官方为准」）
 *   costScore   = 价格优势分（运营维护，性价比 = 能力×60% + 价格×40%，纯计算无 AI）
 *   officialBalanceApi = 官方余额接口完整 URL（空 = 暂不支持余额查询；BYOK：Key 不落库）
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 参考价（元/百万 tokens，2026-08 公开价，以官方为准）
// AI-CENTER-04 运营标签 recommendTag：🔥新用户推荐 / 💰最省钱 / 🚀最强推理 / 🇨🇳中文最佳（后台可调）
const PRICING = {
  deepseek:    { pricingInfo: { inputPrice: 2,   outputPrice: 8,   currency: 'CNY' }, costScore: 90, balance: 'https://api.deepseek.com/user/balance',                                   models: ['DeepSeek-V3', 'DeepSeek-R1'], tag: '🔥 新用户推荐' },
  openai:      { pricingInfo: { inputPrice: 18,  outputPrice: 72,  currency: 'CNY' }, costScore: 35, balance: 'https://api.openai.com/v1/dashboard/billing/credit_grants',                  models: ['GPT-4o', 'GPT-4o mini', 'o3'], tag: '🚀 最强推理' },
  zhipu:       { pricingInfo: { inputPrice: 5,   outputPrice: 15,  currency: 'CNY' }, costScore: 75, balance: '',                                                                          models: ['GLM-4-Plus', 'GLM-4-Flash'], tag: '' },
  moonshot:    { pricingInfo: { inputPrice: 4,   outputPrice: 16,  currency: 'CNY' }, costScore: 72, balance: 'https://api.moonshot.cn/v1/users/me/balance',                              models: ['Kimi K2', 'moonshot-v1-32k'], tag: '🇨🇳 中文最佳' },
  volcengine:  { pricingInfo: { inputPrice: 0.8, outputPrice: 2,   currency: 'CNY' }, costScore: 95, balance: '',                                                                          models: ['Doubao-1.5-pro-32k', 'Doubao-1.5-lite-32k'], tag: '💰 最省钱' },
  aliyun:      { pricingInfo: { inputPrice: 2.4, outputPrice: 9.6, currency: 'CNY' }, costScore: 80, balance: '',                                                                          models: ['Qwen-Max', 'Qwen-Plus', 'Qwen-Turbo'], tag: '' },
  baidu:       { pricingInfo: { inputPrice: 20,  outputPrice: 60,  currency: 'CNY' }, costScore: 50, balance: '',                                                                          models: ['ERNIE-4.5', 'ERNIE-Speed'], tag: '' },
  tencent:     { pricingInfo: { inputPrice: 5,   outputPrice: 15,  currency: 'CNY' }, costScore: 70, balance: '',                                                                          models: ['Hunyuan-Turbo', 'Hunyuan-Lite'], tag: '' },
  iflytek:     { pricingInfo: { inputPrice: 8,   outputPrice: 20,  currency: 'CNY' }, costScore: 62, balance: '',                                                                          models: ['Spark-4.0', 'Spark-Lite'], tag: '' },
  meituan:     { pricingInfo: { inputPrice: 2,   outputPrice: 4,   currency: 'CNY' }, costScore: 88, balance: '',                                                                          models: ['LongCat-1.5'], tag: '' },
  google:      { pricingInfo: { inputPrice: 14,  outputPrice: 60,  currency: 'CNY' }, costScore: 45, balance: '',                                                                          models: ['Gemini-2.5-Pro', 'Gemini-2.5-Flash'], tag: '' },
  anthropic:   { pricingInfo: { inputPrice: 22,  outputPrice: 108, currency: 'CNY' }, costScore: 28, balance: '',                                                                          models: ['Claude-Sonnet-4', 'Claude-Opus-4'], tag: '' },
  meta:        { pricingInfo: { inputPrice: 4,   outputPrice: 16,  currency: 'CNY' }, costScore: 60, balance: '',                                                                          models: ['Llama-4', 'Llama-3.3'], tag: '' },
}

let updated = 0
for (const [code, cfg] of Object.entries(PRICING)) {
  const exist = await prisma.aiProviderDirectory.findUnique({ where: { code } })
  if (!exist) {
    console.log(`⚠️ 跳过（不存在）: ${code}`)
    continue
  }
  await prisma.aiProviderDirectory.update({
    where: { code },
    data: {
      pricingInfo: cfg.pricingInfo,
      costScore: cfg.costScore,
      officialBalanceApi: cfg.balance,
      supportedModels: cfg.models,
      recommendTag: cfg.tag,
      pricingUpdatedAt: new Date('2026-08-01T00:00:00+08:00'),
    },
  })
  updated++
  console.log(`✅ ${code}: ¥${cfg.pricingInfo.inputPrice}/${cfg.pricingInfo.outputPrice} · 价格分${cfg.costScore} · 余额API${cfg.balance ? '✔' : '—'} · ${cfg.models.length}模型`)
}
await prisma.$disconnect()
console.log(`ai_center_pricing seed 完成（${updated} 家）`)
