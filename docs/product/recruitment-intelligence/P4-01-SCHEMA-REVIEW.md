# P4-01 Talent Matching Engine — Schema Review

> **Version:** 1.0
> **Date:** 2026-07-25
> **Author:** OpenClaw (小二)
> **Reviewer:** 掌柜 (CTO)
> **Status:** PENDING SCHEMA GATE
> **Depends on:** P4-01 Design ✅ APPROVED · Candidate Domain v1.0 ✅ FROZEN

---

## 1. Schema Diff

### 1.1 新增模型概览

| # | 模型 | 表名 | 数据性质 | 说明 |
|:-:|:---|:---|:---|:---|
| 1 | JobRequirementProfile | `job_requirement_profile` | **Derived** | JD 结构化结果，非岗位原文 |
| 2 | TalentMatchResult | `talent_match_result` | **Computed** | 匹配计算结果 |
| 3 | MatchEvidence | `match_evidence` | **Computed** | 匹配结论的证据链 |

### 1.2 数据性质标记

```
所有 P4-01 模型均为 Derived / Computed Data

❌ 不是 Fact Data（事实数据）
❌ 不是 Source of Truth
✅ 永远可以从 Candidate Domain + JD 重新计算

Fact Data 唯一来源：Candidate Domain (FROZEN)
```

---

## 2. 字段级 Schema 定义

### 2.1 JobRequirementProfile

> JD 的结构化解析结果。输入是 JD 文本，输出是匹配引擎可消费的结构化条件。

```prisma
model JobRequirementProfile {
  id                String   @id @default(uuid()) @map("id") @db.Uuid

  // ── 来源信息 ──
  enterpriseId      String   @map("enterprise_id") @db.Uuid  // 创建企业
  jobTitle          String   @map("job_title")                // 岗位名称
  jobDescription    String?  @map("job_description")          // 原始 JD 文本（参考）

  // ── 结构化要求（Derived from JD）──
  requiredSkills    Json     @map("required_skills")
  // [{ "skillId": "uuid", "skillName": "Vue3", "minLevel": "advanced" }]
  preferredSkills   Json?    @map("preferred_skills")
  // [{ "skillId": "uuid", "skillName": "React" }]

  experienceMin     Int      @default(0) @map("experience_min")
  experienceMax     Int?     @map("experience_max")
  educationMin      String?  @map("education_min")  // bachelor | master | phd
  preferredMajors   String[] @map("preferred_majors")
  industries        String[]

  // ── 职位信息 ──
  employmentType    String?  @map("employment_type")
  location          String?
  remoteOption      String?  @map("remote_option")  // onsite | remote | hybrid
  salaryMin         Int?     @map("salary_min")
  salaryMax         Int?     @map("salary_max")

  // ── 匹配配置 ──
  weights           Json?    // 自定义权重，覆盖默认 { skill: 0.4, experience: 0.3, ... }

  // ── 状态 ──
  status            String   @default("draft")  // draft | active | closed
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // ── Relations ──
  matchResults      TalentMatchResult[]

  @@index([enterpriseId])
  @@index([status])
  @@map("job_requirement_profile")
}
```

**字段分类：**

| 字段 | 性质 | 数据来源 |
|:---|:---|:---|
| enterpriseId | 事实 | 企业账号 |
| jobTitle | 事实 | 企业输入 |
| jobDescription | 事实 | 企业输入（原文保存） |
| requiredSkills | **Derived** | LLM 解析 JD → 匹配 Skill 词表 |
| preferredSkills | **Derived** | LLM 解析 JD |
| experienceMin/Max | **Derived** | LLM 解析 JD |
| educationMin | **Derived** | LLM 解析 JD |
| weights | 配置 | 企业自定义 or 系统默认 |
| status | 状态 | 企业操作 |

### 2.2 TalentMatchResult

> 一次匹配计算的结果。可重算，可删除，不影响任何事实数据。

