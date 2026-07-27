# P3 Candidate Domain — Gate Review

> **Version:** 1.0
> **Date:** 2026-07-25
> **Author:** OpenClaw (小二)
> **Reviewer:** 掌柜 (CTO)
> **Status:** FROZEN

---

## 1. Executive Summary

### 目标

构建 Candidate Domain v1 — 求职者侧的「职业身份」数据层。

核心原则：

- Career Profile = Single Source of Truth（SSOT）
- Candidate Card = Projection（非 Copy）
- Timeline = Append-Only
- AI 只能修改 Projection，不能修改 Profile Source Data

### 完成范围

| 层 | 状态 |
| :--- | :---: |
| Prisma Schema（9 模型） | ✅ |
| Repository Layer（7 + job-agent-config） | ✅ |
| Service Layer（Projection + Timeline） | ✅ |
| API Routes（5 路由文件） | ✅ |
| Validation-01（API Reality Test） | ✅ 70/70 |
| Validation-02（Projection + Timeline） | ✅ 76/76 |

### 当前状态

```
Candidate Domain v1
 STATUS: FROZEN
```

---

## 2. Architecture Review

### 分层架构

```
┌─────────────────────────────────────────────────┐
│ API Layer                                       │
│  /api/job/profile                               │
│  /api/job/resumes                               │
│  /api/job/skills                                │
│  /api/job/card                                  │
│  /api/job/timeline                              │
├─────────────────────────────────────────────────┤
│ Service Layer                                   │
│  CandidateCardProjectionService                 │
│  CareerTimelineService                          │
├─────────────────────────────────────────────────┤
│ Repository Layer                                │
│  CareerProfile / WorkExperience / Education     │
│  CandidateResume / CandidateCard / Skill        │
│  CandidateSkill / SkillEvidence                 │
│  CareerTimelineEvent                            │
├─────────────────────────────────────────────────┤
│ Prisma ORM + PostgreSQL                         │
└─────────────────────────────────────────────────┘
```

### 数据流

```
CareerProfile (SSOT)
  +
WorkExperience + Education + Skill
  ↓
CandidateCard (Projection — 只读计算)
  ↓
Visibility Filter (Owner / Enterprise / Public)
  ↓
API Response
```

### 关键设计决策

| 决策 | 说明 |
| :--- | :--- |
| Candidate Card = Projection | 不存储冗余字段，每次读取时计算 |
| Career Profile = SSOT | 所有「此人真实情况」读取此表 |
| Timeline Append-Only | 无 `updatedAt`，Correction 追加新事件 |
| AI Modification Boundary | AI 只能改 Projection / 建议技能，不能改 Profile 事实 |
| candidateId ≠ userId | 职业身份与账号身份分离 |
| Skill 三层结构 | Skill → CandidateSkill → SkillEvidence |

---

## 3. Database Freeze

### 9 个冻结模型

| # | 模型 | 表名 | 说明 |
|:-:| :--- | :--- | :--- |
| 1 | CareerProfile | `career_profile` | 职业档案 SSOT |
| 2 | WorkExperience | `work_experience` | 工作经历 |
| 3 | Education | `education` | 教育经历 |
| 4 | CandidateResume | `candidate_resume` | 简历（派生） |
| 5 | CandidateCard | `candidate_card` | 投影卡片（计算） |
| 6 | Skill | `skill` | 标准技能词表 |
| 7 | CandidateSkill | `candidate_skill` | 个人技能关联 |
| 8 | SkillEvidence | `skill_evidence` | 技能证据链 |
| 9 | CareerTimelineEvent | `career_timeline_event` | 职业时间线事件 |

### Migration 状态

| Migration | 日期 | 状态 |
| :--- | :---: | :---: |
| `20260725000000_p3_candidate_domain` | 2026-07-25 | ✅ Applied |
| `20260726000000_job_agent_config` | 2026-07-26 | ✅ Applied |
| `20260727000000_fix_confidence_float` | 2026-07-27 | ✅ Applied |

### 数据库统计

- 总表数：424+
- 数据库：`aigc_scs` @ `localhost:5432`
- ORM：Prisma 6.x

---

## 4. API Contract Freeze

### User-Facing Routes（JWT `app.authenticate`）

| Method | Path | 说明 |
| :---: | :--- | :--- |
| GET | `/api/job/profile` | 获取/创建职业档案 |
| PUT | `/api/job/profile` | 更新职业档案 |
| POST | `/api/job/resumes` | 创建简历 |
| GET | `/api/job/resumes` | 获取简历列表 |
| GET | `/api/job/resumes/:id` | 获取简历详情 |
| DELETE | `/api/job/resumes/:id` | 删除简历 |
| POST | `/api/job/skills` | 附加技能 |
| GET | `/api/job/skills` | 获取技能列表 |
| DELETE | `/api/job/skills/:id` | 移除技能 |
| GET | `/api/job/card` | 获取 Candidate Card |
| POST | `/api/job/card/refresh` | 刷新投影 |
| GET | `/api/job/timeline` | 查询时间线 |
| GET | `/api/job/timeline/full` | 完整时间线（含 Correction 标记） |
| POST | `/api/job/timeline/events` | 追加事件 |
| GET | `/api/job/timeline/events/:eventId` | 事件详情 |
| POST | `/api/job/timeline/corrections` | 追加修正 |
| GET | `/api/job/timeline/stats` | 事件统计 |

