/**
 * seed-ai-center-v5.mjs — AI-CENTER-05 全球AI模型性价比中心 · 首批模型分类种子
 *
 * 分类 modelTypes: language / image / video / audio / multimodal / agent
 *   - 语言: DeepSeek OpenAI Claude Gemini 智谱 Kimi 通义 腾讯混元 文心 讯飞
 *   - 图片: 即梦 Midjourney DALL-E 通义万相
 *   - 视频: 可灵 Runway Pika Luma
 *   - 语音: 讯飞 ElevenLabs
 *   - 多模态: GPT-5 Gemini Claude
 * 幂等：按 code upsert，只补新字段不覆盖运营已调的价格/标签。
 */

const prisma = (await import('@prisma/client')).PrismaClient ? await import('@prisma/client').then(m => new m.PrismaClient()) : null

// 参考价（元/百万 tokens，2026-08 公开价，以官方为准）
// costScore = 价格优势分（性价比 = 能力综合×60% + 价格×40%，纯计算无 AI）
const PRICE_MAP = {
  deepseek:    { input: 2,   output: 8,   cost: 90, tag: '🔥 新用户推荐', balance: 'https://api.deepseek.com/user/balance', models: ['DeepSeek-V3', 'DeepSeek-R1'] },
  openai:      { input: 18,  output: 72,  cost: 35, tag: '🚀 最强推理',   balance: 'https://api.openai.com/v1/dashboard/billing/credit_grants', models: ['GPT-5', 'GPT-4o', 'o3'] },
  zhipu:       { input: 5,   output: 15,  cost: 75, tag: '',              balance: '', models: ['GLM-4-Plus', 'GLM-4-Flash'] },
  moonshot:    { input: 4,   output: 16,  cost: 72, tag: '🇨🇳 中文最佳',   balance: 'https://api.moonshot.cn/v1/users/me/balance', models: ['Kimi K2', 'moonshot-v1-32k'] },
  volcengine:  { input: 0.8, output: 2,   cost: 95, tag: '💰 最省钱',      balance: '', models: ['Doubao-1.5-pro-32k', 'Doubao-1.5-lite-32k'] },
  aliyun:      { input: 2.4, output: 9.6, cost: 80, tag: '',              balance: '', models: ['Qwen-Max', 'Qwen-Plus', 'Qwen-Turbo'] },
  baidu:       { input: 20,  output: 60,  cost: 50, tag: '',              balance: '', models: ['ERNIE-4.5', 'ERNIE-Speed'] },
  tencent:     { input: 5,   output: 15,  cost: 70, tag: '',              balance: '', models: ['Hunyuan-Turbo', 'Hunyuan-Lite'] },
  iflytek:     { input: 8,   output: 20,  cost: 62, tag: '',              balance: '', models: ['Spark-4.0', 'Spark-Lite'] },
  google:      { input: 14,  output: 60,  cost: 45, tag: '',              balance: '', models: ['Gemini-2.5-Pro', 'Gemini-2.5-Flash'] },
  anthropic:   { input: 22,  output: 108, cost: 28, tag: '',              balance: '', models: ['Claude-Sonnet-4', 'Claude-Opus-4'] },
  meta:        { input: 4,   output: 16,  cost: 60, tag: '',              balance: '', models: ['Llama-4', 'Llama-3.3'] },
  jimeng:      { input: 0,   output: 0,   cost: 55, tag: '',              balance: '', models: ['Seedream-4.0', 'SeedEdit'] },      // 即梦·图片（按张计费，0=不适用）
  midjourney:  { input: 0,   output: 0,   cost: 30, tag: '',              balance: '', models: ['Midjourney V7', 'Niji'] },
  dalle:       { input: 0,   output: 0,   cost: 40, tag: '',              balance: '', models: ['DALL-E 3'] },
  wanxiang:    { input: 0,   output: 0,   cost: 65, tag: '',              balance: '', models: ['通义万相-2.1', '通义万相-视频'] },  // 通义万相
  kling:       { input: 0,   output: 0,   cost: 40, tag: '',              balance: '', models: ['可灵 2.1', '可灵 1.6'] },
  runway:      { input: 0,   output: 0,   cost: 35, tag: '',              balance: '', models: ['Gen-4', 'Gen-3 Alpha'] },
  pika:        { input: 0,   output: 0,   cost: 38, tag: '',              balance: '', models: ['Pika 2.0'] },
  luma:        { input: 0,   output: 0,   cost: 42, tag: '',              balance: '', models: ['Dream Machine', 'Ray2'] },
  elevenlabs:  { input: 0,   output: 0,   cost: 40, tag: '',              balance: '', models: ['Eleven Multilingual v2'] },
}

