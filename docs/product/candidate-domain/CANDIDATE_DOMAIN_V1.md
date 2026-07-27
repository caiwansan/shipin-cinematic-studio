# Candidate Domain v1.0

> **状态**: ✅ FROZEN
> **作者**: 小二（起草）/ 掌柜（审定）
> **创建**: 2026-07-25
> **冻结**: 2026-07-25
> **依赖**: Constitution v1.0 ✅ FROZEN · P1 Capability Model ✅ ACCEPTED
> **后续**: P4 Candidate Marketplace · P5 Offer Domain · Career Agent · AI Matching

---

## 0. 领域定位

### 0.1 这个领域解决什么问题

当前招聘模块的数据模型（`Resume`、`TalentProfile`、`JobCandidate`、`RecruitmentPipeline`）全部面向**企业侧招聘流程**——企业发布职位、收集简历、管理面试。

Candidate Domain 面向**求职者侧**——一个人从"正在找工作"到"职业发展"的完整数据生命周期。

### 0.2 领域边界

```
Candidate Domain 包含：
  ✅ Career Profile    — 唯一真实档案
  ✅ Resume            — 派生简历（一档案多简历）
  ✅ Candidate Card    — 企业公开视图
  ✅ Skill Graph       — 技能画像与证据
  ✅ Career Timeline   — 职业成长记录

Candidate Domain 不包含：
  ❌ RecruitmentPipeline  — 属于企业招聘流程域
  ❌ JobPosting           — 属于职位域
  ❌ InterviewSession     — 属于面试域（P5）
  ❌ Offer                — 属于 Offer 域（P5）
  ❌ Billing/Subscription — 属于治理域（P1）
```

### 0.3 与其他领域的关系

```
Career Profile (SSOT)
  │
  ├── Resume (派生) ───────────── AI Resume Optimize
  ├── Candidate Card (公开视图) ── P4 Candidate Marketplace
  ├── Skill Graph (AI 可读)  ──── AI Matching / Career Agent
  └── Career Timeline (Append) ── P5 Offer / Career Agent
```

---

## 1. 领域设计原则

### DP-P3-01 · Career Profile 是唯一真实来源（Single Source of Truth）

> Career Profile 描述一个人的真实职业经历。
>
> Resume 是 Career Profile 的**派生物**，不是独立实体。
>
* 一份 Career Profile → 多份 Resume（中文/英文/Java版/产品经理版/海外版）
* AI Resume Optimize 修改的是 Resume，不修改 Career Profile
* 任何模块需要"这个人的真实情况"时，读取 Career Profile

### DP-P3-02 · Candidate Card 默认最小公开

> Candidate Card 是企业看到的公开摘要。
>
* 默认仅展示：职业方向、技能标签、工作年限、城市、匹配度、是否开放机会
* 用户可自主决定公开什么、隐藏什么
* Career Profile 的完整内容**永不**直接暴露给企业

### DP-P3-03 · Skill Graph 可成长，但证据不可篡改

> Skill Graph 是整个 AI 招聘最重要的数据。
>
* AI 可以更新：Confidence、Last Assessed
* AI **不能**修改：真实工作经历、教育经历（这些属于 Career Profile）
* 每个 Skill 必须有 Evidence 来源（工作经历/GitHub/AI Interview/证书）

### DP-P3-04 · Career Timeline 仅 Append

> Career Timeline 是职业成长的不可变历史。
>
* 只能追加，不能覆盖或删除
* Offer Accepted、Promotion、Certification、Project Milestone 全部有历史
* 这是 Career Agent 的职业建议基础

### DP-P3-05 · 一个用户只有一份 Career Profile

> 无论用户使用多少个功能、投递多少份简历，Career Profile 始终唯一。
>
* 用户注册时自动创建
* 终身伴随，不随订阅状态变化
* 即使用户删除所有 Resume，Career Profile 依然存在

### DP-P3-06 · AI 修改边界

> AI 可以生成建议和推断，但不得覆盖用户事实数据。
>
**允许 AI**：
* 建议技能标签（写入 Skill Graph，source = `ai_inference`）
* 提示缺失信息（返回建议列表，不直接写入）
* 提供职业建议（写入 Career Timeline，source = `ai_inference`）
* 更新 Skill Graph 的 Confidence / Last Assessed
* 生成 Resume（创建新 Resume 记录，不修改 Career Profile）

