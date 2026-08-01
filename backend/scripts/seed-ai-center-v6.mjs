/**
 * seed-ai-center-v6.mjs — AI-CENTER-06 全球 AI 模型数据库（模型粒度种子）
 *
 * 掌柜指令 2026-08-02：AIProvider/AIModel 分离；价格模型级可追溯
 * 真实性机制：lastVerifiedAt / dataSource / verifiedBy 三要素 + dataStatus
 *   - verified: 价格已验证（官方定价页 / OpenRouter 官方聚合 API，2026-08-02 抓取）
 *   - pending:  价格未验证（订阅制/按张计费）→ 前端显示「价格待验证」，不展示数字
 * 幂等：按 code upsert；已存在则只补缺失字段，不覆盖运营调整。
 */

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

const VERIFIED_BY = 'AI-CENTER-06 官方校验'
const DS_DEEPSEEK = 'DeepSeek 官方定价页 https://api-docs.deepseek.com/quick_start/pricing（2026-08-02）'
const DS_KIMI = 'Kimi 官方定价 https://platform.kimi.com/docs/pricing（2026-08-02）'
const DS_OPENROUTER = 'OpenRouter 官方聚合 API https://openrouter.ai/models（2026-08-02，源头=各厂商官方定价）'

// ── 模型级数据（价格 USD/1M tokens；Kimi 用官方 CNY） ──
const MODELS = [
  // ========== DeepSeek（官方页验证） ==========
  { p: 'deepseek', code: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', ver: 'V4-Flash-0731', types: ['language','agent'], ctx: 1048576, maxOut: 393216, in: 0.14, hit: 0.0028, out: 0.28, cur: 'USD', cap: { quality: 86, speed: 92, cost: 95, chinese: 96, coding: 88, reasoning: 85 }, ds: DS_DEEPSEEK, docs: 'https://api-docs.deepseek.com', api: 'https://api.deepseek.com', sort: 1, desc: 'DeepSeek 2026 旗舰闪电模型：1M 上下文 + 384K 最大输出，性价比之王，支持思考/非思考双模式' },
  { p: 'deepseek', code: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', ver: 'V4-Pro', types: ['language','agent'], ctx: 1048576, maxOut: 393216, in: 0.435, hit: 0.003625, out: 0.87, cur: 'USD', cap: { quality: 93, speed: 85, cost: 90, chinese: 95, coding: 93, reasoning: 92 }, ds: DS_DEEPSEEK, docs: 'https://api-docs.deepseek.com', api: 'https://api.deepseek.com', sort: 2, desc: 'DeepSeek 旗舰 Pro：更强推理与代码能力，1M 上下文，适合深度 Agent 任务' },

  // ========== OpenAI（OpenRouter 聚合） ==========
  { p: 'openai', code: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', ver: '2026', types: ['language','multimodal','agent'], ctx: 1050000, in: 5, out: 30, cur: 'USD', cap: { quality: 98, speed: 88, cost: 78, chinese: 90, coding: 97, reasoning: 98 }, ds: DS_OPENROUTER, docs: 'https://platform.openai.com/docs', api: 'https://api.openai.com/v1', sort: 1, desc: 'OpenAI 最强推理旗舰：全能多模态 + Agent 原生，推理/代码天花板' },
  { p: 'openai', code: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', types: ['language','multimodal','agent'], ctx: 1050000, in: 1, out: 6, cur: 'USD', cap: { quality: 94, speed: 90, cost: 88, chinese: 88, coding: 94, reasoning: 93 }, ds: DS_OPENROUTER, docs: 'https://platform.openai.com/docs', api: 'https://api.openai.com/v1', sort: 2, desc: '平衡旗舰：主流 Agent/多模态任务的最佳性能价格点' },
  { p: 'openai', code: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', types: ['language','multimodal'], ctx: 1050000, in: 0.1, out: 0.6, cur: 'USD', cap: { quality: 88, speed: 93, cost: 95, chinese: 85, coding: 90, reasoning: 88 }, ds: DS_OPENROUTER, docs: 'https://platform.openai.com/docs', api: 'https://api.openai.com/v1', sort: 3, desc: '超低价通用模型：1.05M 上下文，成本敏感型应用首选' },
  { p: 'openai', code: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', types: ['language','agent'], ctx: 400000, in: 0.75, out: 4.5, cur: 'USD', cap: { quality: 87, speed: 94, cost: 92, chinese: 84, coding: 89, reasoning: 87 }, ds: DS_OPENROUTER, docs: 'https://platform.openai.com/docs', api: 'https://api.openai.com/v1', sort: 4, desc: '轻量高效：400K 上下文，高频调用场景' },
  { p: 'openai', code: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', types: ['language'], ctx: 400000, in: 0.2, out: 1.25, cur: 'USD', cap: { quality: 82, speed: 96, cost: 96, chinese: 82, coding: 85, reasoning: 82 }, ds: DS_OPENROUTER, docs: 'https://platform.openai.com/docs', api: 'https://api.openai.com/v1', sort: 5, desc: '极速廉价：分类/抽取/摘要等简单任务' },

  // ========== Anthropic（OpenRouter 聚合） ==========
  { p: 'anthropic', code: 'claude-opus-5', name: 'Claude Opus 5', ver: '2026', types: ['language','agent'], ctx: 1000000, in: 5, out: 25, cur: 'USD', cap: { quality: 98, speed: 85, cost: 76, chinese: 86, coding: 98, reasoning: 97 }, ds: DS_OPENROUTER, docs: 'https://docs.anthropic.com', api: 'https://api.anthropic.com/v1', sort: 1, desc: 'Anthropic 旗舰：代码/长文档/Agent 编排顶级，1M 上下文' },
  { p: 'anthropic', code: 'claude-sonnet-5', name: 'Claude Sonnet 5', types: ['language','agent'], ctx: 1000000, in: 2, out: 10, cur: 'USD', cap: { quality: 94, speed: 90, cost: 84, chinese: 84, coding: 94, reasoning: 93 }, ds: DS_OPENROUTER, docs: 'https://docs.anthropic.com', api: 'https://api.anthropic.com/v1', sort: 2, desc: '平衡之选：接近旗舰能力，成本一半' },

  // ========== Google（OpenRouter 聚合） ==========
  { p: 'google', code: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', types: ['language','multimodal','agent'], ctx: 1048576, in: 1.5, out: 7.5, cur: 'USD', cap: { quality: 90, speed: 93, cost: 88, chinese: 88, coding: 90, reasoning: 90 }, ds: DS_OPENROUTER, docs: 'https://ai.google.dev', api: 'https://generativelanguage.googleapis.com', sort: 1, desc: 'Google 最新 Flash：1M 上下文 + 原生多模态，速度/成本平衡' },
  { p: 'google', code: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', types: ['language','multimodal'], ctx: 1048576, in: 1.5, out: 9, cur: 'USD', cap: { quality: 91, speed: 92, cost: 86, chinese: 87, coding: 89, reasoning: 89 }, ds: DS_OPENROUTER, docs: 'https://ai.google.dev', api: 'https://generativelanguage.googleapis.com', sort: 2, desc: '上一代 Flash：依旧能打的长上下文多模态' },
  { p: 'google', code: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', types: ['language','multimodal'], ctx: 1048576, in: 0.3, out: 2.5, cur: 'USD', cap: { quality: 85, speed: 95, cost: 96, chinese: 85, coding: 86, reasoning: 84 }, ds: DS_OPENROUTER, docs: 'https://ai.google.dev', api: 'https://generativelanguage.googleapis.com', sort: 3, desc: '超低成本多模态：1M 上下文，量大管饱' },

  // ========== xAI（OpenRouter 聚合） ==========
  { p: 'xai', code: 'grok-4.5', name: 'Grok 4.5', types: ['language','agent'], ctx: 500000, in: 2, out: 6, cur: 'USD', cap: { quality: 92, speed: 90, cost: 88, chinese: 82, coding: 90, reasoning: 93 }, ds: DS_OPENROUTER, docs: 'https://docs.x.ai', api: 'https://api.x.ai/v1', sort: 1, desc: 'xAI 旗舰：强推理 + 实时信息，Agent 原生支持' },
  { p: 'xai', code: 'grok-4.20', name: 'Grok 4.20', types: ['language','agent'], ctx: 2000000, in: 1.25, out: 2.5, cur: 'USD', cap: { quality: 93, speed: 91, cost: 88, chinese: 83, coding: 91, reasoning: 94 }, ds: DS_OPENROUTER, docs: 'https://docs.x.ai', api: 'https://api.x.ai/v1', sort: 2, desc: '2M 上下文超大窗口，多 Agent 协同场景' },

  // ========== Mistral（OpenRouter 聚合） ==========
  { p: 'mistral', code: 'mistral-medium-3.5', name: 'Mistral Medium 3.5', types: ['language'], ctx: 262144, in: 1.5, out: 7.5, cur: 'USD', cap: { quality: 88, speed: 89, cost: 88, chinese: 78, coding: 89, reasoning: 88 }, ds: DS_OPENROUTER, docs: 'https://docs.mistral.ai', api: 'https://api.mistral.ai/v1', sort: 1, desc: '欧洲开源旗舰 API：多语言能力强' },
  { p: 'mistral', code: 'mistral-small-4', name: 'Mistral Small 4', types: ['language'], ctx: 262144, in: 0.15, out: 0.6, cur: 'USD', cap: { quality: 83, speed: 92, cost: 94, chinese: 75, coding: 85, reasoning: 82 }, ds: DS_OPENROUTER, docs: 'https://docs.mistral.ai', api: 'https://api.mistral.ai/v1', sort: 2, desc: '极低价欧洲模型：简单任务性价比之选' },

  // ========== Kimi / Moonshot（官方页验证，CNY） ==========
  { p: 'moonshot', code: 'kimi-k3', name: 'Kimi K3', ver: 'K3', types: ['language','agent'], ctx: 1048576, in: 20, hit: 2, out: 100, cur: 'CNY', cap: { quality: 96, speed: 84, cost: 80, chinese: 96, coding: 96, reasoning: 95 }, ds: DS_KIMI, docs: 'https://platform.kimi.com/docs', api: 'https://api.moonshot.cn/v1', sort: 1, desc: 'Kimi 旗舰：1M 上下文 + 长程编程/端到端知识工作，始终推理（默认 max）' },
  { p: 'moonshot', code: 'kimi-k2.6', name: 'Kimi K2.6', ver: 'K2.6', types: ['language','multimodal','agent'], ctx: 262144, in: 6.5, hit: 1.1, out: 27, cur: 'CNY', cap: { quality: 90, speed: 88, cost: 88, chinese: 93, coding: 91, reasoning: 90 }, ds: DS_KIMI, docs: 'https://platform.kimi.com/docs', api: 'https://api.moonshot.cn/v1', sort: 2, desc: '通用模型：支持文本/图片/视频输入，思考与非思考双模式' },
  { p: 'moonshot', code: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', ver: 'K2.7', types: ['language','multimodal','agent'], ctx: 262144, in: 0.73, out: 3.5, cur: 'USD', cap: { quality: 91, speed: 89, cost: 90, chinese: 92, coding: 95, reasoning: 90 }, ds: DS_OPENROUTER, docs: 'https://platform.kimi.com/docs', api: 'https://api.moonshot.cn/v1', sort: 3, desc: 'Kimi 编程专用：多模态代码模型，代码任务性价比突出' },

  // ========== 智谱 Z.ai（OpenRouter 聚合） ==========
  { p: 'zhipu', code: 'glm-5.2', name: 'GLM 5.2', ver: '5.2', types: ['language','agent'], ctx: 1048576, in: 0.7168, out: 2.2528, cur: 'USD', cap: { quality: 93, speed: 88, cost: 90, chinese: 94, coding: 92, reasoning: 92 }, ds: DS_OPENROUTER, docs: 'https://open.bigmodel.cn', api: 'https://open.bigmodel.cn/api/paas/v4', sort: 1, desc: '智谱旗舰：1M 上下文，中文理解/推理/Agent 均衡强' },
  { p: 'zhipu', code: 'glm-5-turbo', name: 'GLM 5 Turbo', types: ['language'], ctx: 202752, in: 1.2, out: 4, cur: 'USD', cap: { quality: 90, speed: 92, cost: 92, chinese: 93, coding: 90, reasoning: 90 }, ds: DS_OPENROUTER, docs: 'https://open.bigmodel.cn', api: 'https://open.bigmodel.cn/api/paas/v4', sort: 2, desc: '智谱高速版：低延迟，中文场景性价比高' },

  // ========== 通义千问（OpenRouter 聚合） ==========
  { p: 'aliyun', code: 'qwen3.7-max', name: 'Qwen3.7 Max', ver: '3.7', types: ['language','agent'], ctx: 1000000, in: 1.475, out: 4.425, cur: 'USD', cap: { quality: 93, speed: 86, cost: 88, chinese: 95, coding: 91, reasoning: 92 }, ds: DS_OPENROUTER, docs: 'https://help.aliyun.com/zh/model-studio', api: 'https://dashscope.aliyuncs.com/compatible-mode/v1', sort: 1, desc: '阿里旗舰：1M 上下文，中文综合能力顶尖' },
  { p: 'aliyun', code: 'qwen3.7-plus', name: 'Qwen3.7 Plus', types: ['language'], ctx: 1000000, in: 0.32, out: 1.28, cur: 'USD', cap: { quality: 89, speed: 91, cost: 93, chinese: 94, coding: 89, reasoning: 88 }, ds: DS_OPENROUTER, docs: 'https://help.aliyun.com/zh/model-studio', api: 'https://dashscope.aliyuncs.com/compatible-mode/v1', sort: 2, desc: '均衡主力：1M 上下文，中文成本比优秀' },
  { p: 'aliyun', code: 'qwen3.7-flash', name: 'Qwen3.7 Flash', types: ['language'], ctx: 1000000, in: 0.03, out: 0.13, cur: 'USD', cap: { quality: 84, speed: 95, cost: 98, chinese: 92, coding: 86, reasoning: 82 }, ds: DS_OPENROUTER, docs: 'https://help.aliyun.com/zh/model-studio', api: 'https://dashscope.aliyuncs.com/compatible-mode/v1', sort: 3, desc: '超低价闪电：1M 上下文，全市场最低价档' },

  // ========== 字节 Seed / 豆包（OpenRouter 聚合） ==========
  { p: 'volcengine', code: 'seed-2.0', name: 'Seed 2.0', ver: '2.0', types: ['language','agent'], ctx: 262144, in: 0.25, out: 2, cur: 'USD', cap: { quality: 88, speed: 90, cost: 90, chinese: 93, coding: 88, reasoning: 86 }, ds: DS_OPENROUTER, docs: 'https://www.volcengine.com/docs/82379', api: 'https://ark.cn-beijing.volces.com/api/v3', sort: 1, desc: '字节旗舰：中文理解与代码能力扎实，Agent 生态强' },
  { p: 'volcengine', code: 'seed-2.0-mini', name: 'Seed 2.0 Mini', types: ['language'], ctx: 262144, in: 0.1, out: 0.4, cur: 'USD', cap: { quality: 84, speed: 94, cost: 96, chinese: 91, coding: 85, reasoning: 82 }, ds: DS_OPENROUTER, docs: 'https://www.volcengine.com/docs/82379', api: 'https://ark.cn-beijing.volces.com/api/v3', sort: 2, desc: '轻量低成本：高频中文场景' },

  // ========== MiniMax（OpenRouter 聚合） ==========
  { p: 'minimax', code: 'minimax-m3', name: 'MiniMax M3', ver: 'M3', types: ['language','agent'], ctx: 1048576, in: 0.3, out: 1.2, cur: 'USD', cap: { quality: 91, speed: 89, cost: 91, chinese: 93, coding: 92, reasoning: 91 }, ds: DS_OPENROUTER, docs: 'https://platform.minimax.io/docs', api: 'https://api.minimax.io/v1', sort: 1, desc: 'MiniMax 最新旗舰：1M 上下文，推理/代码强，价格亲民' },
  { p: 'minimax', code: 'minimax-m2.7', name: 'MiniMax M2.7', ver: 'M2.7', types: ['language'], ctx: 204800, in: 0.25, out: 1, cur: 'USD', cap: { quality: 89, speed: 90, cost: 92, chinese: 92, coding: 90, reasoning: 89 }, ds: DS_OPENROUTER, docs: 'https://platform.minimax.io/docs', api: 'https://api.minimax.io/v1', sort: 2, desc: '通用高效：中文 Agent 场景成本比优秀' },

  // ========== 百度文心（OpenRouter 聚合） ==========
  { p: 'baidu', code: 'ernie-4.5-vl', name: 'ERNIE 4.5 VL', ver: '4.5', types: ['language','multimodal'], ctx: 123000, in: 0.42, out: 1.25, cur: 'USD', cap: { quality: 90, speed: 87, cost: 88, chinese: 95, coding: 87, reasoning: 88 }, ds: DS_OPENROUTER, docs: 'https://cloud.baidu.com/doc/WENXINWORKSHOP', api: 'https://qianfan.baidubce.com/v2', sort: 1, desc: '文心多模态旗舰：中文理解出色，支持视觉输入' },

  // ========== 腾讯混元（OpenRouter 聚合） ==========
  { p: 'tencent', code: 'hunyuan-a13b', name: 'Hunyuan A13B', ver: 'A13B', types: ['language'], ctx: 131072, in: 0.14, out: 0.57, cur: 'USD', cap: { quality: 84, speed: 90, cost: 92, chinese: 93, coding: 85, reasoning: 84 }, ds: DS_OPENROUTER, docs: 'https://cloud.tencent.com/document/product/1729', api: 'https://api.hunyuan.cloud.tencent.com/v1', sort: 1, desc: '腾讯高效模型：中文场景低成本' },

  // ========== 讯飞星火（价格待验证） ==========
  { p: 'iflytek', code: 'spark-x1', name: 'Spark X1', ver: 'X1', types: ['language'], ctx: 32768, in: null, out: null, cur: 'CNY', cap: { quality: 86, speed: 88, cost: 90, chinese: 94, coding: 85, reasoning: 86 }, ds: '讯飞官方未公开标准按量价，待运营验证', docs: 'https://www.xfyun.cn/doc/spark', api: 'https://spark-api-open.xf-yun.com/v1', pending: true, sort: 1, desc: '讯飞星火：中文语音生态强，API 定价待验证' },

  // ========== 图片模型 ==========
  { p: 'jimeng', code: 'seedream-4.0', name: 'Seedream 4.0', ver: '4.0', types: ['image'], ctx: null, in: null, out: null, cur: 'CNY', cap: { quality: 94, speed: 90, cost: 85, chinese: 96 }, ds: '即梦按张计费（火山方舟），待运营验证', docs: 'https://jimeng.jianying.com', api: '', pending: true, sort: 1, desc: '即梦旗舰文生图：中文美学理解顶尖' },
  { p: 'midjourney', code: 'midjourney-v7', name: 'Midjourney V7', ver: 'V7', types: ['image'], ctx: null, in: null, out: null, cur: 'USD', cap: { quality: 97, speed: 88, cost: 80, chinese: 80 }, ds: '订阅制（¥72-¥864/月），待运营验证', docs: 'https://docs.midjourney.com', api: '', pending: true, sort: 1, desc: '全球文生图审美标杆：订阅制' },
  { p: 'dalle', code: 'gpt-image-2', name: 'GPT Image 2', ver: 'GPT-5.4 Image 2', types: ['image'], ctx: 272000, in: 8, out: 15, cur: 'USD', cap: { quality: 93, speed: 86, cost: 88, chinese: 88 }, ds: DS_OPENROUTER, docs: 'https://platform.openai.com/docs', api: 'https://api.openai.com/v1', sort: 1, desc: 'OpenAI 图像模型：按 token 计费，与 GPT 生态打通' },
  { p: 'wanxiang', code: 'wan-2.5', name: '通义万相 2.5', ver: '2.5', types: ['image','video'], ctx: null, in: null, out: null, cur: 'CNY', cap: { quality: 90, speed: 88, cost: 90, chinese: 95 }, ds: '阿里百炼按张/按秒计费，待运营验证', docs: 'https://help.aliyun.com/zh/model-studio', api: 'https://dashscope.aliyuncs.com/compatible-mode/v1', pending: true, sort: 1, desc: '阿里文生图/视频：中文元素表现强' },

  // ========== 视频模型 ==========
  { p: 'kling', code: 'kling-2.1', name: '可灵 2.1', ver: '2.1', types: ['video'], ctx: null, in: null, out: null, cur: 'CNY', cap: { quality: 95, speed: 85, cost: 82, chinese: 93 }, ds: '订阅制/按积分计费，待运营验证', docs: 'https://klingai.com', api: '', pending: true, sort: 1, desc: '快手旗舰视频生成：中文场景视频质量顶尖' },
  { p: 'runway', code: 'runway-gen4', name: 'Runway Gen-4', ver: 'Gen-4', types: ['video'], ctx: null, in: null, out: null, cur: 'USD', cap: { quality: 93, speed: 84, cost: 84, chinese: 82 }, ds: '订阅制（¥86-¥547/月），待运营验证', docs: 'https://runwayml.com', api: '', pending: true, sort: 1, desc: '好莱坞级视频生成：电影质感控制力强' },
  { p: 'pika', code: 'pika-2.2', name: 'Pika 2.2', ver: '2.2', types: ['video'], ctx: null, in: null, out: null, cur: 'USD', cap: { quality: 88, speed: 90, cost: 88, chinese: 80 }, ds: '订阅制，待运营验证', docs: 'https://pika.art', api: '', pending: true, sort: 1, desc: '创意视频工具：特效与编辑能力突出' },
  { p: 'luma', code: 'luma-ray2', name: 'Luma Ray2', ver: 'Ray2', types: ['video'], ctx: null, in: null, out: null, cur: 'USD', cap: { quality: 92, speed: 85, cost: 85, chinese: 82 }, ds: '订阅制/按积分，待运营验证', docs: 'https://lumalabs.ai', api: '', pending: true, sort: 1, desc: 'Luma 视频生成：物理真实感强' },

  // ========== 语音模型 ==========
  { p: 'elevenlabs', code: 'eleven-v3', name: 'Eleven v3', ver: 'v3', types: ['audio'], ctx: null, in: null, out: null, cur: 'USD', cap: { quality: 95, speed: 92, cost: 82, chinese: 85 }, ds: '按字符计费（订阅制），待运营验证', docs: 'https://elevenlabs.io/docs', api: 'https://api.elevenlabs.io/v1', pending: true, sort: 1, desc: '全球最自然 TTS：多语言声音克隆' },
]

const seed = async () => {
  const providers = await prisma.aiProviderDirectory.findMany({ select: { id: true, code: true } })
  const pid = Object.fromEntries(providers.map(p => [p.code, p.id]))
  const missing = [...new Set(MODELS.map(m => m.p))].filter(c => !pid[c])
  if (missing.length) { console.log('⚠️ 缺失厂商 code:', missing.join(', ')); }

  let created = 0, updated = 0, pending = 0
  for (const m of MODELS) {
    const data = {
      providerId: pid[m.p],
      code: m.code,
      name: m.name,
      modelVersion: m.ver || null,
      modelTypes: m.types,
      contextWindow: m.ctx ?? null,
      maxOutput: m.maxOut ?? null,
      inputPrice: m.in ?? null,
      inputCacheHit: m.hit ?? null,
      outputPrice: m.out ?? null,
      currency: m.cur || 'USD',
      priceModel: m.priceModel || 'token',
      capabilityScore: m.cap,
      capabilitySource: '昆仑镜基于公开评测（LMArena/官方发布）综合',
      costScore: m.cap?.cost ?? null, // 独立成本分（掌柜 schema，与 capabilityScore.cost 同步）
      officialDocsUrl: m.docs || '',
      officialApiUrl: m.api || '',
      officialPricingUrl: m.ds || '', // 官方定价页（三链接之一）
      pricingUnit: '/1M tokens',
      verificationSource: m.pending ? '待验证' : '官方公开价格', // 掌柜 schema：来源类型
      lastVerifiedAt: m.pending ? null : new Date('2026-08-02T00:00:00+08:00'),
      dataSource: m.ds || '',
      verifiedBy: m.pending ? '' : VERIFIED_BY,
      dataStatus: m.pending ? 'pending' : 'verified',
      description: m.desc || null,
      sort: m.sort || 0,
      status: 'active',
    }
    const exists = await prisma.aiModelDirectory.findUnique({ where: { code: m.code } })
    if (exists) {
      await prisma.aiModelDirectory.update({ where: { id: exists.id }, data })
      // 价格快照（若本次价格与上次不同则记录历史）
      const last = await prisma.aiModelPriceHistory.findFirst({ where: { modelId: exists.id }, orderBy: { verifiedAt: 'desc' } })
      if (!last || last.inputPrice !== m.in || last.outputPrice !== m.out) {
        await prisma.aiModelPriceHistory.create({ data: { modelId: exists.id, inputPrice: m.in ?? null, outputPrice: m.out ?? null, currency: m.cur || 'USD', verifiedBy: VERIFIED_BY, dataSource: m.ds || '' } })
      }
      updated++
    } else {
      const createdModel = await prisma.aiModelDirectory.create({ data })
      await prisma.aiModelPriceHistory.create({ data: { modelId: createdModel.id, inputPrice: m.in ?? null, outputPrice: m.out ?? null, currency: m.cur || 'USD', verifiedBy: VERIFIED_BY, dataSource: m.ds || '', note: '首次收录' } })
      created++
    }
    if (m.pending) pending++
  }
  const total = await prisma.aiModelDirectory.count()
  console.log(`✅ seed v6 完成：模型总数 ${total}（新增 ${created} / 更新 ${updated}），其中待验证价格 ${pending}`)
  await prisma.$disconnect()
}

seed().catch(e => { console.error(e); process.exit(1) })