```prisma
model TalentMatchResult {
  id                String   @id @default(uuid()) @map("id") @db.Uuid

  // ── 关联（只读引用）──
  jobRequirementId  String   @map("job_requirement_id") @db.Uuid
  candidateId       String   @map("candidate_id") @db.Uuid  // CareerProfile.candidateId
  profileId         String   @map("profile_id") @db.Uuid    // CareerProfile.id（只读引用）

  // ── 匹配分数（Computed）──
  score             Int                                         // 0-100
  breakdown         Json                                        // { skill: 92, experience: 85, ... }

  // ── 匹配详情（Computed）──
  matchedSkills     Json     @map("matched_skills")
  // [{ "skillId": "uuid", "skillName": "Vue3", "level": "expert", "confidence": 0.95 }]
  missingSkills     Json     @map("missing_skills")
  // [{ "skillId": "uuid", "skillName": "Rust", "importance": "required" }]
  skillGap          Json?    @map("skill_gap")
  // [{ "skillName": "Rust", "currentLevel": null, "requiredLevel": "advanced" }]

  // ── 风险与解释 ──
  riskFlags         Json?    @map("risk_flags")
  // [{ "type": "skill_gap", "severity": "high", "message": "核心技能缺失" }]
  reasoning         String?                                     // LLM 生成
  reasoningAt       DateTime? @map("reasoning_at")

  // ── 排序 ──
  rank              Int?

  // ── 元数据 ──
  matchVersion      String   @default("v1") @map("match_version")
  createdAt         DateTime @default(now()) @map("created_at")

  // ── Relations ──
  jobRequirement    JobRequirementProfile @relation(fields: [jobRequirementId], references: [id], onDelete: Cascade)
  evidence          MatchEvidence[]

  @@unique([jobRequirementId, candidateId])
  @@index([jobRequirementId, score(sort: Desc)])
  @@index([candidateId])
  @@map("talent_match_result")
}
```

**字段分类：**

| 字段 | 性质 | 数据来源 |
|:---|:---|:---|
| jobRequirementId | 引用 | JobRequirementProfile |
| candidateId | 引用 | CareerProfile.candidateId（只读） |
| profileId | 引用 | CareerProfile.id（只读） |
| score | **Computed** | Matching Service 计算 |
| breakdown | **Computed** | Matching Service 计算 |
| matchedSkills | **Computed** | 对比 CandidateSkill + JobRequirement |
| missingSkills | **Computed** | 对比 CandidateSkill + JobRequirement |
| skillGap | **Computed** | 对比分析 |
| riskFlags | **Computed** | 规则引擎 |
| reasoning | **Computed** | LLM 生成 |
| matchVersion | 元数据 | 算法版本号（可重算标记） |

### 2.3 MatchEvidence

> 每个匹配结论的事实来源。建立 Computed Data → Fact Data 的审计链。

```prisma
model MatchEvidence {
  id                String   @id @default(uuid()) @map("id") @db.Uuid

  matchResultId     String   @map("match_result_id") @db.Uuid

  // ── 证据内容 ──
  evidenceType      String   @map("evidence_type")
  // skill_match | experience_match | education_match | career_match
  claim             String                                      // 声称文本
  sourceType        String   @map("source_type")
  // work_experience | education | candidate_skill | career_profile | skill_evidence
  sourceId          String   @map("source_id") @db.Uuid        // 指向 P3 Frozen Domain 记录
  confidence        Float                                       // 0-1

  createdAt         DateTime @default(now()) @map("created_at")

  // ── Relations ──
  matchResult       TalentMatchResult @relation(fields: [matchResultId], references: [id], onDelete: Cascade)

  @@index([matchResultId])
  @@index([sourceType, sourceId])
  @@map("match_evidence")
}
```

**字段分类：**

