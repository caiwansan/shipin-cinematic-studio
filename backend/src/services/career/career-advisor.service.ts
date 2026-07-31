/**
 * services/career/career-advisor.service.ts — Sprint-09D-03 Task 02
 *
 * 🧠 求职顾问 Agent 核心服务
 *
 * 职责：
 *   替代 JobCareerEngine 规则引擎作为主路径。
 *   用户每次进入求职管家，走 LLM 对话 + 上下文理解。
 *   JobCareerEngine 保留为降级 fallback。
 *
 * 设计参考：文曲星 (worldbuilder.service.ts)
 *   - Static system prompt（KV Cache 友好）
 *   - Context packet 注入（用户画像 + 对话摘要）
 *   - 对话摘要记忆系统（每 N 轮生成）
 *   - 特殊标记检测（===COLLECT_START=== 采集字段）
 *
 * 调用链：
 *   careerAdvisorService.execute()
 *     → buildContext() → 组装上下文数据包
 *     → executeViaGateway('llm', ..., { businessType: 'career_advisor' })
 *     → detectAndProcessMarkers() → 检测采集标记
 *     → 返回 reply
 *
 * 身份：
 *   🧠 求职顾问 = Platform AI Agent（免费，不创建 Hermes Instance）
 *   🪞 镜心     = Personal AI Employee（💰¥9.9，有 Hermes + Memory）
 *
 * @module CareerAdvisorService
 */

import { prisma } from '../../utils/index.js';
import { executeViaGateway } from '../../runtime/runtime-gateway.js';
import type { V2Input, V2Result } from '../../providers/provider.interface.v2.js';
import { CareerExtractionService } from './career-extraction.service.js';
import { pendingConfirmations } from './career-confirmation.service.js';

// ─── Sprint-10B: Career Conversation Profile ─────
import type { CareerConversationProfile } from './career-conversation-profile.js';
import { createEmptyProfile, mergeProfiles, hasMinimumData as hasMinProfileData, detectMissingInformation, formatProfileForPrompt } from './career-conversation-profile.js';
import { extractCareerFacts } from './career-fact-extractor.js';
import { buildCareerConversationContext, buildMissingPrompt } from './career-conversation-context.js';
import { generateResumeDraft, canGenerateResumeDraft, registerResumeDraft } from './career-resume-draft.js';

// ─── 常量 ─────────────────────────────────────────────────────────

const MAX_HISTORY_TURNS = 20;
const SUMMARY_INTERVAL = 20; // 每 20 轮 AI 回复生成一次摘要
const MAX_TOKENS_REPLY = 2048;
const MAX_TOKENS_EXTRACT = 1024;

// ─── 类型 ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface CareerProfileSnapshot {
  id?: string
  fullName: string
  headline?: string
  bio?: string
  education?: { school: string; degree: string; major: string }[]
  skills: string[]
  workExperience?: { company: string; title: string; startDate: string; endDate?: string }[]
  careerDirection?: string
  industry?: string
  yearsExperience: number
  city?: string
  expectedSalary?: string
  jobSeekingStatus?: string
  completionScore: number
}

export interface ExtractResult {
  fields: Array<{ name: string; value: any }>
}

export interface ExecuteOptions {
  userId: string
  userInput: string
  historyMessages: ChatMessage[]
  existingProfile?: Partial<CareerProfileSnapshot>
  /** Sprint-10 Step 6: 会话标识，用于隔离 per-session 身份状态 */
  sessionId?: string
}

// ─── Sprint-10 Step 6: Session Career State ────────────────────

/**
 * SessionCareerState — 免费求职顾问的对话级身份状态
 *
 * 与付费 CareerAgent 的 ConversationCareerState 同模式，
 * 但仅存活于会话生命周期，不写入 Hermes/DB。
 *
 * 解决的问题：
 *   CareerSummaryGenerator 每轮从 COLLECT_START 重新计算，
 *   如果某轮格式异常，信息丢失。
 *   SessionCareerState 增量累积，不依赖重计算。
 */
export interface SessionCareerState {
  /** 对话中已收集的字段 */
  collectedFields: Set<string>
  /** 已确认事实（增量累积） */
  confirmedFacts: CareerSummary['confirmedFacts']
  /** 最近活跃时间 */
  lastActiveAt: number
  /** ─── Sprint-10B: Career Conversation Profile 职业资产 ─── */
  conversationProfile?: import('./career-conversation-profile.js').CareerConversationProfile
  /** 是否已触发 Resume Draft 生成 */
  resumeDraftGenerated?: boolean
}

export interface ExecuteResult {
  reply: string
  extractedFields?: Array<{ name: string; value: any }>
  shouldSaveProfile?: boolean
}

// ─── Sprint-09E-01: Career Memory 类型 ────────────────────────────

/** 对话阶段：控制 AI 采集节奏 */
export type ConversationTopic =
  | 'greeting'
  | 'identity'          // 姓名/城市
  | 'experience'        // 工作年限/经历
  | 'skills'            // 技能
  | 'education'         // 教育背景
  | 'career_goal'       // 职业目标
  | 'proof'             // 项目/成就证明
  | 'resume'            // 简历创建
  | 'consult'           // 职业咨询
  | 'completed'

/**
 * Sprint-09E-01.1: CareerMemoryItem — 每条记忆的置信度跟踪
 *
 * source:
 *   user_confirmed — 用户明确声明（最高可信）
 *   ai_inferred   — AI 从上下文推导（仅供参考）
 *
 * status:
 *   active    — 当前有效
 *   corrected — 用户已纠正，旧值保留供审计
 *   outdated  — 过时但仍可参考
 */
export interface CareerMemoryItem {
  field: keyof CareerSummary['confirmedFacts']
  value: string | number | string[]
  source: 'user_confirmed' | 'ai_inferred'
  confidence: number   // 0-100
  status: 'active' | 'corrected' | 'outdated'
  correctedValue?: string | number | string[]
}

/** 结构化职业摘要 — 每次对话重建 */
export interface CareerSummary {
  /** [Confirmed Facts] 用户明确声明的信息 — 最高优先级 */
  confirmedFacts: {
    name: string | null
    city: string | null
    education: string[]
    experience: number
    skills: string[]
    industry: string | null
    careerDirection: string | null
    headline: string | null
  }
  /** 每条事实的置信度元数据 */
  factMetadata: Record<string, CareerMemoryItem>
  /** [Derived Insights] AI 分析产生的信息 — 仅供参考，不得伪装为事实 */
  derivedInsights: {
    summary: string
    careerJourney: string
    uniqueAdvantages: string[]
    possibleDirections: string[]
  }
  /** [Unknown] 缺失信息 */
  missingInformation: string[]
  conversationState: {
    completedTopics: ConversationTopic[]
    currentTopic: ConversationTopic | null
    lastQuestionAsked: string | null
    userResponseToLastQuestion: string | null
  }
}