// 厂商资料：分类/国家/能力六维/描述/链接（注册/充值/文档）
const PROFILE = {
  deepseek:   { name: 'DeepSeek',     country: '中国', types: ['language', 'agent'], caps: { cost: 90, speed: 85, quality: 88, chinese: 95, coding: 90, reasoning: 90 }, modelName: 'DeepSeek-V3', ctx: 128000, desc: '中国开源大模型代表，性价比之王，代码与推理能力一线水平。', reg: 'https://platform.deepseek.com/sign_up', doc: 'https://api-docs.deepseek.com/' },
  openai:     { name: 'OpenAI',       country: '美国', types: ['language', 'multimodal', 'agent'], caps: { cost: 35, speed: 90, quality: 96, chinese: 82, coding: 95, reasoning: 95 }, modelName: 'GPT-5', ctx: 128000, desc: '全球 AI 领头羊，GPT-5 多模态与推理能力标杆。', reg: 'https://platform.openai.com/signup', doc: 'https://platform.openai.com/docs' },
  zhipu:      { name: '智谱AI',       country: '中国', types: ['language'], caps: { cost: 75, speed: 82, quality: 84, chinese: 90, coding: 82, reasoning: 85 }, modelName: 'GLM-4-Plus', ctx: 128000, desc: '清华系大模型，中文理解与 Agent 能力扎实。', reg: 'https://open.bigmodel.cn/', doc: 'https://open.bigmodel.cn/dev/api' },
  moonshot:   { name: 'Moonshot',     country: '中国', types: ['language'], caps: { cost: 72, speed: 80, quality: 85, chinese: 92, coding: 85, reasoning: 86 }, modelName: 'Kimi K2', ctx: 256000, desc: '长上下文专家，Kimi K2 开源后性价比突出。', reg: 'https://platform.moonshot.cn/', doc: 'https://platform.moonshot.cn/docs' },
  volcengine: { name: '火山方舟',     country: '中国', types: ['language'], caps: { cost: 95, speed: 88, quality: 82, chinese: 88, coding: 80, reasoning: 82 }, modelName: 'Doubao-1.5-pro', ctx: 256000, desc: '字节跳动大模型平台，价格全网最低一档。', reg: 'https://console.volcengine.com/ark', doc: 'https://www.volcengine.com/docs/82379' },
  aliyun:     { name: '阿里云百炼',   country: '中国', types: ['language', 'multimodal'], caps: { cost: 80, speed: 85, quality: 86, chinese: 91, coding: 85, reasoning: 84 }, modelName: 'Qwen-Max', ctx: 128000, desc: '通义千问 Qwen 系列，开源生态最完善。', reg: 'https://bailian.console.aliyun.com/', doc: 'https://help.aliyun.com/zh/model-studio' },
  baidu:      { name: '百度文心',     country: '中国', types: ['language'], caps: { cost: 50, speed: 78, quality: 80, chinese: 88, coding: 75, reasoning: 78 }, modelName: 'ERNIE-4.5', ctx: 128000, desc: '文心大模型 4.5 系列，国内老牌厂商。', reg: 'https://console.bce.baidu.com/qianfan/overview', doc: 'https://cloud.baidu.com/doc/WENXINWORKSHOP' },
  tencent:    { name: '腾讯混元',     country: '中国', types: ['language', 'multimodal'], caps: { cost: 70, speed: 80, quality: 82, chinese: 89, coding: 80, reasoning: 81 }, modelName: 'Hunyuan-Turbo', ctx: 128000, desc: '腾讯混元大模型，Turbo 版速度与成本均衡。', reg: 'https://cloud.tencent.com/product/hunyuan', doc: 'https://cloud.tencent.com/document/product/1729' },
  iflytek:    { name: '讯飞星火',     country: '中国', types: ['language', 'audio'], caps: { cost: 62, speed: 75, quality: 80, chinese: 90, coding: 72, reasoning: 78 }, modelName: 'Spark-4.0', ctx: 128000, desc: '星火大模型 + 语音识别/合成国家队。', reg: 'https://xinghuo.xfyun.cn/', doc: 'https://www.xfyun.cn/doc/spark' },
  google:     { name: 'Google',       country: '美国', types: ['language', 'multimodal'], caps: { cost: 45, speed: 88, quality: 92, chinese: 80, coding: 90, reasoning: 90 }, modelName: 'Gemini-2.5-Pro', ctx: 1000000, desc: 'Gemini 2.5 百万级上下文，多模态原生。', reg: 'https://aistudio.google.com/', doc: 'https://ai.google.dev/' },
  anthropic:  { name: 'Anthropic',    country: '美国', types: ['language', 'multimodal', 'agent'], caps: { cost: 28, speed: 82, quality: 94, chinese: 78, coding: 92, reasoning: 93 }, modelName: 'Claude-Sonnet-4', ctx: 200000, desc: 'Claude 4 系列，代码与长文写作口碑最佳。', reg: 'https://console.anthropic.com/', doc: 'https://docs.anthropic.com/' },
  meta:       { name: 'Meta',         country: '美国', types: ['language'], caps: { cost: 60, speed: 78, quality: 82, chinese: 70, coding: 78, reasoning: 80 }, modelName: 'Llama-4', ctx: 128000, desc: 'Llama 开源系列，全球开发者基础最大。', reg: 'https://llama.meta.com/', doc: 'https://www.llama.com/docs' },
  jimeng:     { name: '即梦AI',       country: '中国', types: ['image', 'video'], caps: { cost: 55, speed: 80, quality: 85, chinese: 88, coding: 0, reasoning: 0 }, modelName: 'Seedream-4.0', ctx: 0, desc: '字节旗下 AI 创作平台，图片/视频生成能力强。', reg: 'https://jimeng.jianying.com/', doc: 'https://jimeng.jianying.com/ai-tool/image' },
  midjourney: { name: 'Midjourney',   country: '美国', types: ['image'], caps: { cost: 30, speed: 70, quality: 95, chinese: 60, coding: 0, reasoning: 0 }, modelName: 'Midjourney V7', ctx: 0, desc: '艺术风格图像生成天花板，设计师首选。', reg: 'https://www.midjourney.com/', doc: 'https://docs.midjourney.com/' },
  dalle:      { name: 'OpenAI DALL·E',country: '美国', types: ['image'], caps: { cost: 40, speed: 75, quality: 88, chinese: 70, coding: 0, reasoning: 0 }, modelName: 'DALL-E 3', ctx: 0, desc: 'GPT 生态原生图像模型，API 接入最顺滑。', reg: 'https://platform.openai.com/signup', doc: 'https://platform.openai.com/docs/guides/images' },
  wanxiang:   { name: '通义万相',     country: '中国', types: ['image', 'video'], caps: { cost: 65, speed: 82, quality: 84, chinese: 90, coding: 0, reasoning: 0 }, modelName: '通义万相-2.1', ctx: 0, desc: '阿里通义视觉生成，中文 Prompt 理解好。', reg: 'https://bailian.console.aliyun.com/', doc: 'https://help.aliyun.com/zh/model-studio' },
  kling:      { name: '可灵AI',       country: '中国', types: ['video'], caps: { cost: 40, speed: 72, quality: 90, chinese: 88, coding: 0, reasoning: 0 }, modelName: '可灵 2.1', ctx: 0, desc: '快手可灵，国产视频生成第一梯队。', reg: 'https://klingai.com/', doc: 'https://app.klingai.com/global/dev' },
  runway:     { name: 'Runway',       country: '美国', types: ['video'], caps: { cost: 35, speed: 78, quality: 88, chinese: 60, coding: 0, reasoning: 0 }, modelName: 'Gen-4', ctx: 0, desc: '好莱坞级视频生成工具，专业影视工作流。', reg: 'https://app.runwayml.com/', doc: 'https://docs.runwayml.com/' },
  pika:       { name: 'Pika',         country: '美国', types: ['video'], caps: { cost: 38, speed: 80, quality: 84, chinese: 62, coding: 0, reasoning: 0 }, modelName: 'Pika 2.0', ctx: 0, desc: '轻量视频生成新锐，操作简单出片快。', reg: 'https://pika.art/', doc: 'https://pika.art/docs' },
  luma:       { name: 'Luma AI',      country: '美国', types: ['video'], caps: { cost: 42, speed: 76, quality: 86, chinese: 60, coding: 0, reasoning: 0 }, modelName: 'Dream Machine', ctx: 0, desc: 'Dream Machine 视频质量稳定，Ray2 物理模拟强。', reg: 'https://lumalabs.ai/', doc: 'https://lumalabs.ai/dream-machine' },
  elevenlabs: { name: 'ElevenLabs',   country: '美国', types: ['audio'], caps: { cost: 40, speed: 85, quality: 92, chinese: 70, coding: 0, reasoning: 0 }, modelName: 'Eleven v2', ctx: 0, desc: 'AI 语音克隆与多语言 TTS 全球最强。', reg: 'https://elevenlabs.io/', doc: 'https://elevenlabs.io/docs' },
}