| 字段 | 性质 | 数据来源 |
|:---|:---|:---|
| evidenceType | 元数据 | 分类标记 |
| claim | **Computed** | 匹配引擎生成 |
| sourceType | 引用 | 指向 P3 模型名 |
| sourceId | 引用 | 指向 P3 记录 ID（只读） |
| confidence | **Computed** | 基于 CandidateSkill.confidence |

---

## 3. 数据边界说明

### 3.1 写入方向（单向）

```
JobRequirementProfile ──写──▶ TalentMatchResult ──写──▶ MatchEvidence
                                      │
                                      ▼
                              Candidate Domain (FROZEN)
                                 ↑ 只读，无写入
```

### 3.2 与 P3 Frozen Domain 的边界

| 操作 | P3 (CareerProfile etc.) | P4-01 (MatchResult etc.) |
|:---|:---|:---|
| 读取 | ✅ 匹配引擎读取 | ✅ 正常读取 |
| 写入 | ❌ 匹配引擎不可写 | ✅ 匹配引擎写入 |
| 删除 | ❌ 匹配引擎不可删 | ✅ 可清理重算 |
| 修改 | ❌ 匹配引擎不可改 | ✅ 可重算覆盖 |

### 3.3 API 数据来源映射

| API 字段 | 数据来源 | 性质 |
|:---|:---|:---|
| score | TalentMatchResult.score | Computed |
| breakdown | TalentMatchResult.breakdown | Computed |
| matchedSkills | TalentMatchResult.matchedSkills | Computed |
| missingSkills | TalentMatchResult.missingSkills | Computed |
| riskFlags | TalentMatchResult.riskFlags | Computed |
| reasoning | TalentMatchResult.reasoning | LLM Generated |
| evidence | MatchEvidence → P3 记录 | Computed → Fact |
| candidate.headline | CandidateCard.headline | Projection |
| candidate.currentCompany | CandidateCard.currentCompany | Projection |

### 3.4 企业 API 不暴露 Candidate 原始数据

```
企业 API 返回：
  ✅ Candidate Card Projection（公开字段）
  ✅ Match Score + Breakdown
  ✅ Reasoning（LLM 解释）
  ✅ Skill Gap（结构化差距）

企业 API 不返回：
  ❌ CareerProfile 原始数据
  ❌ WorkExperience 详情
  ❌ Education 详情
  ❌ CareerProfile.email / phone
```

---

## 4. Migration 风险分析

### 4.1 新增表（3 个）

| 表名 | 风险 | 说明 |
|:---|:---|:---|
| `job_requirement_profile` | 🟢 LOW | 新表，无存量数据 |
| `talent_match_result` | 🟢 LOW | 新表，无存量数据 |
| `match_evidence` | 🟢 LOW | 新表，无存量数据 |

### 4.2 对现有表的影响

| 现有表 | 影响 | 说明 |
|:---|:---|:---|
| `career_profile` | ✅ 无影响 | 无新增字段，无新增关联 |
| `candidate_card` | ✅ 无影响 | 无新增字段 |
| `candidate_skill` | ✅ 无影响 | 无新增字段 |
| `work_experience` | ✅ 无影响 | 无新增字段 |
| `education` | ✅ 无影响 | 无新增字段 |
| `career_timeline_event` | ✅ 无影响 | 无新增字段 |

### 4.3 回滚方案

```
所有 P4-01 数据均为 Computed / Derived

回滚方式：
  1. 删除 match_evidence 表数据
  2. 删除 talent_match_result 表数据
  3. 删除 job_requirement_profile 表数据
  4. 删除 3 个表

不影响任何 Candidate Domain 事实数据。
```

### 4.4 Migration 策略

```sql
-- 使用 IF NOT EXISTS 保证幂等性
-- 与 P3 migration 策略一致

CREATE TABLE IF NOT EXISTS job_requirement_profile (...);
CREATE TABLE IF NOT EXISTS talent_match_result (...);
CREATE TABLE IF NOT EXISTS match_evidence (...);

-- 索引
CREATE INDEX IF NOT EXISTS ...;
```

