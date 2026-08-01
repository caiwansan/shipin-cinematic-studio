# Sprint-09E-01 Career Memory Reality

> **Audit Date:** 2026-07-31 01:00 CST
> **Status:** 审计完成 | 修复方案设计完成 | 待执行
> **Gate:** 掌柜 Sprint-09D-08 T05 验收 + T06 Memory Reality 修复启动

---

## 目录

1. [Task 01 — Context Packet Reality Audit](#task-01--context-packet-reality-audit)
2. [Task 02 — Career Context Gap Analysis](#task-02--career-context-gap-analysis)
3. [Task 03 — Career Memory Layer 设计](#task-03--career-memory-layer-设计)
4. [Task 04 — Reality Test 设计](#task-04--reality-test-设计)
5. [Task 05 — 执行计划](#task-05--执行计划)

---

## Task 01 — Context Packet Reality Audit

### 审计对象

**运行时**（dist JS）：

```
backend/dist/backend/src/services/career/career-advisor.service.js
```

**构建时间**：2026-07-30 21:56（已部署，真实运行）
**源文件**：`backend/src/services/career/career-advisor.service.ts`（2026-07-30 23:53 — 更新但未构建部署）

### 运行时架构

```
用户输入
  ↓
careerAdvisorService.execute()
  ├── buildContext()          ← 当前审计点
  │   ├── [用户信息]           ← DB CareerProfile raw fields
  │   ├── [对话历程摘要]       ← 占位符（最后一条消息主题）
  │   └── [简历状态]           ← resume count
  ├── STATIC_SYSTEM_PROMPT    ← 静态（KV Cache 友好 ✅）
  ├── [对话历史]              ← 最近20轮历史
  ├── [求职者最新消息]        ← 当前输入
  ↓
executeViaGateway('llm', ...)
  ↓
LLM 回复 → detect markers → 返回
```

### 运行时的 BuildContext 完整输出示例

当用户「李大牛，20年全栈开发」进入第二轮时，context packet 内容为：

```
[用户信息]
姓名：李大牛
教育背景：（未采集）
技能：（未采集）
目标方向：（未设定）
工作年限：0年
求职状态：not_looking
画像完整度：0/100

[对话历程摘要]
共 1 轮用户消息。最近对话主题：我叫李大牛，20年全栈开发

[简历状态]
已有 0 份简历草稿
```

### 源文件的 BuildContext（更新版，未部署）

```
[会话中已知信息]
（以下信息来自本轮会话中用户亲口所述）
姓名：李大牛
用户提到的技能关键词：全栈开发
工作年限：20年

[历史档案 - 仅供参考]
（新用户，无历史档案）

[对话历程]
（null — <4轮时不生成）
```

### 对比结论

| 维度 | 运行时（当前真实） | 源文件（已修改未部署） |
|------|-------------------|----------------------|
| 用户信息源 | 仅 DB（新用户为空） | 会话事实优先 + DB 参考 |
| 信息提取 | 无提取，读 DB raw | 正则提取（我叫/我是/技能关键词/年限） |
| 摘要 | 占位符（最后msg截取100字） | 同上 |
| 结构化 | 纯文本拼接 | 纯文本拼接 |

**核心问题不变量**：无论哪个版本，Context Packet 都是**纯文本拼接**，缺少结构化的职业记忆层。

---

## Task 02 — Career Context Gap Analysis

### 目标 Context Packet（理想状态）

```json
{
  "confirmedFacts": {
    "name": "李大牛",
    "city": "郑州",
    "experience": 20,
    "skills": ["全栈开发", "系统开发", "新媒体运营"],
    "industry": "科技",
    "careerDirection": "技术总监"
  },
  "careerStory": {
    "summary": "20年技术开发背景，经历商城系统、电商工具、新媒体运营、电话营销工具开发",
    "uniqueAdvantages": ["技术深度", "业务理解", "AI应用实践", "复合能力"],
    "possibleDirections": ["技术总监", "AI产品经理", "技术负责人"]
  },
  "missingInformation": [
    "团队管理规模",
    "代表项目详情",
    "技术架构经验",
    "管理年限"
  ],
  "conversationState": {
    "completedTopics": ["基础身份", "职业经历"],
    "currentTopic": "能力证明",
    "nextTopic": "目标定位",
    "lastQuestionAsked": "你过去负责过哪些核心项目？有没有带团队经验？"
  }
}
```

### 差距矩阵

| 字段 | 当前状态 | 理想状态 | 差距 | 严重度 |
|------|---------|---------|------|--------|
| **confirmedFacts** | 无结构，散落在纯文本中 | 结构化 JSON | ❌ 完全缺失 | 🔴 P0 |
| **careerStory** | 无 AI 分析 | AI 推导的职业叙事 | ❌ 完全缺失 | 🔴 P0 |
| **possibleDirections** | 无推导 | 基于经历的多方向分析 | ❌ 完全缺失 | 🟡 P1 |
| **missingInformation** | 隐含在 completionScore 中 | 明确列表 | ❌ 缺失 | 🟡 P1 |
| **conversationState** | 无 | 已完成/当前/下一步 | ❌ 完全缺失 | 🔴 P0 |
| **userFacts 优先级** | 无 | 会话事实 > DB 档案 | ⚠️ 源文件已修复但未部署 | 🔴 P0 |
| **用户纠正处理** | 无（源文件 system prompt 有规则） | 最新表达覆盖旧判断 | ⚠️ 仅在 prompt 层 | 🟡 P2 |
| **摘要生成** | 占位符（100字截取） | 结构化摘要 | ❌ 严重不足 | 🔴 P0 |
| **跨轮连续性** | 无机制保证 | Memory + State 注入 | ❌ 完全缺失 | 🔴 P0 |

### 根因总结

```
根本问题 ── Context Architecture 缺陷，不是 Prompt 问题
              │
     ┌────────┼────────┐
     │        │        │
 无结构化   无状态机   无摘要机制
 职业画像   控制对话   压缩历史
                                              
     ↓        ↓        ↓
                                              
 AI 每轮：
 1. 不知道已确认什么
 2. 不知道还缺什么
 3. 不知道问什么
 4. 读历史像读小说
 5. 重复采集已确认信息
```

---

## Task 03 — Career Memory Layer 设计

### 架构

```
CareerProfile (DB)
    +
Conversation History (messages)
    +
System Prompt (static)
    │
    ▼
Career Summary Generator  ← 新增
    │
    ▼
Career Context Packet     ← 重写 buildContext()
    │
    ▼
LLM
```

### 设计原则

1. **不新建 DB 表** — CareerSummary 只作为内存结构 + 缓存
2. **不做 Function Calling** — 不改变 LLM 调用管道
3. **不改 Runtime** — 只修改 context 构建层
4. **保持 KV Cache 友好** — system prompt 不变，context 动态注入
5. **最小改动** — 只改 `career-advisor.service.ts` 的 buildContext + 新增一个 CareerSummary 生成模块

### CareerSummary 结构

```typescript
interface CareerSummary {
  // ── 已确认事实（从会话中提取 + DB 回填）──
  confirmedFacts: {
    name: string | null
    city: string | null
    education: string[]              // ["学校-专业-学位"]
    experience: number               // 工作年限
    skills: string[]                 // 技能列表
    industry: string | null
    careerDirection: string | null
    headline: string | null          // 职业头衔
  }

  // ── 职业故事（AI 理解后的分析）──
  careerStory: {
    summary: string                  // 一句话职业总结
    careerJourney: string            // 职业经历描述
    uniqueAdvantages: string[]       // 独特优势
    possibleDirections: string[]     // 可能的职业方向
  }

  // ── 缺失信息（明确的任务缺口）──
  missingInformation: string[]       // 如 ["团队规模", "代表项目"]

  // ── 对话状态（控制对话流程）──
  conversationState: {
    completedTopics: string[]        // 已完成的话题
    currentTopic: string | null      // 当前话题
    lastQuestionAsked: string | null // 上一轮 AI 问的问题
    userResponseToLastQuestion: string | null // 用户对上一轮问题的回答
  }

  // ── 元数据 ──
  version: number
  updatedAt: number
}
```

### Conversation State Machine

对话通过 topic 驱动，不是自由漫谈：

```typescript
type ConversationTopic =
  | 'greeting'          // 打招呼
  | 'identity'          // 姓名/城市/年龄
  | 'experience'        // 工作年限/经历
  | 'skills'            // 技能
  | 'education'         // 教育背景
  | 'career_goal'       // 职业目标
  | 'proof'             // 项目/成就证明
  | 'resume'            // 简历创建
  | 'consult'           // 职业咨询
  | 'upgrade_hint'      // 价值提示触发
  | 'completed'         // 已完成
```

Topic 推进规则：
- 同一 Topic 不重复问确认信息
- 用户提供新信息时 AI 必须先确认再推进
- Topic 跳跃必须合理（不跳过基础信息直接问管理经验）

### CareerSummaryGenerator

```typescript
class CareerSummaryGenerator {
  /**
   * 从 DB Profile + 历史消息 生成结构化 CareerSummary
   * 每次 execute() 调用前重建
   */
  async generate(
    userId: string,
    historyMessages: ChatMessage[],
    dbProfile?: CareerProfile
  ): Promise<CareerSummary> { ... }

  /**
   * 从历史消息中提取用户确认过的事实
   * 不依赖正则，而是解析 COLLECT_START 标记
   * 加上聚合分析
   */
  private extractConfirmedFacts(
    messages: ChatMessage[],
    dbProfile?: CareerProfile
  ): ConfirmedFacts { ... }

  /**
   * 分析职业故事
   * 基于已确认事实做确定性推导
   */
  private analyzeCareerStory(facts: ConfirmedFacts): CareerStory { ... }

  /**
   * 计算缺失信息
   * 基于已知字段 vs 简历必需字段
   */
  private calculateMissingInfo(facts: ConfirmedFacts): string[] { ... }

  /**
   * 推断对话状态
   * 基于已采集字段判断当前处于哪个阶段
   */
  private inferConversationState(
    facts: ConfirmedFacts,
    lastAssistantMessage?: string
  ): ConversationState { ... }
}
```

### BuildContext 重写

```typescript
private async buildContext(
  userId: string,
  existingProfile?: Partial<CareerProfileSnapshot>,
  historyMessages?: ChatMessage[]
): Promise<string> {
  // 1. 获取/读取 DB profile
  const dbProfile = await this.getDbProfile(userId)

  // 2. 生成 CareerSummary
  const summary = await this.summaryGenerator.generate(
    userId,
    historyMessages,
    dbProfile
  )

  // 3. 构建 context sections
  const sections = [
    this.buildFactsSection(summary),       // [已确认事实]
    this.buildCareerStorySection(summary), // [职业分析]
    this.buildMissingInfoSection(summary), // [待补充信息]
    this.buildConversationState(summary),  // [对话状态]
    this.buildResumeStatus(userId),        // [简历状态]
  ]

  return sections.join('\n\n')
}
```

### Context Packet 输出示例（修复后）

```
[已确认事实]
姓名：李大牛
城市：郑州
工作年限：20年
技能：全栈开发、系统开发、新媒体运营
行业：科技
目标方向：技术总监

[职业分析]
职业总结：20年技术开发背景的复合型人才，拥有系统开发和新媒体运营双重能力线
独特优势：
- 技术深度：20年全栈开发，从商城到AI智能体产品
- 业务理解：新媒体运营 + 技术开发的双重视角
- AI实践：有智能体产品开发经验
可能方向：技术总监、AI产品经理、技术负责人

[待补充信息]
- 团队管理规模和年限（已关联技术总监目标）
- 代表项目详情（证明技术深度）
- 技术架构决策经验

[对话状态]
已完成：基础身份 → 职业经历
当前阶段：能力证明
上一轮问题：你过去负责过哪些核心项目？
用户回答情况：部分回答，缺少具体项目规模和成果

[简历状态]
已有 0 份简历草稿
```

---

## Task 04 — Reality Test 设计

### Case 1: 不重复已知信息

**输入：**

```
Round 1:
User: 我是李大牛，20年全栈开发

Round 2:
User: 我想做技术总监
```

**期望：**
- AI **不**问："你叫什么名字？"、"工作几年了？"
- AI 回答体现知道：李大牛、20年、全栈开发
- AI 自然承接技术总监目标，问管理经验或架构能力

**验证方法：**
```
curl -X POST ... --data '{
  "history": [
    {"role": "user", "content": "我是李大牛，20年全栈开发"}
  ],
  "userInput": "我想做技术总监"
}'
```
检查 reply 中不含"名字"、"姓名"、"请问你"、"几年"。

---

### Case 2: 跨行业连接能力

**输入：**

```
Round 1:
User: 我是销售总监，做SaaS销售5年

Round 2:
User: 想转产品
```

**期望：**
- AI 能连接销售经验 + SaaS行业 + 产品方向
- 不重复问"工作几年"、"在哪行"
- 分析：销售经验 → 理解客户需求 → 产品经理优势

**验证方法：**
检查 reply 中是否包含连接分析（如"销售经验"与"产品经理"的关系推导）。

---

### Case 3: 行业隔离

**输入：**

```
Round 1:
User: 我是厨师

Round 2:
User: 帮我做简历
```

**期望：**
- AI 不出现：Python、程序员、技术背景、代码
- AI 使用餐饮行业相关术语：厨房、菜品、烹饪
- 简历内容相关烹饪行业

**验证方法：**
检查 reply 中不含 `["python", "程序员", "技术背景", "代码", "开发"]` 等科技行业词。

---

### Case 4: 用户纠正覆盖旧信息

**输入：**

```
Round 1:
User: 我是技术开发，做后端5年

Round 2:
User: 不对，我之前说错了，我不是开发，我是运营
```

**期望：**
- AI 立即更新认知："好的，已更新为运营背景"
- 后续对话不出现"后端"、"开发"等旧信息
- 从运营角度重新分析职业方向

**验证方法：**
检查 reply 中「后端」或「开发」不应出现。应出现"已为你更新为运营背景"。

---

### Case 5: 20轮后依然保持上下文

**输入：**

```
20轮连续对话，涵盖：
R1-R3:  基础信息采集（姓名、城市、经验）
R4-R7:  技能讨论
R8-R12: 职业方向咨询
R13-R16: 简历创建
R17-R20: 简历修改讨论

Round 21（关键验证）:
User: 你觉得我适合什么方向？
```

**期望：**
- AI 记得姓名、经验、技能、目标
- AI 记得简历已经创建过
- AI 基于之前讨论过方向给出建议
- 不重新采集信息

**验证方法：**
Full 20 轮对话 + 第21轮验证回复是否基于历史。

---

## Task 05 — 执行计划

### 执行边界

```
✅ 允许：
  - CareerSummaryGenerator 新类
  - buildContext() 重写
  - ConversationState 模块
  - Reality Test 脚本
  - Prompt 微调（system prompt 增加状态感知指令）

❌ 禁止：
  - 新建 DB 表 / Schema 修改
  - Function Calling 接入
  - Hermes / Runtime 修改
  - 镜心 Agent 修改
  - 支付/商业化逻辑修改
```

### 执行步骤

| Step | 文件 | 改动 | 预计 |
|------|------|------|------|
| S1 | `career-advisor.service.ts` | 新增 `CareerSummaryGenerator` class | 60行 |
| S2 | `career-advisor.service.ts` | 新增 `ConversationState` 模块 | 40行 |
| S3 | `career-advisor.service.ts` | 重写 `buildContext()` → 使用 CareerSummary | 50行 |
| S4 | `career-advisor.service.ts` | 重写 `getOrCreateSummary()` → 结构化摘要 | 30行 |
| S5 | `career-advisor.service.ts` | 更新 `STATIC_SYSTEM_PROMPT` → 状态感知指令 | 10行 |
| S6 | 构建 + 部署 | `npm run build` + PM2 restart | — |
| S7 | Reality Test | 5 case 自动化测试 | — |

### 验收标准

```
G1: AI 不重复询问已知信息                    ┃  Case 1, 5 验证
G2: AI 能基于历史经历分析职业方向              ┃  Case 2, 5 验证
G3: 用户纠正后最新信息覆盖旧信息               ┃  Case 4 验证
G4: 跨轮对话保持职业上下文                     ┃  Case 5 验证
G5: Context Packet 可解释、可审计              ┃  buildContext() 输出可打印
G6: 行业隔离：厨师对话不出现"Python"等         ┃  Case 3 验证
```

---

## 附录 A：当前 vs 目标架构对比

```
当前架构                               目标架构
                                         
[User Input]                           [User Input]
    ↓                                      ↓
[History Block]                        [CareerSummary Generator]
    ↓                                      ↓
[DB Profile Raw]    → LLM              [Confirmed Facts]
    ↓                                      ↓
[LLM Reply]                           [Career Story Analysis]
    ↓                                      ↓
[Extract Markers]                      [Missing Info]
    ↓                                      ↓
[Save to DB]                           [Conversation State]
                                           ↓
                                       [History Block]
                                           ↓
                                       [DB Profile Raw]
                                           ↓
                                       → LLM
                                           ↓
                                       [LLM Reply]
                                           ↓
                                       [Extract Markers]
                                           ↓
                                       [Update CareerSummary]
                                           ↓
                                       [Save to DB]
```

## 附录 B：决策记录

| 决策 | 选项 | 选择原因 |
|------|------|----------|
| CareerSummary 存哪里 | 内存 vs DB | **内存** — 每次对话重建，不新增持久化 |
| Topic 推进谁控制 | LLM vs 硬编码 | **硬编码状态 + LLM 选择** — AI 清楚当前阶段但不限定下一步 |
| 信息提取方式 | 正则 vs LLM | **正则 + COLLECT_START 标记** — 不增加 LLM 调用，复用现有采集机制 |
| Summary 生成频率 | 每次 vs 每N轮 | **每次** — CareerSummaryGenerator 纯计算无 LLM 调用，无成本 |
| 用户纠正机制 | Prompt 规则 vs 代码 | **Prompt 优先 + 代码兜底** — System Prompt 已有规则，代码层校验 |

---

*报告完成于 2026-07-31 01:00 CST*
*作者：杨玉环 🏮*