const TYPE_EMOJI = { language: '💬', image: '🎨', video: '🎬', audio: '🎙️', multimodal: '🌐', agent: '🤖' }
const OVERSEAS = new Set(['openai', 'google', 'anthropic', 'meta', 'midjourney', 'dalle', 'runway', 'pika', 'luma', 'elevenlabs'])

let ok = 0
for (const [code, p] of Object.entries(PROFILE)) {
  const price = PRICE_MAP[code]
  const pricingInfo = price.input === 0 && price.output === 0
    ? { inputPrice: null, outputPrice: null, currency: 'CNY', note: '按用量计费，以官方为准' }
    : { inputPrice: price.input, outputPrice: price.output, currency: 'CNY' }
  await prisma.aiProviderDirectory.upsert({
    where: { code },
    update: {
      // 分类字段是本次新增，必补；价格/标签/能力不覆盖运营已调值（仅新厂商 create 时写入初值）
      modelName: p.modelName,
      modelTypes: p.types,
      contextLength: p.ctx,
      priceSource: '官方公开价格',
    },
    create: {
      code, name: p.name, country: p.country,
      category: OVERSEAS.has(code) ? 'overseas' : 'domestic',
      description: p.desc,
      tags: p.types.map(t => TYPE_EMOJI[t] + ' ' + t),
      officialWebsite: p.reg,
      registerUrl: p.reg,
      billingUrl: p.reg + (code === 'deepseek' ? '/top_up' : ''),
      documentationUrl: p.doc,
      loginUrl: p.reg,
      browserEnabled: false,
      browserMode: 'deprecated',
      apiEnabled: true,
      capabilityScore: p.caps,
      pricingInfo,
      costScore: price.cost,
      officialBalanceApi: price.balance || '',
      supportedModels: price.models,
      pricingUpdatedAt: new Date(),
      recommendTag: price.tag || '',
      recommended: ['deepseek', 'openai'].includes(code) ? 5 : ['anthropic', 'google'].includes(code) ? 4 : 3,
      sort: Object.keys(PROFILE).indexOf(code),
      status: 'active',
      modelName: p.modelName,
      modelTypes: p.types,
      contextLength: p.ctx,
      priceSource: '官方公开价格',
    },
  })
  ok++
  console.log(`✅ ${code}: ${p.types.join('/')} · ${p.modelName} · 价格分${price.cost} · ${price.models.length}模型`)
}
console.log(`\n🎯 共 ${ok} 家厂商分类完成（语言/图片/视频/语音/多模态/Agent）`)
await prisma.$disconnect()