---

## 5. P3 兼容性检查

### 5.1 Schema 兼容性

| 检查项 | 结果 |
|:---|:---|
| P3 模型新增字段 | ❌ 无（不修改 P3） |
| P3 模型新增关联 | ❌ 无（不修改 P3） |
| P3 表新增索引 | ❌ 无（不修改 P3） |
| P3 Migration 修改 | ❌ 无（不修改 P3） |
| P3 API 变更 | ❌ 无（不修改 P3） |

### 5.2 数据流兼容性

| 检查项 | 结果 |
|:---|:---|
| P4 读取 P3 数据 | ✅ 通过 Prisma 正常读取 |
| P4 写入 P3 数据 | ❌ 禁止（代码层 + 架构层双重保障） |
| P3 API 响应变化 | ❌ 无（P3 API 不受影响） |
| P3 Validation 影响 | ❌ 无（已有测试不受影响） |

### 5.3 未来重算能力

```
TalentMatchResult 可全部清空重算：
  1. 算法升级时：清空旧结果，用新算法重新计算
  2. Candidate Domain 更新时：标记相关结果为 stale，按需重算
  3. 数据修复时：删除受影响的结果，重新匹配

重算不影响 Candidate Domain 任何数据。
```

---

## 6. Index 设计

### 6.1 TalentMatchResult 索引

| 索引 | 用途 |
|:---|:---|
| `@@unique([jobRequirementId, candidateId])` | 防止重复匹配 |
| `@@index([jobRequirementId, score(sort: Desc)])` | 按岗位查 Top N 候选人 |
| `@@index([candidateId])` | 反查某候选人的所有匹配记录 |

### 6.2 MatchEvidence 索引

| 索引 | 用途 |
|:---|:---|
| `@@index([matchResultId])` | 查某次匹配的所有证据 |
| `@@index([sourceType, sourceId])` | 反查某条 P3 记录被哪些匹配引用 |

### 6.3 JobRequirementProfile 索引

| 索引 | 用途 |
|:---|:---|
| `@@index([enterpriseId])` | 查企业的所有岗位要求 |
| `@@index([status])` | 按状态筛选（active / closed） |

---

## 7. Schema Gate Checklist

- [ ] 3 新模型字段定义确认
- [ ] 数据性质标记（Derived / Computed / Fact）确认
- [ ] P3 Frozen Domain 零修改确认
- [ ] 写入方向单向性确认
- [ ] 回滚方案确认
- [ ] Index 设计确认
- [ ] 企业 API 不暴露 Candidate 原始数据确认

---

## Appendix A: 完整 Schema Diff

```
新增：
+ model JobRequirementProfile
+ model TalentMatchResult
+ model MatchEvidence

修改：
（无）

删除：
（无）

P3 Frozen Domain 变动：
（无）
```

## Appendix B: ER 关系图

```
┌─────────────────────┐       ┌─────────────────────────┐
│ JobRequirement      │ 1───N │ TalentMatchResult       │
│ Profile             │       │                         │
│                     │       │  score (Computed)       │
│  requiredSkills     │       │  breakdown (Computed)   │
│  experienceMin      │       │  matchedSkills (Comp.)  │
│  educationMin       │       │  missingSkills (Comp.)  │
│  ...                │       │  reasoning (LLM)        │
└─────────────────────┘       │  profileId ─────────────┼──▶ CareerProfile (FROZEN, 只读)
                              └──────────┬──────────────┘
                                         │ 1───N
                                         ▼
                              ┌─────────────────────────┐
                              │ MatchEvidence           │
                              │                         │
                              │  claim (Computed)       │
                              │  sourceType (Ref)       │
                              │  sourceId (Ref) ────────┼──▶ P3 任意模型 (只读引用)
                              │  confidence (Computed)  │
                              └─────────────────────────┘
```