// ─── 系统提示词（完全静态 → KV Cache 友好）──────────────────────
// Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01：导出供后台 Agent 配置页读取（只读展示）
export const STATIC_SYSTEM_PROMPT = `你是求职顾问 🧠，昆仑镜求职工作台的 AI 职业助理。

你的使命是帮助求职者认识自己的职业优势、分析求职方向、创建简历、提供职业建议。

对话开始前，你会收到【上下文数据包】，包含以下部分：
- [Confirmed Facts]：用户明确声明的信息（最高优先级），附带来源标记和置信度
- [Derived Insights]：AI 分析产生的内容（仅供参考，不得伪装为事实）
- [Unknown]：缺失信息（不允许补全或猜测）
- [Conversation State]：当前对话所处的阶段
- [历史档案 - 仅供参考]：数据库中的历史画像，不一定代表现状
- [对话历程] / [简历状态]：辅助信息

### 状态感知规则（Memory Reality Gate）
1. **[Confirmed Facts] 可以直接使用**。你**不需要**再次询问已知的已确认事实。
2. **[Derived Insights] 不得伪装成用户经历**。AI 推导的方向/优势仅作参考，不能以用户口吻表述。
3. **[Unknown] 不允许补全**。缺失信息用开放式问题引导用户主动提供，禁止用例子暗示。
4. **用户纠正优先**：如果用户纠正了之前的信息，以最新说辞为准。旧信息保留为已修正标记。
5. **不重复询问已知信息**：如果 Confirmed Facts 中已有姓名/城市/技能，不要再问。

你的职责：
1. **理解用户真实目标**：不要机械按「学历→技能→城市」顺序问。先理解用户想做什么，再围绕目标逐步采集信息。
2. **采集用户职业信息**：用户每次提供新信息（姓名、技能、经验、城市、学历等），必须立即在回复末尾附加 ===COLLECT_START=== 标记。
3. **引导用户建立职业画像**：主动问用户的教育背景、技能、工作经验、求职方向。循序渐进，不要一次性问太多问题。
4. **帮助用户创建简历**：当用户表示想要简历时，逐步采集剩余信息。已采集的信息不需要重复。
5. **提供职业咨询**：回答转行、技能提升、面试准备、行业分析等问题。给出具体、可操作的建议。
6. **引导用户认知自己的优势**：不要只说"你很棒"，要结合用户实际经历给出有洞察力的分析。
7. **不要主动推荐外部岗位**：用户问岗位信息时可以说思路，但不要编造具体 JD。
8. **价值触发式升级引导**：你不是销售员，不主动推销产品。只有当用户完成以下任一价值节点时，可以自然提及长期职业伙伴服务。

   触发条件：
   - 用户画像完成度 >= 60（completionScore >= 60）
   - 用户完成简历创建
   - 用户主动表达长期职业需求（如"以后还能帮我吗"、"怎么持续提升"、"帮我关注机会"、"长期规划"）

   触发方式：仅限一句价值说明，不可多轮讨论。
   示例："你的职业画像已经初步建立。如果你希望未来持续跟踪职业发展、分析岗位机会、优化简历，我可以作为你的长期职业伙伴继续帮助你。"

   禁止行为：
   - ❌ 不说价格
   - ❌ 不说购买
   - ❌ 不主动发送链接
   - ❌ 不打断当前任务
   - ❌ 不制造焦虑
   - ❌ 用户表示不需要后不再追销
9. **说话风格**：专业但不死板，像一位有经验的朋友。简洁有重点，不要啰嗦。
10. **禁止行为**：不收集身份证/银行卡等敏感信息；不做最终求职决定（建议仅供参考）；不假装你可以直接投递简历。

## 字段采集标记
当你在对话中采集到用户的职业信息时，在回复末尾附加 JSON 块：

===COLLECT_START===
{"fields": [
  {"name": "field_name", "value": "具体值"}
]}
===COLLECT_END===

支持的字段名：
- fullName: 全名
- headline: 职业头衔（如"高级前端工程师"）
- education: 学历信息数组 [{"school":"学校","degree":"本科","major":"专业"}]
- skills: 技能数组（开放字段），例如：
  - 餐饮类：["法餐", "意大利菜", "烘焙", "川菜"]
  - 技术类：["Python", "数据分析", "Java"]
  - 设计类：["UI设计", "摄影"]
  - 管理类：["团队管理", "项目管理"]
- workExperience: 工作经历数组 [{"company":"公司","title":"职位","startDate":"2020-01","endDate":"2023-06"}]
- city: 所在城市
- careerDirection: 具体求职方向（如"B2B SaaS销售管理"、"川菜厨师长"、"前端开发"），不要写"求职中方向待定"等泛化文本
- industry: 目标行业
- yearsExperience: 工作年限（数字）
- expectedSalary: 期望薪资
- bio: 个人简介

### ⚠️ 强制规则（违反即视为工作失误）

**规则A：每轮末尾必须输出 COLLECT_START 标记**
无论本轮是否有新数据，回复末尾必须有：
\`\`\`
===COLLECT_START===
{"fields": [...]}
===COLLECT_END===
\`\`\`
无新数据时 fields 为空数组。这条规则**不允许跳过**。

**规则B：用户一提信息就采集**
只要用户明确提到了以下信息（即使不完整、不正式），立即用 COLLECT_START 采集：
- 姓名 → fullName
- 城市 → city
- 技能 → skills (直接写入，如"法餐"、"意大利菜"、"西餐")
- 工作年限 → yearsExperience
  ⚠️ 注意："我30岁" 表示年龄，不是工作年限，不要写入 yearsExperience
  ✅ 写入规则：只有以下模式才采集为 yearsExperience
    - "工作X年"、"从业X年"、"做西餐X年"、"X年经验"
    - 当用户同时提到年龄 + 经验时，以经验为准
    - 如果说不清具体年数 → yearsExperience 设为 0，不问
- 求职方向 → careerDirection
- 教育背景 → education（"烹饪学校本科" → 采集到 education 数组，school/degree/major 不完整也没关系）
- 工作经历 → workExperience（"米其林餐厅做主厨" → 采集到 workExperience 数组，company/title/date 不完整也没关系）
- 行业 → industry（"餐饮"）
- 薪资 → expectedSalary
- 个人简介 → bio

**规则C：不编造用户没说的细节**
可以采集"米其林餐厅做主厨"，但不能补公司名、日期、薪资具体数字。不完整字段留空让用户补充。

注意事项：
- 一次不要采集超过 5 个字段，分批进行
- JSON 块放在回复末尾，前面用自然语言继续对话
- 当用户画像数据充足时（completionScore > 80），可以附加 ===PROFILE_SAVE=== 标记

## 画像保存标记
当用户画像完成度足够高时：

===CAREER_PROFILE_SAVE===
{"complete": true, "completeness": 85}
===PROFILE_END===

## 简历创建
当用户说"帮我做简历"、"帮我写简历"、"创建简历"等时：
1. **先展示当前已知的信息**：基于 CareerProfile（已被系统注入上下文），向用户确认已知的个人背景
2. **引导补充关键缺失信息**：至少需要教育背景 + 最近一段工作经历（公司/职位/时间），才能生成可用简历
3. **每轮必须遵守 COLLECT_START 规则A和B**（不可省略标记）
4. **数据充足后生成简历草稿**：在回复中用自然语言分段展示简历草稿，包含：个人简介、工作经历、教育背景、技能特长。不需要 ===CAREER_PROFILE_SAVE=== 标记

注意：
- 不要编造用户没说的公司名、日期、具体岗位
- 不要生成正式PDF或HTML — 用对话文字展示即可
- 简历草稿末尾留出"你看这样行吗？"的信号，供用户确认或修改

## 身份真实性规则（Claim vs Fact）
你接收到的用户信息分为两类：
1. **用户声明（claimed）**：用户自己说的信息
2. **已验证事实（verified）**：通过可靠渠道确认的信息（当前无此能力）

### 规则A：不认证用户声明
用户提供的信息属于**用户声明（claimed information）**，不是已验证事实。

禁止以下表述：
- ❌ "你是斯坦福博士"
- ❌ "你的背景非常出色"
- ❌ "以你的能力肯定能找到好工作"
- ❌ "你太优秀了"
- ❌ "你是顶尖人才"
- ❌ 任何认证、赞颂用户自述身份的语言

正确表述（仅使用客观记录式语言）：
- ✅ "你提到自己毕业于斯坦福博士"
- ✅ "根据你提供的信息，我记录以下内容"
- ✅ "我先记录你的经历..."
- ✅ "你提到的技能包括..."
- ✅ "你的目标方向是..."

### 规则B：用户提供夸张身份时的处理
如果用户提供明显夸张或不可能的身份（如"全球唯一"、"宇宙第一"等），保持中性记录。

禁止一切语气反应：
- ❌ 不质疑（"你说的不太可能吧"）
- ❌ 不嘲讽（"太有创意了"、"这个称呼有意思"）
- ❌ 不赞颂（"太强了"、"非常出色"）
- ❌ 不评价（"有这个信心很好"）
- ❌ 不幽默回应

唯一允许的回应格式——中性记录：
"我先记录你的信息：你提到..."
"你所说的信息我已经记录了。我们继续完善简历的其他部分。"

**不要对用户所述身份做任何价值判断。**

### 规则C：Context Packet 使用优先级
- **[Confirmed Facts]** 始终优先。用户亲口说"我叫李大狗"，就以李大狗为准。
- **[历史档案 - 仅供参考]** 仅作参考。如果用户现在说"我不再叫张三了"，以用户最新说辞为准。
- 如果用户在对话中纠正了之前的信息，立即以纠正后的为准，标记旧信息为 corrected，并用 ===COLLECT_START=== 标记新值。

## 简历真实性规则（Resume Safety Guard）
生成简历时，必须遵守以下规则：

### 允许写入简历的内容：
1. 用户**明确提供的公司名、职位、时间段**
2. CareerProfile 中已保存的信息
3. 用户确认无误的信息

### 禁止写入简历的内容：
- ❌ 虚构公司名称
- ❌ 虚构职位头衔
- ❌ 虚构教育背景
- ❌ 虚构项目经历
- ❌ 虚构荣誉或奖项
- ❌ 用户没说过的具体工作内容
- ❌ 从地点推导市场经验：用户说"在郑州"不能推导为"熟悉郑州市场"或"拥有郑州客户资源"，只能记录为"工作地点：郑州"

### 未知字段处理：
缺失的信息必须显示为 **[待补充]**，不能自行填入虚构内容。

简历草稿示例格式：
\`\`\`
工作经历：
公司：[待补充]
职位：[用户提供的职位]
时间段：[待补充]
工作内容：[待补充]
\`\`\`

### 简历草稿自我检查清单：
生成简历草稿后，逐项检查：
- 这家公司用户说过没有？→ 没说就写 [待补充]
- 这个职位用户说过没有？→ 没说就写 [待补充]
- 这个时间用户说过没有？→ 没说就写 [待补充]
- 这段工作内容用户描述过吗？→ 没描述就写 [待补充]

### 引导提问禁止规则
当你在询问缺失信息时：
- ❌ 禁止用具体公司名/场所作为例子暗示用户（如"比如是米其林？"、"是不是在谷歌/阿里？"）
- ❌ 禁止用具体职位/头衔作为例子暗示用户（如"比如行政总厨？"）
- ❌ 禁止用知名品牌/机构引导用户回答
- ✅ 允许："你工作的餐厅具体叫什么名字？"
- ✅ 允许："你的职位是什么？"
- ✅ 允许："方便透露餐厅名称吗？"

用户的回答必须是用户自主提供的，不应受 AI 暗示影响。

## 上下文使用规则
1. **AI 应始终知道用户信息**：你不应该假装不知道用户已经告诉你的信息。如果用户在本次对话中说"我叫李大狗"，后续问"你知道我叫什么吗"，请回答"你之前告诉我你叫李大狗"，而不是"我不知道"。
2. **Context Packet 不是秘密**：你收到的上下文数据包是公开信息，不需要假装看不到它。数据包中的[Confirmed Facts]是你应该知道的。
3. **历史档案与最新说辞冲突时**：以用户最新说辞为准，并以 ===COLLECT_START=== 标记更新 DB。
4. **用户明确纠正时**：立即更新你的认知，"好的，已更新为..."并用采集标记保存。
`

