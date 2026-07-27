# P4-01 Talent Matching Engine — Design Document

> **Version:** 1.0 (Draft)
> **Date:** 2026-07-25
> **Author:** OpenClaw (小二)
> **Reviewer:** 掌柜 (CTO)
> **Status:** PENDING DESIGN GATE
> **Depends on:** Candidate Domain v1.0 ✅ FROZEN · Constitution v1.0 ✅ FROZEN

---

## 1. 定位声明

### 1.1 是什么

Talent Matching Engine 是 AI 招聘决策辅助系统的**核心计算层**。

不是：

| ❌ 不是 | 说明 |
| :--- | :--- |
| 简历关键词搜索 | 不做字符串匹配 |
| Agent 系统 | 不做自主决策 |
| 推荐算法 | 不做协同过滤 |

而是：

> **基于已冻结的 Candidate Domain 事实，对 Job Requirement 做结构化匹配计算，输出可解释的匹配结果。**

### 1.2 核心目标

企业输入：

```
岗位 JD（文本 or 结构化）
+
招聘要求（技能/经验/学历/行业）
```

系统输出：

```
候选人排序列表
+
匹配分（0-100）
+
匹配维度分解
+
匹配原因（可解释）
+
风险提示
+
技能差距
+
证据来源（指向 Candidate Domain）
```

### 1.3 设计原则

| 编号 | 原则 | 说明 |
| :--- | :--- | :--- |
| DP-M01 | 事实不可篡改 | 匹配引擎只读 Candidate Domain，绝不写入 |
| DP-M02 | 计算与解释分离 | Score 由确定性服务计算，解释由 LLM 生成 |
| DP-M03 | 证据链完整 | 每个匹配结论必须指向 Candidate Domain 的具体事实 |
| DP-M04 | 差距可行动 | 技能差距输出为结构化数据，可用于后续 AI 面试 |
| DP-M05 | 结果可审计 | MatchResult 持久化，可追溯、可比较 |

---

## 2. 架构设计

### 2.1 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│ API Layer                                                    │
│  POST /api/job/match/analyze     — 分析 JD                   │
│  POST /api/job/match/search      — 搜索匹配候选人            │
│  GET  /api/job/match/results/:id — 获取匹配结果详情          │
│  GET  /api/job/match/evidence/:id — 获取匹配证据链           │
├─────────────────────────────────────────────────────────────┤
│ Service Layer                                                │
│  JobUnderstandingService   — JD 解析 → JobRequirementProfile │
│  TalentMatchingService     — 核心匹配计算                    │
│  MatchExplanationService   — LLM 生成解释                    │
├─────────────────────────────────────────────────────────────┤
│ Domain Layer                                                 │
│  Candidate Domain (FROZEN) — 只读                            │
│  Matching Domain (NEW)     — 匹配结果 + 证据                 │
├─────────────────────────────────────────────────────────────┤
│ Infrastructure                                               │
│  Prisma ORM + PostgreSQL                                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
┌──────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ Job Post │────▶│ JobUnderstanding    │────▶│ JobRequirement   │
│ (JD)     │     │ Service             │     │ Profile          │
└──────────┘     └─────────────────────┘     └────────┬─────────┘
                                                      │
                                                      ▼
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ Candidate Domain │────▶│ Talent Matching     │────▶│ TalentMatch      │
│ (FROZEN, 只读)   │     │ Service             │     │ Result           │
└──────────────────┘     └─────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │ MatchExplanation │
                                                     │ Service (LLM)    │
                                                     └────────┬─────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │ API Response     │
                                                     │ + score          │
                                                     │ + reasoning      │
                                                     │ + skill gap      │
                                                     │ + evidence       │
                                                     └──────────────────┘
```

### 2.3 边界：Service vs Agent

| 组件 | 类型 | 职责 | 确定性 |
| :--- | :--- | :--- | :--- |
| JobUnderstandingService | Service | JD → 结构化要求 | 确定性 + LLM 辅助解析 |
| TalentMatchingService | **Service** | 核心匹配计算 | **完全确定性** |
| MatchExplanationService | Service | 生成自然语言解释 | LLM |
| Recruitment Agent (未来) | Agent | JD 分析、推荐解释、面试建议 | LLM |

> **关键决策**：Matching Engine 是 Deterministic Service，不是 Agent。
> LLM 负责「解释」，不负责「计算真相」。

---

## 3. Match Score 模型

### 3.1 v1 Score 公式

```
Match Score = Σ (dimension_score × dimension_weight)

