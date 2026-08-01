/**
 * scripts/seed-ai-provider-directory.mjs
 * 昆仑镜 AI中心（AI Center）首批 12 家模型供应商目录（upsert by code，可重复执行）
 * 掌柜指令 2026-08-01：AI中心 = 统一 AI 生态入口（AI浏览器 / API模型接入 / 我的模型配置）
 * BYOK：本表仅聚合官方入口，不保存用户 Key、不代理充值、不代理第三方内容
 * loginUrl：AI迷你浏览器打开目标（官方登录/使用页）
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const providers = [
  // ─────────────── 国产 9 家 ───────────────
  {
    code: 'deepseek', name: 'DeepSeek', category: 'domestic', country: '中国',
    logo: '', description: '中国领先的推理模型，高性能、低成本的深度推理与代码能力，昆仑镜 AI 员工默认推荐模型。',
    tags: ['推理', '代码', 'Agent'], recommended: 5, sort: 1,
    officialWebsite: 'https://www.deepseek.com',
    registerUrl: 'https://platform.deepseek.com/sign_up',
    billingUrl: 'https://platform.deepseek.com/top_up',
    documentationUrl: 'https://api-docs.deepseek.com',
    loginUrl: 'https://chat.deepseek.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 95, speed: 85, quality: 88, chinese: 95, coding: 90, reasoning: 92 },
  },
  {
    code: 'zhipu', name: '智谱 GLM', category: 'domestic', country: '中国',
    logo: '', description: '国产全模态大模型平台，GLM 系列覆盖对话、推理、多模态理解与智能体开发。',
    tags: ['对话', '多模态', 'Agent'], recommended: 4, sort: 2,
    officialWebsite: 'https://open.bigmodel.cn',
    registerUrl: 'https://open.bigmodel.cn/usercenter/login',
    billingUrl: 'https://open.bigmodel.cn/usercenter/bill',
    documentationUrl: 'https://open.bigmodel.cn/dev/api',
    loginUrl: 'https://chatglm.cn',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 88, speed: 82, quality: 85, chinese: 93, coding: 85, reasoning: 86 },
  },
  {
    code: 'volcengine', name: '火山方舟', category: 'domestic', country: '中国',
    logo: '', description: '字节跳动旗下大模型服务平台，豆包系列模型 API 接入与推理服务。',
    tags: ['多模型', '豆包', '推理'], recommended: 4, sort: 3,
    officialWebsite: 'https://www.volcengine.com/product/ark',
    registerUrl: 'https://console.volcengine.com/ark',
    billingUrl: 'https://console.volcengine.com/finance',
    documentationUrl: 'https://www.volcengine.com/docs/82379',
    loginUrl: 'https://www.volcengine.com/product/ark',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 90, speed: 88, quality: 84, chinese: 92, coding: 80, reasoning: 82 },
  },
  {
    code: 'aliyun', name: '阿里百炼', category: 'domestic', country: '中国',
    logo: '', description: '阿里云大模型服务平台，通义千问 Qwen 系列 API 接入、微调与智能体编排。',
    tags: ['通义千问', '多模态', 'Agent'], recommended: 4, sort: 4,
    officialWebsite: 'https://bailian.aliyun.com',
    registerUrl: 'https://bailian.aliyun.com',
    billingUrl: 'https://bailian.console.aliyun.com/#/expense',
    documentationUrl: 'https://help.aliyun.com/zh/model-studio',
    loginUrl: 'https://bailian.aliyun.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 85, speed: 82, quality: 85, chinese: 93, coding: 86, reasoning: 84 },
  },
  {
    code: 'moonshot', name: '月之暗面 Kimi', category: 'domestic', country: '中国',
    logo: '', description: 'Kimi 大模型，超长上下文与深度推理能力，适合长文档分析与复杂任务。',
    tags: ['长文本', '推理', 'Agent'], recommended: 4, sort: 5,
    officialWebsite: 'https://www.moonshot.cn',
    registerUrl: 'https://platform.moonshot.cn/console',
    billingUrl: 'https://platform.moonshot.cn/console/balance',
    documentationUrl: 'https://platform.moonshot.cn/docs',
    loginUrl: 'https://kimi.moonshot.cn',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 80, speed: 76, quality: 87, chinese: 94, coding: 85, reasoning: 88 },
  },
  {
    code: 'tencent', name: '腾讯混元', category: 'domestic', country: '中国',
    logo: '', description: '腾讯混元大模型，覆盖对话、创作、多模态理解，腾讯云一站式接入。',
    tags: ['对话', '创作', '多模态'], recommended: 3, sort: 6,
    officialWebsite: 'https://hunyuan.tencent.com',
    registerUrl: 'https://console.cloud.tencent.com/hunyuan',
    billingUrl: 'https://console.cloud.tencent.com/expense',
    documentationUrl: 'https://cloud.tencent.com/document/product/1729',
    loginUrl: 'https://hunyuan.tencent.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 84, speed: 80, quality: 82, chinese: 90, coding: 78, reasoning: 80 },
  },
  {
    code: 'baidu', name: '文心一言', category: 'domestic', country: '中国',
    logo: '', description: '百度文心大模型，中文理解与创作能力强，千帆平台提供 API 与开发工具。',
    tags: ['对话', '创作', '中文'], recommended: 3, sort: 7,
    officialWebsite: 'https://yiyan.baidu.com',
    registerUrl: 'https://console.bce.baidu.com/qianfan',
    billingUrl: 'https://console.bce.baidu.com/billing',
    documentationUrl: 'https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html',
    loginUrl: 'https://yiyan.baidu.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 82, speed: 78, quality: 82, chinese: 92, coding: 76, reasoning: 80 },
  },
  {
    code: 'iflytek', name: '科大讯飞星火', category: 'domestic', country: '中国',
    logo: '', description: '讯飞星火大模型，语音与文本多模态能力，星火 API 开放平台。',
    tags: ['语音', '对话', '推理'], recommended: 3, sort: 8,
    officialWebsite: 'https://xinghuo.xfyun.cn',
    registerUrl: 'https://xinghuo.xfyun.cn/sparkapi',
    billingUrl: 'https://xinghuo.xfyun.cn/console',
    documentationUrl: 'https://www.xfyun.cn/doc/spark/Web.html',
    loginUrl: 'https://xinghuo.xfyun.cn',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 83, speed: 80, quality: 80, chinese: 90, coding: 74, reasoning: 78 },
  },
  {
    code: 'meituan', name: '美团龙猫', category: 'domestic', country: '中国',
    logo: '', description: '美团自研大模型生态，面向生活服务场景的 AI 能力开放平台。',
    tags: ['生活服务', '对话', 'Agent'], recommended: 3, sort: 9,
    officialWebsite: 'https://longmao.meituan.com',
    registerUrl: 'https://longmao.meituan.com',
    billingUrl: 'https://longmao.meituan.com',
    documentationUrl: 'https://longmao.meituan.com',
    loginUrl: 'https://longmao.meituan.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 86, speed: 78, quality: 78, chinese: 85, coding: 72, reasoning: 76 },
  },
  // ─────────────── 海外 3 家 ───────────────
  {
    code: 'openai', name: 'OpenAI ChatGPT', category: 'overseas', country: '美国',
    logo: '', description: '全球领先的通用人工智能公司，GPT 系列模型与 API 平台，多模态与推理能力标杆。',
    tags: ['对话', '推理', '多模态'], recommended: 5, sort: 10,
    officialWebsite: 'https://openai.com',
    registerUrl: 'https://platform.openai.com/signup',
    billingUrl: 'https://platform.openai.com/settings/organization/billing',
    documentationUrl: 'https://platform.openai.com/docs',
    loginUrl: 'https://chatgpt.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 62, speed: 88, quality: 95, chinese: 88, coding: 93, reasoning: 94 },
  },
  {
    code: 'google', name: 'Google Gemini', category: 'overseas', country: '美国',
    logo: '', description: '谷歌多模态大模型，原生多模态理解与长上下文，AI Studio 免费体验。',
    tags: ['多模态', '推理', '长文本'], recommended: 4, sort: 11,
    officialWebsite: 'https://gemini.google.com',
    registerUrl: 'https://aistudio.google.com',
    billingUrl: 'https://aistudio.google.com',
    documentationUrl: 'https://ai.google.dev',
    loginUrl: 'https://gemini.google.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 70, speed: 90, quality: 91, chinese: 82, coding: 90, reasoning: 90 },
  },
  {
    code: 'anthropic', name: 'Anthropic Claude', category: 'overseas', country: '美国',
    logo: '', description: 'Claude 系列模型，深度推理、长文本与代码能力出色，企业级 AI 应用首选之一。',
    tags: ['推理', '代码', '长文本'], recommended: 4, sort: 12,
    officialWebsite: 'https://claude.ai',
    registerUrl: 'https://console.anthropic.com',
    billingUrl: 'https://console.anthropic.com/settings/billing',
    documentationUrl: 'https://docs.anthropic.com',
    loginUrl: 'https://claude.ai',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 68, speed: 82, quality: 94, chinese: 84, coding: 94, reasoning: 95 },
  },
  // ─────────────── 非首批（停用保留） ───────────────
  {
    code: 'meta', name: 'Meta Llama', category: 'overseas', country: '美国',
    logo: '', description: 'Meta 开源大模型 Llama 系列，开放权重，可自部署，生态丰富。',
    tags: ['开源', '自部署', '推理'], recommended: 3, sort: 13,
    officialWebsite: 'https://www.llama.com',
    registerUrl: 'https://www.llama.com',
    billingUrl: 'https://www.llama.com',
    documentationUrl: 'https://www.llama.com/docs',
    loginUrl: 'https://www.llama.com',
    browserEnabled: true, apiEnabled: true,
    capabilityScore: { cost: 75, speed: 80, quality: 82, chinese: 70, coding: 84, reasoning: 82 },
    status: 'disabled',
  },
]

for (const p of providers) {
  await prisma.aiProviderDirectory.upsert({
    where: { code: p.code },
    update: { ...p },
    create: { ...p },
  })
}
const total = await prisma.aiProviderDirectory.count()
const active = await prisma.aiProviderDirectory.count({ where: { status: 'active' } })
console.log(`✅ seed 完成：共 ${total} 家（激活 ${active}，停用 ${total - active}）`)
await prisma.$disconnect()