**禁止 AI**：
* 自动增加 / 修改 / 删除 Work Experience
* 自动修改 Education 记录
* 自动修改 Career Profile 的核心事实字段（姓名、工作经历、学历）
* 覆盖用户已确认的 Skill Graph 条目（只能追加或提升置信度）
* 修改 Career Timeline 已有事件（只能追加 Correction Event）

> 此原则对应 Constitution DP-01：人才资产的事实数据属于用户本人。

---

## 2. 核心对象

### 2.1 Career Profile（职业档案）

**定位**: 唯一真实档案（SSOT）。描述一个人的完整职业画像。

```prisma
model CareerProfile {
  id                 String   @id @default(uuid()) @db.Uuid
  userId             String   @unique @map("user_id") @db.Uuid

  // ── 基本信息 ──
  fullName           String
  headline           String?  // 一句话定位，如"8年全栈工程师"
  bio                String?  // 自我介绍
  avatarUrl          String?  @map("avatar_url")
  gender             String?
  birthYear          Int?     @map("birth_year")

  // ── 联系信息（私有）──
  email              String?
  phone              String?
  city               String?
  country            String?  @default("CN")

  // ── 职业方向 ──
  careerDirection    String?  @map("career_direction") // 如"后端架构"
  industry           String?  // 当前行业
  yearsExperience    Int      @default(0) @map("years_experience")
  currentLevel       String?  @map("current_level")   // junior | mid | senior | staff | principal

  // ── 期望 ──
  expectationJson    Json?    @map("expectation_json")
  // {
  //   "targetRoles": ["后端架构师", "技术经理"],
  //   "targetIndustries": ["金融科技", "AI"],
  //   "salaryMin": 500000,
  //   "salaryMax": 800000,
  //   "salaryCurrency": "CNY",
  //   "locations": ["深圳", "杭州", "远程"],
  //   "remotePreference": "hybrid",
  //   "jobType": "full_time"
  // }

  // ── 求职状态 ──
  jobSeekingStatus   String   @default("not_looking") @map("job_seeking_status")
  // not_looking | open_to_opportunity | actively_looking | interviewing
  openToOpportunity  Boolean  @default(false) @map("open_to_opportunity") // 是否开放猎头联系

  // ── 可见性 ──
  visibility         String   @default("private") // private | public | anonymous

  // ── 元数据 ──
  completionScore    Int      @default(0) @map("completion_score") // 档案完整度 0-100
  lastActiveAt       DateTime @default(now()) @map("last_active_at")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  // ── 关联 ──
  user               User              @relation(fields: [userId], references: [id])
  workExperiences    WorkExperience[]
  educations         Education[]
  skillGraph         SkillNode[]
  resumes            Resume[]
  candidateCard      CandidateCard?
  timeline           CareerTimelineEvent[]

  @@map("career_profile")
}
```

**Work Experience（工作经历）**

```prisma
model WorkExperience {
  id              String   @id @default(uuid()) @db.Uuid
  profileId       String   @map("profile_id") @db.Uuid

  company         String
  title           String
  department      String?
  employmentType  String?  @map("employment_type") // full_time | part_time | contract | freelance
  startDate       DateTime @map("start_date")
  endDate         DateTime? @map("end_date") // null = 至今
  isCurrent       Boolean  @default(false) @map("is_current")
  location        String?
  description     String?
  achievements    String[] // 关键业绩
  skillsUsed      String[] @map("skills_used") // 使用的技能标签

  // ── 来源与验证 ──
  source          String   @default("user") // user | resume_parse | linkedin | ai_inference
  verified        Boolean  @default(false)

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  profile         CareerProfile @relation(fields: [profileId], references: [id])

  @@map("work_experience")
}
```

**Education（教育经历）**

```prisma
model Education {
  id              String   @id @default(uuid()) @db.Uuid
  profileId       String   @map("profile_id") @db.Uuid

  school          String
  degree          String?  // bachelor | master | phd | associate
  major           String?
  startDate       DateTime? @map("start_date")
  endDate         DateTime? @map("end_date")
  gpa             Float?
  description     String?

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  profile         CareerProfile @relation(fields: [profileId], references: [id])

  @@map("education")
}
```