维度：
  skill_match      权重 40%
  experience_match   权重 30%
  education_match    权重 15%
  career_match       权重 15%
```

输出结构：

```json
{
  "score": 86,
  "breakdown": {
    "skill": 92,
    "experience": 85,
    "education": 80,
    "career": 88
  },
  "weights": {
    "skill": 0.40,
    "experience": 0.30,
    "education": 0.15,
    "career": 0.15
  }
}
```

### 3.2 各维度计算规则

#### Skill Match（40%）

```
skill_match = matched_required_skills / total_required_skills × 0.7
            + matched_preferred_skills / total_preferred_skills × 0.3

其中：
  - 技能匹配判定：CandidateSkill.skillId ∈ JobRequirement.requiredSkillIds
  - 置信度加权：最终得分 × CandidateSkill.confidence
  - 等级加成：expert +10%, advanced +5%, intermediate 0%, beginner -10%
```

#### Experience Match（30%）

```
experience_match = min(yearsExperience / requiredYears, 1.0) × 60
                 + industryMatch × 20
                 + levelMatch × 20

其中：
  - yearsExperience: CandidateCard.yearsExperience
  - requiredYears: JobRequirement.experienceMin
  - industryMatch: 行业匹配（精确 1.0 / 相关 0.5 / 不匹配 0）
  - levelMatch: 级别匹配（currentLevel vs requiredLevel）
```

#### Education Match（15%）

```
education_match = degreeMatch × 60
                + majorMatch × 40

其中：
  - degreeMatch: 学历达标 100，低一级 60，低两级 20
  - majorMatch: 专业匹配 100，相关 50，不相关 0
```

#### Career Match（15%）

```
career_match = directionMatch × 50
             + locationMatch × 25
             + availabilityMatch × 25

其中：
  - directionMatch: careerDirection 与 JD 方向匹配度
  - locationMatch: 城市匹配（精确 100 / 远程可 70 / 不匹配 0）
  - availabilityMatch: openToOpportunity → 100, 否则 50