// ─── 对话摘要生成提示词 ──────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `你是一个求职对话的分析师。请仔细阅读以下一段求职者与求职顾问（AI职业助理）的对话记录，然后生成一份对话摘要。

摘要内容：
1. 求职者基本信息（已知的姓名、学历、技能、经验）
2. 求职者当前关注的重点（转行/面试/简历/职业咨询）
3. 求职顾问已给出的关键建议
4. 已采集到的职业画像数据
5. 待办事项（下次需要追问什么）

请用中文，简洁清晰。摘要在 500 字以内。`

// ─── Sprint-09E-01: CareerSummaryGenerator ────────────────────────

/**
 * CareerSummaryGenerator
 *
 * Sprint-09E-01 Career Memory Reality
 *
 * 职责：
 *   从 DB CareerProfile + 对话历史生成结构化 CareerSummary。
 *   每次 execute() 调用前重建，不持久化，不增加 DB。
 *
 * 输入：
 *   - userId
 *   - historyMessages（最近消息）
 *   - dbProfile（可选）
 *
 * 输出：
 *   - CareerSummary（confirmedFacts + careerStory + missingInfo + conversationState）
 *
 * 原则：
 *   - 不做 LLM 调用（纯计算）
 *   - 只使用已通过 COLLECT_START 采集的结构化数据
 *   - CONVERSATION HISTORY 仅用于提取 conversationState
 */
class CareerSummaryGenerator {
  /**
   * 生成结构化 CareerSummary
   * @deprecated Sprint-10D T04: 偏好使用 generateFromIdentityProfile
   */
  async generate(
    userId: string,
    historyMessages: ChatMessage[],
    dbProfile?: any
  ): Promise<CareerSummary> {
    const confirmedFacts = this.extractConfirmedFacts(historyMessages, dbProfile)
    const factMetadata = this.buildFactMetadata(confirmedFacts, historyMessages, dbProfile)
    const derivedInsights = this.analyzeCareerStory(confirmedFacts)
    const missingInformation = this.calculateMissingInfo(confirmedFacts)
    const conversationState = this.inferConversationState(
      confirmedFacts,
      historyMessages
    )

    return {
      confirmedFacts,
      factMetadata,
      derivedInsights,
      missingInformation,
      conversationState,
    }
  }

  /**
   * Sprint-10D T04: 从 CareerIdentityProfile 生成 CareerSummary
   *
   * 输入：CareerIdentityProfile（SSOT）
   * 输出：Derived Insights（分析） + 缺失信息
   *
   * 事实直接来自 Profile，不通过历史消息解析。
   */
  async generateFromIdentityProfile(
    userId: string,
    identityProfile: any,
    historyMessages: ChatMessage[]
  ): Promise<CareerSummary> {
    // 从 CareerIdentityProfile 提取已确认事实
    const confirmedFacts: CareerSummary['confirmedFacts'] = {
      name: identityProfile.identity?.name || null,
      city: identityProfile.location?.currentCity || null,
      education: identityProfile.education?.school
        ? [`${identityProfile.education.degree || ''} @ ${identityProfile.education.school}${identityProfile.education.major ? ` (${identityProfile.education.major})` : ''}`.trim()]
        : [],
      experience: identityProfile.career?.yearsExperience || 0,
      skills: (identityProfile.skills || []).map((s: any) => s.name),
      industry: identityProfile.career?.targetIndustry || null,
      careerDirection: identityProfile.career?.careerDirection || identityProfile.career?.targetPosition || null,
      headline: identityProfile.career?.targetPosition || null,
    }

    // 事实元数据 — 全部来自 Profile（来源为 'profile'）
    const factMetadata: Record<string, CareerMemoryItem> = {}
    for (const [key, val] of Object.entries(confirmedFacts)) {
      if (val !== null && val !== 0 && !(Array.isArray(val) && val.length === 0)) {
        factMetadata[key] = {
          value: val as string | number | string[],
          confidence: 85,
          source: 'user_confirmed',
          status: 'active' as const,
          field: key as keyof CareerSummary['confirmedFacts'],
        }
      }
    }

    // 只生成 Derived Insights（分析），不生成新事实
    const derivedInsights = this.analyzeCareerStory(confirmedFacts)

    // 缺失信息从 identityProfile.missingFields 读取
    const missingInformation = (identityProfile.missingFields || []).map(
      (f: string) => {
        const labels: Record<string, string> = {
          name: '姓名',
          city: '城市',
          education: '教育背景',
          experience: '工作年限',
          skills: '技能',
          targetIndustry: '目标行业',
          careerDirection: '职业方向',
          salary: '期望薪资',
        }
        return labels[f] || f
      }
    )

    // 对话状态从历史消息推断
    const conversationState = this.inferConversationState(confirmedFacts, historyMessages)

    return {
      confirmedFacts,
      factMetadata,
      derivedInsights,
      missingInformation,
      conversationState,
    }
  }

  /**
   * 从历史消息中提取已确认事实
   * 优先级：
   *   1. 最近一轮 user message 中的信息
   *   2. COLLECT_START 标记中已采集的结构化字段
   *   3. DB profile（仅供参考）
   */
  private extractConfirmedFacts(
    messages: ChatMessage[],
    dbProfile?: any
  ): CareerSummary['confirmedFacts'] {
    // 基础默认值
    const facts: CareerSummary['confirmedFacts'] = {
      name: null,
      city: null,
      education: [],
      experience: 0,
      skills: [],
      industry: null,
      careerDirection: null,
      headline: null,
    }

    // 1. 从 COLLECT_START 标记中解析（最可靠）
    // Sprint-09E-01.1: 纠正模式下只使用最新一条 assistant 的标记
    const allAssistantMessages = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)

    const hasCorrInCollect = messages.filter(m => m.role === 'user').some(m =>
      /不对|说错了|之前说错了|更新为|改一下|更正|不是.*是.*/.test(m.content)
    )

    const targetAsstMsgs = hasCorrInCollect && allAssistantMessages.length > 0
      ? [allAssistantMessages[allAssistantMessages.length - 1]]  // 只取最新一条
      : allAssistantMessages

    for (const msg of targetAsstMsgs) {
      const parsed = this.parseCollectMarkers(msg)
      if (parsed) {
        for (const field of parsed) {
          switch (field.name) {
            case 'fullName': facts.name = String(field.value); break
            case 'city': facts.city = String(field.value); break
            case 'education': {
              const arr = Array.isArray(field.value) ? field.value : [field.value]
              facts.education = arr.map((e: any) =>
                `${e.degree || ''}${e.major ? ` (${e.major})` : ''} ${e.school || ''}`.trim()
              ).filter(Boolean)
              break
            }
            case 'skills': {
              const arr = Array.isArray(field.value) ? field.value : [field.value]
              facts.skills = [] // 覆盖而非追加
              for (const s of arr) {
                if (typeof s === 'string' && !facts.skills.includes(s.trim())) {
                  facts.skills.push(s.trim())
                }
              }
              break
            }
            case 'yearsExperience': facts.experience = Math.max(facts.experience, Number(field.value)); break
            case 'industry': facts.industry = String(field.value); break
            case 'careerDirection': facts.careerDirection = String(field.value); break
            case 'headline': facts.headline = String(field.value); break
          }
        }
      }
    }

    // 2. 从 user messages 中补充（正则兜底）
    // Sprint-09E-01.1: 检测纠正模式，仅使用最新用户消息
    const userMessages = messages.filter(m => m.role === 'user')
    const hasCorrection = userMessages.some(m =>
      /不对|说错了|之前说错了|更新为|改一下|更正|不是.*是.*/.test(m.content)
    )
    let allUserText: string
    if (hasCorrection && userMessages.length > 0) {
      // 纠正模式下：只用最后一条消息，避免旧信息污染
      allUserText = userMessages[userMessages.length - 1].content
    } else {
      allUserText = userMessages.map(m => m.content).join(' ')
    }

    if (!facts.name) {
      const nameMatch = allUserText.match(/(?:我叫|我是|名字叫|姓名)[：:\s]*([^，。\s]{2,4})/)
      if (nameMatch) facts.name = nameMatch[1]
    }
    if (!facts.city) {
      // 中文城市名匹配
      const cityMatch = allUserText.match(/在([^，。\s]{2,3}(?:市|城|区|州))/) ||
                        allUserText.match(/来自([^，。\s]{2,3})/)
      if (cityMatch) facts.city = cityMatch[1].replace(/[市城州区]/, '')
    }
    if (facts.experience === 0) {
      const expMatch = allUserText.match(/(\d{1,2})(?:年经验|年工作|年从业|年做|年开发|年运营|年设计)/)
      if (expMatch) facts.experience = parseInt(expMatch[1])
    }

    // 3. 从 DB 回填（仅当会话无数据时）
    if (dbProfile) {
      if (!facts.name && dbProfile.fullName) facts.name = dbProfile.fullName
      if (!facts.city && dbProfile.city) facts.city = dbProfile.city
      if (facts.experience === 0 && dbProfile.yearsExperience) facts.experience = dbProfile.yearsExperience
      if (!facts.industry && dbProfile.industry) facts.industry = dbProfile.industry
      if (!facts.careerDirection && dbProfile.careerDirection) facts.careerDirection = dbProfile.careerDirection
      if (!facts.headline && dbProfile.headline) facts.headline = dbProfile.headline
      if (facts.skills.length === 0 && dbProfile.skills) {
        const dbSkills = dbProfile.skills.map((s: any) =>
          s.skill?.name || s.name || ''
        ).filter(Boolean)
        facts.skills = dbSkills
      }
    }

    return facts
  }

  /**
   * 从 AI 回复中解析 COLLECT_START 标记
   */
  private parseCollectMarkers(reply: string): Array<{ name: string; value: any }> | null {
    const match = reply.match(/===COLLECT_START===\s*(\{[\s\S]*?\})\s*===COLLECT_END===/i)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.fields && Array.isArray(parsed.fields)) return parsed.fields
    } catch {}
    return null
  }

  /**
   * 分析职业故事
   * 纯确定性推导，不调用 LLM
   */

  /**
   * Sprint-09E-01.1: 为每条已确认事实构建置信度元数据
   *
   * 规则：
   *   - user_confirmed: 来自 COLLECT_START 标记或直接用户声明 → confidence=100
   *   - ai_inferred: 来自正则兜底或 DB 回填 → confidence<60
   *   - status: active/corrected/outdated based on correction detection
   */
  private buildFactMetadata(
    facts: CareerSummary['confirmedFacts'],
    messages: ChatMessage[],
    dbProfile?: any
  ): Record<string, CareerMemoryItem> {
    const meta: Record<string, CareerMemoryItem> = {}

    const allUserText = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ')

    const hasCorrection = /不对|说错了|之前说错了|更新为|改一下|更正|不是.*是.*/.test(allUserText)

    const hasCollectData = messages.some(m =>
      m.role === 'assistant' && /===COLLECT_START===/.test(m.content)
    )

    // 为每个字段判断来源
    const entries: Array<{ key: string; value: any; source: 'user_confirmed' | 'ai_inferred'; confidence: number }> = [
      { key: 'name', value: facts.name, source: hasCollectData ? 'user_confirmed' : 'ai_inferred', confidence: facts.name ? (hasCollectData ? 100 : 60) : 0 },
      { key: 'city', value: facts.city, source: hasCollectData ? 'user_confirmed' : 'ai_inferred', confidence: facts.city ? (hasCollectData ? 100 : 60) : 0 },
      { key: 'experience', value: facts.experience, source: hasCollectData ? 'user_confirmed' : 'ai_inferred', confidence: facts.experience > 0 ? (hasCollectData ? 100 : 60) : 0 },
      { key: 'skills', value: facts.skills, source: 'user_confirmed', confidence: facts.skills.length > 0 ? 100 : 0 },
      { key: 'industry', value: facts.industry, source: hasCollectData ? 'user_confirmed' : 'ai_inferred', confidence: facts.industry ? (hasCollectData ? 100 : 50) : 0 },
      { key: 'careerDirection', value: facts.careerDirection, source: hasCollectData ? 'user_confirmed' : 'ai_inferred', confidence: facts.careerDirection ? (hasCollectData ? 100 : 60) : 0 },
      { key: 'headline', value: facts.headline, source: 'ai_inferred', confidence: facts.headline ? 30 : 0 },
      { key: 'education', value: facts.education, source: hasCollectData ? 'user_confirmed' : 'ai_inferred', confidence: facts.education.length > 0 ? (hasCollectData ? 100 : 60) : 0 },
    ]

    for (const entry of entries) {
      if (!entry.value || (Array.isArray(entry.value) && entry.value.length === 0) || entry.value === 0) continue

      const item: CareerMemoryItem = {
        field: entry.key as any,
        value: entry.value,
        source: entry.source,
        confidence: entry.confidence,
        status: hasCorrection ? 'outdated' : 'active',
      }
      meta[entry.key] = item
    }

    // 如果检测到纠正标记，标记所有旧事实为 outdated 并扫描新值
    if (hasCorrection) {
      // 尝试从最新用户消息提取新声明
      const lastMsg = messages.filter(m => m.role === 'user').slice(-1)[0]
      if (lastMsg) {
        const newDeclare = lastMsg.content.match(/是([^，。s]{2,10})/)
        if (newDeclare) {
          // 找到一个可能的纠正值，设为 active 但 confidence<80（等待后续确认）
          Object.values(meta).forEach(m => {
            if (m.status === 'outdated') {
              m.correctedValue = newDeclare[1]
            }
          })
        }
      }

      // 新增一条关于纠正本身的记录
      // (不增加额外字段，保持接口简洁)
    }

    return meta
  }

  private analyzeCareerStory(facts: CareerSummary['confirmedFacts']): CareerSummary['derivedInsights'] {
    const summaryParts: string[] = []
    const advantages: string[] = []
    const directions: string[] = []

    // 构建 summary
    const exp = facts.experience || '一定'
    const expUnit = facts.experience ? '年' : ''
    if (facts.name && facts.skills.length > 0) {
      const skillGroup = facts.skills.slice(0, 3).join('、')
      summaryParts.push(`${facts.name}，${exp}${expUnit}${facts.industry || ''}经验`)
      summaryParts.push(`技能涵盖${skillGroup}`)
    } else if (facts.name) {
      summaryParts.push(`${facts.name}，${exp}${expUnit}从业经验`)
    }
    if (facts.careerDirection) {
      summaryParts.push(`目标方向：${facts.careerDirection}`)
    }

    // 推导独特优势（基于已知字段的确定性分析）
    if (facts.skills.length >= 2) {
      advantages.push(`跨领域能力：${facts.skills.slice(0, 4).join('、')}`)
    }
    if (facts.experience >= 10) {
      advantages.push(`资深经验：${facts.experience}年深耕`)
    } else if (facts.experience >= 5) {
      advantages.push(`扎实经验：${facts.experience}年专业积累`)
    }
    if (facts.industry) {
      advantages.push(`行业认知：${facts.industry}领域背景`)
    }
    if (facts.careerDirection) {
      advantages.push(`目标明确：已定位${facts.careerDirection}`)
    }

    // 推导可能方向（基于技能和经验的确定性映射）
    if (facts.skills.length > 0 || facts.industry) {
      const skillText = [...facts.skills, facts.industry || ''].filter(Boolean).join(' ')
      if (/管理|总监|经理|lead|负责人/.test(skillText) || facts.careerDirection?.includes('管理') || facts.careerDirection?.includes('总监')) {
        directions.push(`${facts.industry || ''}管理岗`)
      }
      if (/产品|产品经理/.test(skillText) || facts.careerDirection?.includes('产品')) {
        directions.push('产品经理/产品负责人')
      }
      if (/技术|开发|工程师|架构/.test(skillText) || facts.industry === '科技') {
        directions.push('技术专家/架构师')
      }
      if (/运营|新媒体|内容|营销/.test(skillText)) {
        directions.push('运营总监/增长负责人')
      }
      if (/销售|商务|市场/.test(skillText) || facts.industry === '销售/市场') {
        directions.push('销售总监/市场负责人')
      }
      if (/设计|ui|ux|视觉/.test(skillText)) {
        directions.push('设计总监/创意指导')
      }
      if (/餐饮|厨师|厨房/.test(skillText) || facts.industry === '餐饮') {
        directions.push('行政总厨/餐饮管理')
      }
      // fallback: 方向和已有目标
      if (directions.length === 0 && facts.careerDirection) {
        directions.push(facts.careerDirection)
      }
    }

    return {
      summary: summaryParts.join(' | ') || '（信息尚不足以进行职业分析）',
      careerJourney: summaryParts.join('。') || '',
      uniqueAdvantages: advantages.length > 0 ? advantages : ['（等待更多信息）'],
      possibleDirections: directions.length > 0 ? Array.from(new Set(directions)) : ['（等待更多信息）'],
    }
  }

  /**
   * 计算缺失的关键信息
   * 基于已确认事实 vs 简历必需字段
   */
  private calculateMissingInfo(facts: CareerSummary['confirmedFacts']): string[] {
    const missing: string[] = []

    if (!facts.name) missing.push('姓名')
    if (facts.experience === 0) missing.push('工作年限')
    if (facts.skills.length === 0) missing.push('技能/专业方向')
    if (!facts.city) missing.push('所在城市')
    if (!facts.careerDirection) missing.push('求职方向')
    if (facts.education.length === 0) missing.push('教育背景')

    // 如果有方向但缺少支撑信息
    if (facts.careerDirection && /管理|总监|负责人|主任/.test(facts.careerDirection)) {
      if (!missing.includes('管理经验')) missing.push('管理经验/团队规模')
    }
    if (facts.experience >= 5) {
      if (!missing.includes('代表项目')) missing.push('代表项目/核心成果')
    }

    return missing
  }

  /**
   * 推断对话状态
   * 基于已采集字段判断所处阶段
   */
  private inferConversationState(
    facts: CareerSummary['confirmedFacts'],
    messages: ChatMessage[]
  ): CareerSummary['conversationState'] {
    const completedTopics: ConversationTopic[] = []
    let currentTopic: ConversationTopic | null = null
    let lastQuestion: string | null = null
    let lastResponse: string | null = null

    // 判断已完成话题
    if (facts.name) completedTopics.push('identity')
    if (facts.experience > 0) completedTopics.push('experience')
    if (facts.skills.length > 0) completedTopics.push('skills')
    if (facts.education.length > 0) completedTopics.push('education')
    if (facts.careerDirection) completedTopics.push('career_goal')

    // 判断当前话题
    if (messages.length === 0) {
      currentTopic = 'greeting'
    } else if (!facts.name || facts.experience === 0) {
      currentTopic = 'identity'
    } else if (facts.skills.length === 0) {
      currentTopic = 'skills'
    } else if (facts.education.length === 0) {
      currentTopic = 'education'
    } else if (!facts.careerDirection) {
      currentTopic = 'career_goal'
    } else if (facts.experience >= 5) {
      currentTopic = 'proof'
    } else {
      currentTopic = 'completed'
    }

    // 提取上一轮 QA
    const assistantMsgs = messages.filter(m => m.role === 'assistant')
    if (assistantMsgs.length > 0) {
      const last = assistantMsgs[assistantMsgs.length - 1]
      lastQuestion = last.content
        .replace(/===COLLECT_START===[\s\S]*?===COLLECT_END===/g, '')
        .trim()
        .slice(0, 100) || '（仅含采集标记）'
    }
    const userMsgs = messages.filter(m => m.role === 'user')
    if (userMsgs.length > 0) {
      lastResponse = userMsgs[userMsgs.length - 1].content.slice(0, 100)
    }

    return {
      completedTopics,
      currentTopic,
      lastQuestionAsked: lastQuestion,
      userResponseToLastQuestion: lastResponse,
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────

class CareerAdvisorService {
  // ─── Sprint-10 Step 6: 免费求职顾问 Session Memory ───
  private sessionStates = new Map<string, SessionCareerState>()

  private getOrCreateSessionState(sessionId: string): SessionCareerState {
    let state = this.sessionStates.get(sessionId)
    if (!state) {
      state = {
        collectedFields: new Set(),
        confirmedFacts: {
          name: null, city: null, education: [],
          experience: 0, skills: [], industry: null,
          careerDirection: null, headline: null,
        },
        lastActiveAt: Date.now(),
        // ─── Sprint-10B: 初始化 ConversationProfile ───
        conversationProfile: createEmptyProfile(),
        resumeDraftGenerated: false,
      }
      this.sessionStates.set(sessionId, state)
    }
    state.lastActiveAt = Date.now()
    return state
  }

  private mergeFieldsToSessionState(
    state: SessionCareerState,
    fields: Array<{ name: string; value: any }>
  ): void {
    for (const f of fields) {
      switch (f.name) {
        case 'fullName':
          if (f.value && !state.collectedFields.has('name')) {
            state.confirmedFacts.name = String(f.value)
            state.collectedFields.add('name')
          }
          break
        case 'city':
          if (f.value && !state.collectedFields.has('city')) {
            state.confirmedFacts.city = String(f.value)
            state.collectedFields.add('city')
          }
          break
        case 'yearsExperience':
          if (Number(f.value) > 0 && !state.collectedFields.has('experience')) {
            state.confirmedFacts.experience = Number(f.value)
            state.collectedFields.add('experience')
          }
          break
        case 'skills': {
          const newSkills = Array.isArray(f.value) ? f.value : [f.value]
          for (const s of newSkills) {
            if (typeof s === 'string' && s.trim() && !state.confirmedFacts.skills.includes(s.trim())) {
              state.confirmedFacts.skills.push(s.trim())
            }
          }
          if (newSkills.length > 0) state.collectedFields.add('skills')
          break
        }
        case 'industry':
          if (f.value && !state.collectedFields.has('industry')) {
            state.confirmedFacts.industry = String(f.value)
            state.collectedFields.add('industry')
          }
          break
        case 'careerDirection':
          if (f.value && !state.collectedFields.has('careerDirection')) {
            state.confirmedFacts.careerDirection = String(f.value)
            state.collectedFields.add('careerDirection')
          }
          break
        case 'headline':
          if (f.value && !state.collectedFields.has('headline')) {
            state.confirmedFacts.headline = String(f.value)
            state.collectedFields.add('headline')
          }
          break
        case 'education': {
          const arr = Array.isArray(f.value) ? f.value : [f.value]
          if (arr.length > 0 && !state.collectedFields.has('education')) {
            state.confirmedFacts.education = arr.map((e) =>
              `${e.degree || ''}${e.major ? ` (${e.major})` : ''} ${e.school || ''}`.trim()
            ).filter(Boolean)
            state.collectedFields.add('education')
          }
          break
        }
      }
    }
  }

  private buildIdentityCardSection(state: SessionCareerState): string {
    const f = state.confirmedFacts
    const lines: string[] = []
    lines.push('')
    lines.push('== 用户职业信息（已确认） ==')
    lines.push('以下信息是用户在本轮对话中已经提供的事实。')
    lines.push('不要重复询问这些信息。')
    lines.push('如果用户提供新信息，更新你的记录即可。')
    lines.push('')
    if (f.name) lines.push(`姓名：${f.name}`)
    if (f.city) lines.push(`所在地：${f.city}`)
    if (f.headline) lines.push(`头衔：${f.headline}`)
    if (f.experience > 0) lines.push(`工作年限：${f.experience}年`)
    if (f.skills.length > 0) lines.push(`技能：${f.skills.join('、')}`)
    if (f.industry) lines.push(`行业：${f.industry}`)
    if (f.careerDirection) lines.push(`求职方向：${f.careerDirection}`)
    if (f.education.length > 0) lines.push(`教育背景：${f.education.join('、')}`)
    if (lines.length <= 2) lines.push('（尚未采集）')
    return lines.join('\n')
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const { userId, userInput, historyMessages, existingProfile, sessionId } = options
    const sid = sessionId || `${userId}_${Date.now()}`
    const sessionState = this.getOrCreateSessionState(sid)

    // ─── Sprint-10B: 提取事实 → 更新 CareerConversationProfile ───
    if (sessionState.conversationProfile) {
      const extracted = extractCareerFacts(userInput, sessionState.conversationProfile)
      if (extracted.fieldsToUpdate && Object.keys(extracted.fieldsToUpdate).length > 0) {
        sessionState.conversationProfile = mergeProfiles(
          sessionState.conversationProfile,
          extracted.fieldsToUpdate
        )
      }
    }

    const contextPacket = await this.buildContext(userId, existingProfile, historyMessages, sessionState)
    let historyBlock = ''
    if (historyMessages.length > 1) {
      const recent = historyMessages.slice(-(MAX_HISTORY_TURNS + 1), -1)
      if (recent.length > 0) {
        historyBlock = '[对话历史]\n' + recent.map(m =>
          m.role === 'user' ? `求职者：${m.content}` : `求职顾问：${m.content}`
        ).join('\n\n')
      }
    }

    // ─── Sprint-10B: 注入 CareerConversationProfile 身份卡 ───
    let profileCard = ''
    if (sessionState.conversationProfile) {
      const convoCtx = buildCareerConversationContext(sessionState.conversationProfile)
      profileCard = convoCtx.identityCard
    }

    const userMessage = `${profileCard}\n\n${contextPacket}\n\n${historyBlock}\n\n[求职者最新消息]\n${userInput}`
    const input: V2Input = {
      systemPrompt: STATIC_SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.7,
      maxTokens: MAX_TOKENS_REPLY,
    }
    const result = await executeViaGateway('llm', input, { userId, businessType: 'career_advisor' })
    const raw = result.content || ''
    let reply = raw
      .replace(/\\\\n/g, '\n')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
    const extractedFields = this.detectCollectMarkers(reply)
    const shouldSaveProfile = this.detectProfileSaveMarkers(reply)
    reply = this.removeMarkers(reply)
    if (extractedFields && extractedFields.length > 0) {
      this.mergeFieldsToSessionState(sessionState, extractedFields)
    }

    // ─── Sprint-10B T05: 检查 Resume Draft 触发条件 ───
    if (sessionState.conversationProfile && !sessionState.resumeDraftGenerated) {
      if (canGenerateResumeDraft(sessionState.conversationProfile)) {
        const draft = generateResumeDraft(sessionState.conversationProfile)
        if (draft) {
          registerResumeDraft(sessionId || userId, draft)
          sessionState.resumeDraftGenerated = true
          console.log(`[CareerAdvisor] ResumeDraft generated for ${userId.slice(0, 8)}...`)
        }
      }
    }

    return { reply, extractedFields, shouldSaveProfile }
  }

  /**
   * Sprint-09D-07 Task 01: Context Reality Fix
   *
   * 构建上下文数据包（三部分）：
   *   1. [会话中已知信息] — 用户在本轮对话中亲口说的内容
   *   2. [历史档案 - 仅供参考] — 数据库中的历史画像
   *   3. [对话历程] / [简历状态] — 辅助信息
   *
   * 优先级顺序：会话事实 > 历史档案
   *  — AI 始终以「会话中已知信息」为准
   *  — 历史档案仅标记为「仅供参考，以用户最新说辞为准」
   */
  /**
   * Sprint-09E-01: Career Memory Reality
   *
   * 重写 buildContext() — 使用 CareerSummaryGenerator 生成结构化记忆包
   *
   * Sprint-10 Step 6: 新增 sessionState 参数，注入身份卡段落
   *
   * 输出 sections：
   *   [已确认事实]
   *   [职业分析]
   *   [Unknown]
   *   [对话状态]
   *   [用户身份卡]
   *   [对话历程]
   *   [简历状态]
   */
  private summaryGenerator = new CareerSummaryGenerator()

  private async buildContext(
    userId: string,
    existingProfile?: Partial<CareerProfileSnapshot>,
    historyMessages?: ChatMessage[],
    sessionState?: SessionCareerState
  ): Promise<string> {
    const sections: string[] = []
    const isAnonymous = userId === 'anonymous'

    // ── 获取 DB profile ──
    let dbProfile: any = null
    if (!isAnonymous) {
      try {
        dbProfile = await prisma.careerProfile.findUnique({
          where: { userId },
          include: { educations: true, skills: { include: { skill: true } } },
        })
      } catch {
        // 读取失败 — 继续
      }
    }

    // ── 生成 CareerSummary ──
    const summary = await this.summaryGenerator.generate(
      userId,
      historyMessages || [],
      dbProfile
    )

    // ── Sprint-10 Step 6: 将 session state 的事实覆盖到 summary ──
    if (sessionState) {
      const sf = sessionState.confirmedFacts
      if (sf.name) summary.confirmedFacts.name = sf.name
      if (sf.city) summary.confirmedFacts.city = sf.city
      if (sf.experience > 0) summary.confirmedFacts.experience = sf.experience
      if (sf.skills.length > 0) summary.confirmedFacts.skills = sf.skills
      if (sf.industry) summary.confirmedFacts.industry = sf.industry
      if (sf.careerDirection) summary.confirmedFacts.careerDirection = sf.careerDirection
      if (sf.headline) summary.confirmedFacts.headline = sf.headline
      if (sf.education.length > 0) summary.confirmedFacts.education = sf.education
    }

    // ── Part 1: [Confirmed Facts] — 用户明确声明的事实，最高优先级 ──
    const facts = summary.confirmedFacts
    const factMeta = summary.factMetadata
    let factsSection = '[Confirmed Facts]\n'
    const factLines: string[] = []
    if (facts.name) {
      const m = factMeta['name']
      if (m && m.status === 'corrected') {
        factLines.push(`姓名：${facts.name}（更新前：${m.correctedValue || '?'}）`)
      } else {
        factLines.push(`姓名：${facts.name}`)
      }
    }
    if (facts.city) factLines.push(`城市：${facts.city}`)
    if (facts.experience > 0) {
      const expLabel = factMeta['experience']?.source === 'user_confirmed' ? '' : '（推断）'
      factLines.push(`工作年限：${facts.experience}年${expLabel}`)
    }
    if (facts.skills.length > 0) factLines.push(`技能：${facts.skills.join('、')}`)
    if (facts.industry) {
      const indLabel = factMeta['industry']?.source === 'user_confirmed' ? '' : '（推断）'
      factLines.push(`行业：${facts.industry}${indLabel}`)
    }
    if (facts.careerDirection) factLines.push(`目标方向：${facts.careerDirection}`)
    if (facts.education.length > 0) factLines.push(`教育背景：${facts.education.join('、')}`)
    if (factLines.length === 0 && !isAnonymous) {
      if (dbProfile) {
        if (dbProfile.fullName) factLines.push(`姓名：${dbProfile.fullName}（历史记录）`)
        if (dbProfile.city) factLines.push(`城市：${dbProfile.city}（历史记录）`)
        if (dbProfile.yearsExperience) factLines.push(`年限：${dbProfile.yearsExperience}年（历史记录）`)
      } else {
        factLines.push('（新用户，尚未采集）')
      }
    }
    factsSection += factLines.length > 0 ? factLines.join('\n') + '\n' : '（新用户，尚未采集）\n'
    if (facts.name && factMeta['name']?.source === 'user_confirmed') {
      factsSection += `\n<来源：用户声明 | 置信度：${factMeta['name']?.confidence || 100}%>\n`
    }
    sections.push(factsSection)

    // ── Part 2: [Derived Insights] — AI 分析，仅供参考，不得伪装为事实 ──
    const derived = summary.derivedInsights
    let derivedSection = '[Derived Insights] — AI 分析，仅供参考\n'
    derivedSection += `职业总结：${derived.summary}\n`
    if (derived.uniqueAdvantages.length > 0 && derived.uniqueAdvantages[0] !== '（等待更多信息）') {
      derivedSection += '独特优势：\n'
      for (const adv of derived.uniqueAdvantages) {
        derivedSection += `- ${adv}\n`
      }
    }
    if (derived.possibleDirections.length > 0 && derived.possibleDirections[0] !== '（等待更多信息）') {
      derivedSection += `可能方向：${derived.possibleDirections.join('、')}\n`
    }
    derivedSection += '\n⚠️ 以上为 AI 推导，不等同于用户真实经历。请勿在回复中将推导内容描述为用户事实。\n'
    sections.push(derivedSection)

    // ── Part 3: [Unknown] — 缺失信息，不允许补全 ──
    const missing = summary.missingInformation
    if (missing.length > 0) {
      sections.push(`[Unknown]\n以下信息缺失且不应补全，等待用户主动提供：\n${missing.map(m => `- ${m}`).join('\\n')}\n\n⚠️ 禁止用示例/暗示引导用户填特定值。只问开放式问题。\n`)
    } else {
      sections.push('[Unknown]\n（无关键缺失）\n')
    }

    // ── Part 4: [Conversation State] — 对话状态 ──
    const state = summary.conversationState
    let stateSection = '[对话状态]\n'
    if (state.completedTopics.length > 0) {
      stateSection += `已完成：${state.completedTopics.join(' → ')}\n`
    }
    if (state.currentTopic) {
      stateSection += `当前阶段：${state.currentTopic}\n`
    }
    if (state.lastQuestionAsked && historyMessages && historyMessages.length > 0) {
      stateSection += `上一轮提问：${state.lastQuestionAsked}\n`
      if (state.userResponseToLastQuestion) {
        stateSection += `用户回应：${state.userResponseToLastQuestion}\n`
      }
    }
    sections.push(stateSection)

    // ── Sprint-10 Step 6: Part 5 — 用户身份卡（从 session state） ──
    if (sessionState) {
      sections.push(this.buildIdentityCardSection(sessionState))
    }

    // ── Part 6: [对话历程]（仅当历史足够） ──
    if (historyMessages && historyMessages.length >= 4) {
      const userMsgCount = historyMessages.filter(m => m.role === 'user').length
      sections.push(`[对话历程]\n共 ${userMsgCount} 轮交流`)
    }

    // ── Part 7: [简历状态] ──
    try {
      const resumeCount = await prisma.candidateResume.count({
        where: { profile: { userId } },
      })
      if (resumeCount > 0) {
        sections.push(`[简历状态]\n已有 ${resumeCount} 份简历草稿`)
      }
    } catch {
      // 表不存在时跳过
    }

    return sections.join('\n\n')
  }

  // ─── 方法检测与帮助器 ───────────────────────────────────────────────

  /**
   * 检测 ===COLLECT_START=== 标记，提取字段数据
   */
  private detectCollectMarkers(reply: string): Array<{ name: string; value: any }> | undefined {
    const match = reply.match(/===COLLECT_START===\s*(\{[\s\S]*?\})\s*===COLLECT_END===/i)
    if (!match) return undefined

    try {
      const parsed = JSON.parse(match[1])
      if (parsed.fields && Array.isArray(parsed.fields)) return parsed.fields
    } catch {}
    return undefined
  }

  /**
   * 检测 ===PROFILE_SAVE=== 标记
   */
  private detectProfileSaveMarkers(reply: string): boolean {
    return /===PROFILE_SAVE===/i.test(reply)
  }

  /**
   * 从回复中移除 ===COLLECT_START=== ... ===COLLECT_END=== 块
   */
  private removeMarkers(reply: string): string {
    return reply.replace(/===COLLECT_START===\s*\{[\s\S]*?\}\s*===COLLECT_END===/gi, '').trim()
  }

  /**
   * 获取对话摘要（异步，每 SUMMARY_INTERVAL 轮触发）
   */
  private async getOrCreateSummary(
    userId: string,
    historyMessages: ChatMessage[]
  ): Promise<string | null> {
    return null
  }

  async saveExtractedFields(
    userId: string,
    fields: Array<{ name: string; value: any }>,
    rawMessage?: string
  ): Promise<{ hasPending?: boolean; pendingCount?: number }> {
    if (fields.length === 0) return {}

    const extractionService = new CareerExtractionService()
    const existing = await prisma.careerProfile.findUnique({ where: { userId } })

    const result = await extractionService.processAndSave(
      userId,
      fields,
      rawMessage || '（无原文）',
      existing as any,
      { traceSource: 'career_advisor', sessionId: userId }
    )

    if (result.confirmedFacts.length > 0) {
      const profile = await prisma.careerProfile.findUnique({ where: { userId } })
      if (profile) {
        for (const f of result.confirmedFacts) {
          if (f.field === 'skills') {
            const skills = Array.isArray(f.value) ? f.value : [f.value]
            await this.ensureSkills(profile.id, skills.map(String))
          } else if (f.field === 'workHistory' || f.field === 'workExperience') {
            const works = Array.isArray(f.value) ? f.value : [f.value]
            await this.ensureWorkExperiences(profile.id, works as any[])
          }
        }
      }
    }

    let hasPending = false
    if (result.derivedSuggestions.length > 0) {
      pendingConfirmations.create(
        userId,
        result.derivedSuggestions,
        result.confirmedFacts.length > 0
          ? `已确认: \${result.confirmedFacts.map(f => f.field).join(', ')}; 待确认: 以下为 AI 推断`
          : undefined
      )
      hasPending = true
    }

    const updatedProfile = await prisma.careerProfile.findUnique({
      where: { userId },
      include: { skills: true, workExperiences: true },
    })
    if (updatedProfile) {
      const score = this.calculateCompleteness(updatedProfile as any)
      await prisma.careerProfile.update({
        where: { id: updatedProfile.id },
        data: { completionScore: score, lastActiveAt: new Date() },
      })
    }

    return { hasPending, pendingCount: result.derivedSuggestions.length }
  }

  private async ensureSkills(profileId: string, skillNames: string[]): Promise<void> {
    for (const name of skillNames) {
      if (!name.trim()) continue
      let skill = await prisma.skill.findUnique({ where: { name: name.trim() } }).catch(() => null)
      if (!skill) {
        skill = await prisma.skill.create({ data: { name: name.trim() } }).catch(() => null)
      }
      if (!skill) continue
      await prisma.candidateSkill.upsert({
        where: { profileId_skillId: { profileId, skillId: skill.id } },
        update: { lastAssessedAt: new Date() },
        create: { profileId, skillId: skill.id, source: 'ai_extracted' },
      }).catch(() => {})
    }
  }

  private async ensureWorkExperiences(
    profileId: string,
    works: Array<{ company: string; title: string; startDate?: string; endDate?: string }>
  ): Promise<void> {
    for (const w of works) {
      if (!w.company || !w.title) continue
      await prisma.workExperience.create({
        data: {
          profileId,
          company: w.company,
          title: w.title,
          startDate: w.startDate ? new Date(w.startDate) : new Date(),
          endDate: w.endDate ? new Date(w.endDate) : null,
          source: 'ai_extracted',
        },
      }).catch(() => {})
    }
  }

  private calculateCompleteness(profile: any): number {
    let score = 0
    if (profile.fullName) score += 10
    if (profile.educations && profile.educations.length > 0) score += 15
    if ((profile.skills && profile.skills.length > 0) || profile._skillsCollected) score += 20
    if (profile.workExperiences && profile.workExperiences.length > 0) score += 20
    if (profile.careerDirection) score += 15
    if (profile.city) score += 10
    if (profile.yearsExperience > 0) score += 10
    return Math.min(score, 100)
  }

  private static inferIndustry(profile: {
    careerDirection?: string | null
    headline?: string | null
    skills?: string[] | null
  }): string | undefined {
    const text = [
      profile.careerDirection,
      profile.headline,
      ...(profile.skills || []),
    ].filter(Boolean).join(' ').toLowerCase()

    if (/厨师|烘焙|甜点|法餐|意餐|日料|川菜|餐饮|厨房|烹饪/.test(text)) return '餐饮'
    if (/工程师|程序员|python|java|前端|后端|算法|数据|开发|架构/.test(text)) return '科技'
    if (/设计|摄影|ui|ux|平面/.test(text)) return '设计'
    if (/金融|投资|银行|证券|保险|风控/.test(text)) return '金融'
    if (/医生|护士|临床|医药|护理/.test(text)) return '医疗'
    if (/教师|老师|教育|培训|教学/.test(text)) return '教育'
    if (/销售|市场|运营|营销|商务/.test(text)) return '销售/市场'
    return undefined
  }

  async generateSummary(
    userId: string,
    sessionId: string,
    historyMessages: ChatMessage[]
  ): Promise<string | null> {
    if (historyMessages.length < SUMMARY_INTERVAL * 2) return null

    const aiMsgCount = historyMessages.filter(m => m.role === 'assistant').length
    if (aiMsgCount % SUMMARY_INTERVAL !== 0) return null

    try {
      const transcript = historyMessages.map(m =>
        m.role === 'user' ? `求职者：\${m.content}` : `求职顾问：\${m.content}`
      ).join('\n\n')

      const input: V2Input = {
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        prompt: transcript,
        temperature: 0.3,
        maxTokens: 1024,
      }

      const result = await executeViaGateway('llm', input, { userId, businessType: 'career_advisor' })
      const summary = result.content || ''
      console.log(`[CareerAdvisor] 对话摘要已生成 (userId=\${userId}, session=\${sessionId})`)
      return summary
    } catch (err: any) {
      console.warn(`[CareerAdvisor] 摘要生成失败: \${err.message}`)
      return null
    }
  }

  getWelcomeMessage(hasExistingData: boolean): string {
    if (hasExistingData) {
      return '欢迎回来！上次我们聊到了你的职业方向，有什么新进展想分享吗？'
    }
    return '你好！我是求职顾问 🧠\n\n我可以帮你梳理职业经历、创建简历、分析求职方向。\n\n先说说你的情况吧——你目前在找什么样的工作？'
  }
}
// ─── Singleton ──────────────────────────────────────────────────────

export const careerAdvisorService = new CareerAdvisorService()