---

### 2.2 Resume（简历）

**定位**: Career Profile 的派生物。一份档案可生成多份简历。

```prisma
model Resume {
  id              String   @id @default(uuid()) @db.Uuid
  profileId       String   @map("profile_id") @db.Uuid

  // ── 简历元信息 ──
  name            String   // 如"Java后端简历"、"海外英文简历"
  language        String   @default("zh") // zh | en
  targetRole      String?  @map("target_role") // 目标岗位方向
  version         Int      @default(1)

  // ── 内容 ──
  contentJson     Json     @map("content_json")
  // {
  //   "summary": "...",
  //   "workExperiences": [{ "company": "...", "highlights": ["..."] }],
  //   "educations": [...],
  //   "projects": [...],
  //   "skills": [...],
  //   "customSections": []
  // }

  // ── 生成方式 ──
  generatedBy     String   @default("user") @map("generated_by")
  // user | ai_optimize | ai_rewrite | template
  sourceResumeId  String?  @map("source_resume_id") @db.Uuid // 基于哪份简历优化
  aiPrompt        String?  @map("ai_prompt") // AI 生成时的 prompt 摘要

  // ── 文件 ──
  fileUrl         String?  @map("file_url")
  fileFormat      String?  @map("file_format") // pdf | docx | markdown

  // ── 状态 ──
  isDefault       Boolean  @default(false) @map("is_default") // 默认投递简历
  status          String   @default("active") // active | archived

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  profile         CareerProfile  @relation(fields: [profileId], references: [id])
  sourceResume    Resume?        @relation("ResumeDerivation", fields: [sourceResumeId], references: [id])
  derivedResumes  Resume[]       @relation("ResumeDerivation")

  @@map("resume")
}
```

**设计要点**：
- `contentJson` 是从 Career Profile 派生出的结构化简历内容
- AI Resume Optimize 创建新 Resume，不修改原 Resume
- `sourceResumeId` 自引用关联，记录简历派生链
- `isDefault` 标记用户当前默认投递的简历

---

### 2.3 Candidate Card（人才卡片）

**定位**: 企业看到的公开摘要。不是完整档案。

```prisma
model CandidateCard {
  id              String   @id @default(uuid()) @db.Uuid
  profileId       String   @unique @map("profile_id") @db.Uuid

  // ── 公开摘要 ──
  headline        String?  // 如"8年Java后端 · 架构方向"
  summary         String?  // AI 生成的公开摘要
  skillTags       String[] @map("skill_tags") // 公开的技能标签
  yearsExperience Int      @default(0) @map("years_experience")
  currentCity     String?  @map("current_city")
  currentCompany  String?  @map("current_company") // 可选公开
  currentTitle    String?  @map("current_title")

  // ── 匹配信号 ──
  openToOpportunity Boolean @default(false) @map("open_to_opportunity")
  matchScoreAvg   Int?     @map("match_score_avg") // 平均匹配度

  // ── 可见性控制 ──
  visibility      String   @default("private")
  // private | public | anonymous | verified_only
  hiddenFields    String[] @map("hidden_fields")
  // 用户选择隐藏的字段名，如 ["current_company", "email"]

  // ── AI 摘要 ──
  aiSummary       String?  @map("ai_summary")
  aiSummaryAt     DateTime? @map("ai_summary_at")

  // ── 浏览统计 ──
  viewCount       Int      @default(0) @map("view_count")
  lastViewedAt    DateTime? @map("last_viewed_at")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  profile         CareerProfile @relation(fields: [profileId], references: [id])

  @@map("candidate_card")
}
```

**设计要点**：
- 一对一关联 Career Profile（一个档案一张卡片）
- `hiddenFields` 让用户精细控制哪些信息对企业可见
- `anonymous` 模式下仅展示技能标签和年限，隐藏公司/姓名
- `aiSummary` 由 AI 根据 Career Profile 生成，定期刷新

---

### 2.4 Skill Graph（技能画像）

**定位**: AI 招聘的核心数据。不是字符串列表，而是有证据、有置信度的技能图谱。