### Admin Routes（`requireAdmin`）

| Method | Path | 说明 |
| :---: | :--- | :--- |
| GET | `/api/job/admin/agent-config` | 获取 Job Agent 配置 |
| PUT | `/api/job/admin/agent-config` | 更新 Job Agent 配置 |

---

## 5. Security Review

### API Key 加密

| 项目 | 状态 |
| :--- | :---: |
| 算法 | AES-256-GCM |
| 存储格式 | `apiKeyEncrypted` |
| 返回格式 | `••••` + 后 4 位 |
| 判定 | ✅ PASS |

### Permission Model

| 角色 | 可见范围 | 状态 |
| :--- | :--- | :---: |
| Owner | 全部字段（含 hiddenFields） | ✅ PASS |
| Enterprise | 过滤 hiddenFields | ✅ PASS |
| Public | 过滤 hiddenFields | ✅ PASS |

### Timeline Integrity

| 规则 | 状态 |
| :--- | :---: |
| 无 `updatedAt` 字段 | ✅ PASS |
| Correction 追加新事件，不修改原始事件 | ✅ PASS |
| `relatedEventId` 链接 Correction → Original | ✅ PASS |
| `hasCorrections` / `correctionCount` 自动标记 | ✅ PASS |

### AI Modification Boundary

| 边界 | 状态 |
| :--- | :---: |
| AI 可建议技能、更新置信度 | ✅ PASS |
| AI 不能修改 Work Experience / Education | ✅ PASS |
| AI 不能修改 Career Profile 核心事实 | ✅ PASS |
| AI 生成内容属于 Projection Layer | ✅ PASS |

---

## 6. Test Evidence

### Validation-01: API Reality Test

| Case | 断言数 | 结果 |
| :--- | :---: | :---: |
| Profile CRUD | 12 | ✅ 12/12 |
| Resume Chain | 14 | ✅ 14/14 |
| Skill Evidence | 18 | ✅ 18/18 |
| Job Agent Config | 10 | ✅ 10/10 |
| Permission Control | 16 | ✅ 16/16 |
| **小计** | **70** | **✅ 70/70** |

### Validation-02: Projection + Timeline Integration Test

| Case | 断言数 | 结果 |
| :--- | :---: | :---: |
| Candidate Card Projection | 20 | ✅ 20/20 |
| Visibility Boundary | 13 | ✅ 13/13 |
| AI Summary Projection | 12 | ✅ 12/12 |
| Timeline Statistics | 16 | ✅ 16/16 |
| Correction Chain | 15 | ✅ 15/15 |
| **小计** | **76** | **✅ 76/76** |

### 总计

| 测试 | 结果 |
| :--- | :---: |
| Validation-01 | 70/70 |
| Validation-02 | 76/76 |
| **Total** | **146/146** |

---

## 7. Freeze Decision

### 冻结范围

冻结内容：

- 9 个 Prisma 模型定义
- 所有 API 路由签名
- 数据库 Migration（3 个）
- Visibility 权限模型
- Timeline Append-Only 规则
- AI Modification Boundary

不在冻结范围（后续迭代）：

- Skill Graph Service（P4 详细设计）
- Resume Template Engine
- Candidate ↔ Recruitment 匹配逻辑
- 前端 Candidate Profile 页面

### 最终判定

```
╔══════════════════════════════════════════╗
║                                          ║
║   Candidate Domain v1.0                  ║
║   STATUS: FROZEN                         ║
║                                          ║
║   Date: 2026-07-25                       ║
║   Approved by: 掌柜 (CTO)                ║
║                                          ║
║   Next: Recruitment Intelligence Layer   ║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## 8. 增量部署验证流程（P4+ 执行原则）

> 掌柜 CTO 指令 2026-07-25

P4 起采用增量部署验证流程：

```
Implement
  ↓
Build
  ↓
Deploy/Staging
  ↓
Reality Test
  ↓
Fix
  ↓
Continue
```

禁止：

```
开发完成 → 全部文档 → 最后部署
```

要求：

- 每个 Feature 完成后立即部署到 Staging
- Reality Test 通过后才标记完成
- 发现问题立即修复，不累积到最终阶段

---

## Appendix A: 文件清单

### Schema & Migration

- `prisma/schema.prisma` — 9 个 P3 模型
- `prisma/migrations/20260725000000_p3_candidate_domain/migration.sql`
- `prisma/migrations/20260726000000_job_agent_config/migration.sql`
- `prisma/migrations/20260727000000_fix_confidence_float/migration.sql`

### Source Code

- `src/services/candidate/repositories/` — 8 repository 文件
- `src/services/candidate/services/` — 2 service 文件
- `src/services/candidate/routes/` — 5 route 文件

### Test

- `src/seeds/p3-validation-01.ts` — API Reality Test
- `src/seeds/p3-validation-02.ts` — Projection + Timeline Test

### Documentation

- `docs/product/candidate-domain/CANDIDATE_DOMAIN_V1.md` — 产品设计文档
- `docs/product/candidate-domain/P3-SCHEMA-REVIEW-GATE.md` — Schema Review Gate
- `docs/product/candidate-domain/P3-CANDIDATE-DOMAIN-GATE-REVIEW.md` — 本文档
