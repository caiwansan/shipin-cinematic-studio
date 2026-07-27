# P3 Schema Review Gate

> **状态**: PENDING — 待掌柜 Review
> **创建**: 2026-07-25
> **关联**: CANDIDATE_DOMAIN_V1.md ✅ FROZEN
> **Schema**: `backend/prisma/schema.prisma` — P3 Candidate Domain 块（第 8125+ 行）

---

## 1. Schema 验证结果

```
npx prisma validate → ✅ The schema is valid
```

---

## 2. Boundary Check

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| Profile 是否唯一 | ✅ | `userId @unique` + `candidateId @unique` |
| Resume 是否依附 Profile | ✅ | `CandidateResume.profileId` → `CareerProfile.id`， Cascade Delete |
| Card 是否 Projection | ✅ | `CandidateCard.profileId @unique`，仅存储公开摘要字段 |
| Skill 是否有 Evidence | ✅ | 三层结构：Skill → CandidateSkill → SkillEvidence |
| Timeline 是否 Event | ✅ | `CareerTimelineEvent`，无 `updatedAt`，Append-only |
| Offer 是否不存在 | ✅ | P3 Schema 中无 Offer 相关模型 |
| Job 是否不存在 | ✅ | P3 Schema 中无 Job 相关模型 |
| AI 评分表不存在 | ✅ | P3 Schema 中无 AI 评分/匹配结果模型 |
| 推荐结果不存在 | ✅ | P3 Schema 中无推荐相关模型 |
| 与现有 Resume 共存 | ✅ | 新模型改名 `CandidateResume`（表名 `candidate_resume`），不替代现有 `Resume` |

---

## 3. Model Relationship Diagram

```
User (1) ──────────────── (1) CareerProfile
                                  │
                                  ├── (N) WorkExperience
                                  ├── (N) Education
                                  ├── (N) CandidateSkill ── (N) SkillEvidence
                                  │            │
                                  │            └── (1) Skill（标准化词表）
                                  ├── (N) CandidateResume（自引用 ResumeDerivation）
                                  ├── (1) CandidateCard
                                  └── (N) CareerTimelineEvent
```

---

## 4. 新增 Model 清单

| Model | 表名 | 用途 | 行数估算 |
| --- | --- | --- | --- |
| `CareerProfile` | `career_profile` | 唯一真实档案（SSOT） | 1/User |
| `WorkExperience` | `work_experience` | 工作经历（事实数据） | 0-10/Profile |
| `Education` | `education` | 教育经历（事实数据） | 0-5/Profile |
| `CandidateResume` | `candidate_resume` | 派生简历（多版本） | 0-20/Profile |
| `CandidateCard` | `candidate_card` | 企业公开投影 | 1/Profile |
| `Skill` | `skill` | 标准化技能词表 | 预置 ~200 |
| `CandidateSkill` | `candidate_skill` | 人才技能关联（Level/Confidence） | 0-50/Profile |
| `SkillEvidence` | `skill_evidence` | 技能证据链 | 0-200/Profile |
| `CareerTimelineEvent` | `career_timeline_event` | 职业成长事件流 | 0-100/Profile |

---

## 5. 与现有 User 模型关系说明

**User 模型新增关联**：

```prisma
model User {
  // ... 现有字段不变 ...

  // ── P3 Candidate Domain ──
  careerProfile CareerProfile?
}
```

- 一对一关系：一个 User 终身只有一份 Career Profile
- `onDelete: Cascade`：User 删除时，Career Profile 及其所有关联数据级联删除
- 不修改 User 的任何现有字段或关联

**与现有招聘模型的关系**：

| 现有模型 | 与 P3 的关系 |
| --- | --- |
| `Resume`（企业侧） | 共存，不替代。P3 用 `CandidateResume` |
| `ResumeProfile`（企业侧） | 共存，不替代 |
| `JobCandidate`（企业侧） | 共存，未来通过 `careerProfileId` 桥接 |
| `TalentProfile`（企业侧） | 共存，不替代 |
| `CandidateMatch`（企业侧） | 共存，未来通过 `careerProfileId` 桥接 |

---

## 6. 关键设计决策

### 6.1 candidateId 引入

`CareerProfile` 新增 `candidateId` 字段（UUID，唯一），与 `userId` 分离：

- **userId**：账号身份，用于认证和关联
- **candidateId**：职业身份，用于 P4/P5 领域关联

未来一个 User 可能拥有 Candidate Profile + 企业账号 + Creator 身份，`candidateId` 让领域关系不依赖 `userId`。

### 6.2 Skill 三层结构

```
Skill（词表）→ CandidateSkill（人的技能）→ SkillEvidence（证据）
```

- `Skill`：标准化名称 + 别名（避免 "Go" vs "golang"）
- `CandidateSkill`：Level + Confidence + Source
- `SkillEvidence`：证据链（工作经历/GitHub/AI Interview/证书）

### 6.3 CareerTimelineEvent 不可变性

- **无 `updatedAt` 字段** — 创建后不可修改
- Correction 通过追加 `relatedEventId` 关联的 Correction Event 实现
- 原始事件永远保留（审计链完整）

### 6.4 CandidateResume 命名

与已有企业侧 `Resume` 模型共存，改名为 `CandidateResume`（表名 `candidate_resume`），避免冲突。

---

## 7. 不在 P3 Schema 范围内

| 内容 | 原因 | 所属 Phase |
| --- | --- | --- |
| AI 评分/匹配结果 | 属于 Recruitment Domain | P4 |
| 推荐结果 | 属于 P4 人才市场 | P4 |
| Offer 管理 | 属于 Offer Domain | P5 |
| Job 管理 | 属于 Recruitment Domain | P4 |
| 简历 PDF 生成 | 属于实现层 | P5 |
| Skill Graph 可视化 | 属于前端 | P5 |

---

## 8. Review 检查清单

掌柜 Review 前需确认：

- [ ] 8 个新 Model 字段完整且无歧义
- [ ] Boundary Check 全部通过
- [ ] 与现有 User 模型关系正确（1:1，Cascade Delete）
- [ ] 与现有招聘模型无冲突（共存策略）
- [ ] `candidateId` 引入合理
- [ ] Skill 三层结构满足 AI Matching 需求
- [ ] CareerTimelineEvent 不可变性设计正确
- [ ] CandidateResume 命名可接受
- [ ] 不在范围内的内容已列出

---

## 9. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-07-25 | 初始 Schema Draft，Resume → CandidateResume（避免与现有模型冲突） |