```prisma
model SkillNode {
  id              String   @id @default(uuid()) @db.Uuid
  profileId       String   @map("profile_id") @db.Uuid

  // ── 技能定义 ──
  skillName       String   @map("skill_name") // 标准化名称，如"TypeScript"
  category        String?  // language | framework | tool | soft_skill | domain
  level           String   @default("beginner")
  // beginner | intermediate | advanced | expert

  // ── 证据与置信度 ──
  confidence      Int      @default(0) // 0-100，AI 评估的置信度
  evidenceJson    Json?    @map("evidence_json")
  // [
  //   { "type": "work_experience", "refId": "...", "description": "3年TypeScript开发" },
  //   { "type": "github", "refId": "...", "description": "开源项目 500 stars" },
  //   { "type": "ai_interview", "refId": "...", "description": "AI面试评估" },
  //   { "type": "certification", "refId": "...", "description": "AWS认证" }
  // ]

  // ── 来源 ──
  source          String   @default("user")
  // user | resume_parse | ai_inference | github | ai_interview

  // ── 时间追踪 ──
  firstUsedAt     DateTime? @map("first_used_at")
  lastAssessedAt  DateTime @default(now()) @map("last_assessed_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  profile         CareerProfile  @relation(fields: [profileId], references: [id])

  @@unique([profileId, skillName])
  @@map("skill_node")
}
```

**设计要点**：
- `skillName` 使用标准化名称（统一词表），避免"Go"和"golang"被当作两个技能
- `confidence` 由 AI 根据证据综合评估，证据越多越高
- `evidenceJson` 记录每个证据的来源、引用和描述
- `source` 区分用户自填 vs AI 推断（AI 推断的需要用户确认）
- 唯一约束 `[profileId, skillName]` 确保一个档案中每个技能只有一条记录

---

### 2.5 Career Timeline（职业成长）

**定位**: 职业成长的不可变历史。仅 Append。

```prisma
model CareerTimelineEvent {
  id              String   @id @default(uuid()) @db.Uuid
  profileId       String   @map("profile_id") @db.Uuid

  // ── 事件定义 ──
  eventType       String   @map("event_type")
  // job_start | job_end | promotion | certification | project_milestone
  // offer_accepted | skill_acquired | education | award | publication
  // career_pivot | correction | other

  title           String   // 如"加入腾讯"、"获得PMP认证"
  description     String?
  organization    String?  // 相关组织

  // ── 时间 ──
  occurredAt      DateTime @map("occurred_at") // 事件发生时间
  granularity     String   @default("day") // year | month | day

  // ── 关联 ──
  relatedEventId  String?  @map("related_event_id") @db.Uuid // Correction Event 关联的原始事件
  relatedSkillNames String[] @map("related_skill_names") // 关联的技能
  metadata        Json?    // 扩展信息

  // ── 来源 ──
  source          String   @default("user")
  // user | resume_parse | ai_inference | linkedin | system

  // ── 不可变性 ──
  // 无 updatedAt — 创建后不可修改
  createdAt       DateTime @default(now()) @map("created_at")

  profile         CareerProfile @relation(fields: [profileId], references: [id])

  @@index([profileId, occurredAt])
  @@map("career_timeline_event")
}
```

**设计要点**：
- **没有 `updatedAt`** — 创建后不可修改（DP-P3-04）
- `eventType` 覆盖职业发展的关键节点
- `granularity` 允许用户仅公开年份（隐私保护）
- `occurredAt` 是事件真实发生时间，`createdAt` 是系统记录时间
- 按 `[profileId, occurredAt]` 索引，支持时间线正序展示

**Correction Event 机制**：

现实职业记录可能修正。不允许直接覆盖已有事件，而是追加一条 Correction Event：

```
原始事件: "2022-2024 公司A" (id = xxx)
   ↓ 用户发现错误
Correction Event: {
  eventType: "correction",
  title: "修正：公司A任职时间",
  description: "实际 2021-2024，非 2022-2024",
  relatedEventId: "xxx",  // 指向原始事件
  metadata: { correctedFields: ["startDate"], fromValue: "2022", toValue: "2021" }
}
```