```

### 3.3 风险提示规则

| 条件 | 风险等级 | 提示 |
| :--- | :---: | :--- |
| 技能匹配 < 50% | 🔴 HIGH | 核心技能缺失 |
| 工作年限不足 50% | 🔴 HIGH | 经验明显不足 |
| 学历不达标 | 🟡 MEDIUM | 学历差距 |
| 城市不匹配且不接受远程 | 🟡 MEDIUM | 地点限制 |
| openToOpportunity = false | 🟡 MEDIUM | 未开放求职 |
| 技能置信度 < 0.5 占比 > 50% | 🟡 MEDIUM | 技能证据不足 |

---

## 4. 数据模型设计

### 4.1 JobRequirementProfile（岗位要求）

> 将 JD 文本标准化为结构化匹配条件。

```prisma
model JobRequirementProfile {
  id                String   @id @default(uuid()) @db.Uuid

  // ── 来源 ──
  enterpriseId      String   @map("enterprise_id") @db.Uuid
  jobTitle          String   @map("job_title")
  jobDescription    String?  @map("job_description") // 原始 JD 文本

  // ── 结构化要求 ──
  requiredSkills    Json     @map("required_skills")
  // [{ "skillId": "...", "skillName": "...", "minLevel": "advanced" }]
  preferredSkills   Json?    @map("preferred_skills")
  // [{ "skillId": "...", "skillName": "..." }]

  experienceMin     Int      @default(0) @map("experience_min") // 最低年限
  experienceMax     Int?     @map("experience_max")              // 最高年限
  educationMin      String?  @map("education_min")               // bachelor | master | phd
  preferredMajors   String[] @map("preferred_majors")
  industries        String[]                                    // 相关行业

  // ── 职位信息 ──
  employmentType    String?  @map("employment_type")
  location          String?
  remoteOption      String?  @map("remote_option") // onsite | remote | hybrid
  salaryMin         Int?     @map("salary_min")
  salaryMax         Int?     @map("salary_max")

  // ── 匹配配置 ──
  weights           Json?    // 自定义权重（覆盖默认）

  // ── 状态 ──
  status            String   @default("active") // active | closed | draft
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // ── 关联 ──
  matchResults      TalentMatchResult[]

  @@map("job_requirement_profile")
}
```

### 4.2 TalentMatchResult（匹配结果）

> 一次匹配计算的结果。持久化用于审计和比较。

```prisma
model TalentMatchResult {
  id                String   @id @default(uuid()) @db.Uuid

  // ── 关联 ──
  jobRequirementId  String   @map("job_requirement_id") @db.Uuid
  candidateId       String   @map("candidate_id") @db.Uuid // CareerProfile.candidateId
  profileId         String   @map("profile_id") @db.Uuid   // CareerProfile.id

  // ── 匹配分数 ──
  score             Int      // 0-100 综合分
  breakdown         Json     // { skill, experience, education, career }
  // ── 匹配详情 ──
  matchedSkills     Json     @map("matched_skills")
  // [{ "skillId": "...", "skillName": "...", "level": "expert", "confidence": 0.95 }]
  missingSkills     Json     @map("missing_skills")
  // [{ "skillId": "...", "skillName": "...", "importance": "required" }]
  skillGap          Json?    @map("skill_gap")
  // [{ "skillName": "...", "currentLevel": null, "requiredLevel": "advanced" }]

  // ── 风险与解释 ──
  riskFlags         Json?    @map("risk_flags")
  // [{ "type": "skill_gap", "severity": "high", "message": "..." }]
  reasoning         String?  // LLM 生成的匹配原因
  reasoningAt       DateTime? @map("reasoning_at")

  // ── 排序 ──
  rank              Int?     // 本次搜索中的排名

  // ── 元数据 ──
  matchVersion      String   @default("v1") @map("match_version") // 算法版本
  createdAt         DateTime @default(now()) @map("created_at")

  // ── 关联 ──
  jobRequirement    JobRequirementProfile @relation(fields: [jobRequirementId], references: [id])
  evidence          MatchEvidence[]

  @@unique([jobRequirementId, candidateId])
  @@index([jobRequirementId, score(sort: Desc)])
  @@map("talent_match_result")
}
```

### 4.3 MatchEvidence（匹配证据）

> 每个匹配结论的事实来源。指向 Candidate Domain 的具体记录。

```prisma
model MatchEvidence {
  id                String   @id @default(uuid()) @db.Uuid

  matchResultId     String   @map("match_result_id") @db.Uuid

  // ── 证据内容 ──
  evidenceType      String   @map("evidence_type")
  // skill_match | experience_match | education_match | career_match
  claim             String   // 声称，如"候选人具备 5 年 TypeScript 经验"
  sourceType        String   @map("source_type")
  // work_experience | education | candidate_skill | career_profile
  sourceId          String   @map("source_id") @db.Uuid // 指向 Candidate Domain 记录
  confidence        Float    // 0-1，该证据的置信度

  createdAt         DateTime @default(now()) @map("created_at")

  matchResult       TalentMatchResult @relation(fields: [matchResultId], references: [id])

  @@index([matchResultId])
  @@map("match_evidence")
}
```

### 4.4 与 Frozen Domain 的关系

```
Candidate Domain (FROZEN, 只读)
  │
  ├── CareerProfile ───────▶ TalentMatchResult.profileId (FK, 只读引用)
  ├── CandidateCard ───────▶ 投影数据作为匹配输入
  ├── CandidateSkill ──────▶ 技能匹配计算来源
  ├── WorkExperience ──────▶ 经验匹配 + 证据来源
  ├── Education ───────────▶ 教育匹配 + 证据来源
  └── CareerTimelineEvent ─▶ 未来：职业稳定性分析

Matching Domain (NEW)
  │
  ├── JobRequirementProfile
  ├── TalentMatchResult
  └── MatchEvidence
```

> **红线**：Matching Domain 对 Candidate Domain 只有只读引用，无任何写入。

---

## 5. Evidence Boundary（证据边界）

### 5.1 允许

```
Matching Engine 可以：
  ✅ 读取 Candidate Domain 所有公开数据
  ✅ 读取 Candidate Card Projection
  ✅ 读取 Skill Evidence
  ✅ 持久化 MatchResult + MatchEvidence
  ✅ 调用 LLM 生成解释文本