- 原始事件保持不变（审计链完整）
- Correction Event 通过 `relatedEventId` 关联原始事件
- 前端展示时，Correction Event 替代原始事件的展示值，但原始数据不丢失
- `eventType` 新增 `correction` 枚举值

---

## 3. 数据生命周期

### 3.1 Candidate 状态

Candidate Profile 的求职状态驱动 P4 人才市场的可见性：

```
Created（创建）
  ↓
Profile Building（档案建设中）— completionScore < 60
  ↓
Active（活跃）— 档案完整，但未必在找工作
  ↓
Open To Work（开放求职）— openToOpportunity = true
  ↓
Private（隐身）— visibility = private，从人才市场下架
```

| 状态 | 人才市场可见 | 猎头可联系 | 触发条件 |
|---|---|---|---|
| Created | ❌ | ❌ | 注册自动创建 |
| Profile Building | ❌ | ❌ | 档案完整度 < 60 |
| Active | 取决于 visibility | 取决于 openToOpportunity | 档案完整度 ≥ 60 |
| Open To Work | ✅（如 visibility=public） | ✅ | 用户主动开启 |
| Private | ❌ | ❌ | 用户主动隐身 |

**原则**：Candidate Card 自己不判断是否可见——由 Career Profile 的 `visibility` + `openToOpportunity` 联合决定。

### 3.2 创建

```
用户注册
  → 自动创建 Career Profile（空壳，状态 = Created）
  → 自动创建 Candidate Card（空壳，默认 private）
  → Skill Graph 为空
  → Career Timeline 为空
```

### 3.3 填充

```
用户填写档案 / 上传简历 / AI 面试
  → 更新 Career Profile（基本信息、工作经历、教育）
  → 派生 Resume（AI 生成或用户手动创建）
  → 更新 Skill Graph（从简历/面试/证据中提取）
  → 追加 Career Timeline 事件
  → 刷新 Candidate Card 摘要
  → 重新计算 completionScore → 可能触发状态变更
```

### 3.4 使用

```
AI Matching      → 读取 Career Profile + Skill Graph
AI Resume Optimize → 读取 Career Profile → 创建新 Resume
Candidate Card   → 企业浏览（受可见性控制）
Career Agent     → 读取 Career Timeline + Skill Graph → 职业建议
P4 Marketplace   → 展示 Candidate Card
P5 Offer         → 写入 Career Timeline（Offer Accepted）
```

---

## 4. 与现有模型的关系

### 4.1 不重复造轮子

| 已有模型 | 用途 | P3 是否替代 |
|---|---|---|
| `Resume` | 企业侧简历存储（上传的原始文件） | ❌ 不替代，共存 |
| `ResumeProfile` | 企业侧简历解析结果 | ❌ 不替代，共存 |
| `JobCandidate` | 企业侧候选人记录 | ❌ 不替代，共存 |
| `TalentProfile` | 企业侧人才档案 | ❌ 不替代，共存 |
| `CandidateMatch` | 企业侧匹配记录 | ❌ 不替代，共存 |

**说明**：已有模型全部面向**企业招聘流程**。P3 的模型面向**求职者个人档案**。两者视角不同，共存但不冲突。

### 4.2 桥接点

未来可以在 `CandidateMatch` 中增加 `careerProfileId` 字段，将企业侧匹配与求职者侧档案关联：

```prisma
// 未来扩展（不在 P3 范围）
model CandidateMatch {
  // ... 现有字段 ...
  careerProfileId String? @map("career_profile_id") @db.Uuid
}
```

---

## 5. 接口关系

### 5.1 P4 Candidate Marketplace 依赖

```
P4 读取：
  - Candidate Card（公开视图）
  - Skill Graph（匹配度计算）

P4 不读取：
  - Career Profile 完整内容
  - Career Timeline 详细事件
```

### 5.2 P5 Offer Domain 依赖

```
P5 写入：
  - Career Timeline（Offer Accepted 事件）

P5 读取：
  - Career Profile（期望薪资、地点）
  - Career Timeline（历史 Offer）
```

### 5.3 Career Agent 依赖

```
Career Agent 读取：
  - Career Profile（完整档案）
  - Skill Graph（技能画像）
  - Career Timeline（职业成长）

Career Agent 写入：
  - Skill Graph（更新 Confidence）
  - Career Timeline（职业建议记录）
```

### 5.4 AI Matching 依赖

```
AI Matching 读取：
  - Career Profile（职业方向、经验）
  - Skill Graph（技能 + 置信度）

AI Matching 不读取：
  - Career Timeline（匹配不需要历史）

AI Matching 写入：
  - ❌ 不写入 Candidate Domain
  - MatchResult 属于 Recruitment Domain
```

### 5.5 接口关系汇总

| 模块 | 读取 | 写入 |
| --- | --- | --- |
| P4 人才市场 | Candidate Card / Skill Graph | View Event（浏览记录） |
| P5 Offer | Career Profile（期望薪资、地点） | Career Timeline Event（Offer Accepted） |
| Career Agent | Career Profile / Skill Graph / Timeline | Skill Graph（Confidence） / 建议记录 |
| AI Matching | Career Profile + Skill Graph | ❌ 不写入 Candidate Domain |

---

## 6. Domain Ownership

明确各对象的归属领域，防止 P4/P5 开发越界：

| 对象 | Owner | 说明 |
|---|---|---|
| Career Profile | Candidate Domain | 唯一真实档案 |
| Resume | Candidate Domain | 派生简历 |
| Candidate Card | Candidate Domain | 企业公开视图 |
| Skill Graph | Candidate Domain | 技能画像 |
| Career Timeline | Candidate Domain | 职业成长 |
| Job | Recruitment Domain | 职位管理 |
| RecruitmentPipeline | Recruitment Domain | 招聘流程 |
| Interview | Recruitment Domain | 面试管理 |
| Offer | Offer Domain | Offer 管理 |
| CandidateMatch | Recruitment Domain | 匹配结果（不属于人才资产） |
| MatchResult | Recruitment Domain | 匹配结果（不属于人才资产） |

**原则**：
* Candidate Domain 的对象由用户本人或 Career Agent 写入
* Recruitment Domain 的对象由企业侧流程写入
* 匹配结果（MatchResult）属于招聘域，不写回 Candidate Domain
* 两个域通过 `careerProfileId` 桥接，不合并数据

---

## 7. 命名规范

| 规则 | 示例 |
|---|---|
| 模型名 PascalCase | `CareerProfile`, `SkillNode` |
| 字段名 camelCase | `jobSeekingStatus`, `yearsExperience` |
| 数据库列 snake_case | `job_seeking_status`, `years_experience` |
| 表名 snake_case + 复数语义 | `career_profile`, `skill_node` |
| 事件类型 UPPER_SNAKE | `JOB_START`, `OFFER_ACCEPTED` |
| 技能名称 标准英文 | `TypeScript`, `Go`, `Python` |

---

## 7. 不在 P3 范围内

以下功能依赖 Candidate Domain，但属于后续 Phase：

| 功能 | 所属 Phase |
|---|---|
| Candidate Card 前端页面 | P4 |
| Career Profile 编辑前端 | P4 |
| AI Resume Optimize 实现 | P4 |
| AI Matching 引擎 | P4 |
| Career Agent | P5 |
| Offer 管理 | P5 |
| Skill Graph 可视化 | P5 |
| 简历 PDF 生成 | P5 |
| 职业建议推送 | P5 |

---

## 8. 冻结检查清单

P3 冻结前需确认：

- [ ] 五个核心对象字段完整且无歧义
- [ ] 六条设计原则（DP-P3-01 ~ DP-P3-06）已确认
- [ ] 与现有模型无冲突
- [ ] 与 P4/P5 接口关系已明确
- [ ] 命名规范已确认
- [ ] 不在范围内的功能已列出
- [ ] Domain Ownership 已确认
- [ ] Candidate 状态生命周期已确认
- [ ] Career Timeline Correction Event 机制已确认

---

## 9. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 DRAFT | 2026-07-25 | 初始起草，待掌柜审定 |
| v1.0 REVIEW | 2026-07-25 | 掌柜 Review 后补充：DP-P3-06 AI 修改边界、Domain Ownership 表、Candidate 状态生命周期、Career Timeline Correction Event、接口关系汇总 |