```

### 5.2 禁止

```
Matching Engine 不能：
  ❌ 修改 CareerProfile
  ❌ 修改 WorkExperience / Education
  ❌ 修改 CandidateSkill（即使发现错误）
  ❌ 修改 CandidateCard
  ❌ 修改 CareerTimelineEvent
  ❌ 因为「AI 认为适合」而修改任何 Candidate Domain 数据
```

### 5.3 证据链完整性

每个匹配结论必须满足：

```
Claim（声称）
  → Source Type（来源类型）
  → Source ID（具体记录 ID）
  → Confidence（置信度）
```

示例：

```json
{
  "claim": "候选人具备 5 年 TypeScript 经验",
  "sourceType": "work_experience",
  "sourceId": "a1b2c3d4-...",
  "confidence": 0.95,
  "evidence": "腾讯科技 前端架构师 (2020-至今)，技能标签含 TypeScript"
}
```

---

## 6. API Contract（预设计）

> 设计阶段预定义 API 契约，实现阶段冻结。

### 6.1 企业侧 API

| Method | Path | 说明 |
| :---: | :--- | :--- |
| POST | `/api/job/match/requirements` | 创建岗位要求 |
| PUT | `/api/job/match/requirements/:id` | 更新岗位要求 |
| POST | `/api/job/match/search` | 搜索匹配候选人 |
| GET | `/api/job/match/results/:id` | 获取匹配结果详情 |
| GET | `/api/job/match/evidence/:resultId` | 获取证据链 |
| GET | `/api/job/match/requirements/:id/results` | 获取某岗位的所有匹配结果 |

### 6.2 请求/响应示例

#### POST /api/job/match/search

Request:

```json
{
  "requirementId": "req-uuid",
  "filters": {
    "minScore": 60,
    "openToOpportunity": true,
    "locations": ["深圳", "远程"]
  },
  "limit": 20,
  "offset": 0
}
```

Response:

```json
{
  "total": 156,
  "results": [
    {
      "rank": 1,
      "candidateId": "cand-uuid",
      "score": 92,
      "breakdown": { "skill": 95, "experience": 90, "education": 85, "career": 98 },
      "headline": "8年前端架构师",
      "currentCompany": "腾讯科技",
      "matchedSkills": ["Vue3", "TypeScript", "Node.js"],
      "missingSkills": ["Rust"],
      "riskFlags": [],
      "reasoning": "候选人在前端架构领域经验深厚..."
    }
  ]
}
```

---

## 7. 非目标（Out of Scope）

P4-01 **不包含**以下能力：

| 能力 | 原因 | 未来 |
| :--- | :--- | :--- |
| Skill Graph 构建 | 属于 P4 后续 | P4-02 |
| 自动投递 | 需要匹配引擎先稳定 | P5 |
| 猎聘机器人 | 需要 Agent 框架 | P5 |
| 企业聊天 | 需要 IM 基础设施 | P6 |
| AI 面试评分 | 需要面试域 | P5 Offer Domain |
| 候选人主动推荐 | 需要行为数据 | P5 |
| 薪资预测 | 需要市场数据 | P6 |

---

## 8. 执行计划（Design Gate 后）

```
Design Gate 通过
  ↓
Schema Review Gate（3 新模型）
  ↓
Implement：Repository → Service → API
  ↓
Build
  ↓
Deploy / Staging
  ↓
Reality Test（匹配准确率验证）
  ↓
Fix
  ↓
P4-01 Gate Review
  ↓
FREEZE
```

---

## 9. Design Gate Checklist

设计阶段需要掌柜确认的 checklist：

- [ ] 定位声明：Matching Engine = Deterministic Service
- [ ] 架构分层：JobUnderstanding → Matching → Explanation
- [ ] Score 模型：4 维度 + 权重 + 计算公式
- [ ] 数据模型：3 新模型（JobRequirementProfile / TalentMatchResult / MatchEvidence）
- [ ] 证据边界：只读引用 Candidate Domain
- [ ] API Contract：6 条企业侧 API
- [ ] 非目标确认：7 项 Out of Scope

---

## Appendix A: 术语表

| 术语 | 定义 |
| :--- | :--- |
| Match Score | 0-100 综合匹配分 |
| Breakdown | 各维度分数分解 |
| Skill Gap | 要求技能 vs 已有技能的差距 |
| Risk Flag | 匹配风险标记 |
| Evidence | 匹配结论的事实来源 |
| Requirement Profile | 结构化的岗位要求 |
| Explanation | LLM 生成的自然语言解释 |
