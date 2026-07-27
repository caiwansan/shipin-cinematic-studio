# P4-03 Job Understanding Service — Design Document

> **状态**: DRAFT → 待掌柜 CTO Review
> **日期**: 2026-07-25
> **作者**: 小二 (OpenClaw)
> **审批人**: 掌柜 (CTO)
> **依赖**: P4-01 Talent Matching Engine ✅ FROZEN / P4-02 MatchExplanationService ✅ FROZEN

---

## 1. Service 定位

### 1.1 一句话定义

> **Job Understanding Service = JD 结构化引擎**
>
> 将非结构化 JD 文本转化为 P4-01 可消费的 `JobRequirementProfile`。

### 1.2 在架构中的位置

```
 ┌─────────────────────────────────────────────────────┐
 │ 企业 HR 输入                                         │
 │ JD 文本 / 职位名称 / 部门 / 地点 / 薪资              │
 └───────────────────────┬─────────────────────────────┘
                         │
                         ▼
 ┌─────────────────────────────────────────────────────┐
 │ P4-03 Job Understanding Service ◄── 当前            │
 │ LLM 提取 → 结构化 → 校验 → 持久化                   │
 └───────────────────────┬─────────────────────────────┘
                         │ (JobRequirementProfile)
                         ▼
 ┌─────────────────────────────────────────────────────┐
 │ P4-01 Talent Matching Engine (FROZEN)               │
 │ 确定性匹配计算                                       │
 └───────────────────────┬─────────────────────────────┘
                         │
                         ▼
 ┌─────────────────────────────────────────────────────┐
 │ P4-02 MatchExplanationService (FROZEN)              │
 │ 人类可读解释                                         │
 └─────────────────────────────────────────────────────┘
```

### 1.3 核心原则

| 原则 | 说明 |
|:---|:---|
| **LLM 只负责提取** | 不决定匹配、不修改分数、不做招聘决策 |
| **输出可验证** | 结构化结果必须通过 Schema 校验 |
| **HR 可覆盖** | LLM 提取后，HR 可手动修正任何字段 |
| **幂等** | 同一 JD 多次提取，结果一致（低 temperature） |
| **无状态** | JD 文本 → JobRequirementProfile，无副作用 |

---

## 2. LLM Boundary（红线）

### 2.1 LLM 可以 ✅

| 能力 | 示例 |
|:---|:---|
| 提取技能要求 | 从 JD 中识别 "Vue3"、"TypeScript" 为必需技能 |
| 分类技能等级 | 区分 "精通" vs "了解" → required vs preferred |
| 提取经验年限 | "3-5年" → experienceMin: 3, experienceMax: 5 |
| 提取学历要求 | "本科及以上" → educationMin: "bachelor" |
| 识别行业领域 | "互联网"、"金融" → industries |
| 结构化输出 | 按 JSON Schema 输出 |

### 2.2 LLM 禁止 ❌

| 禁止行为 | 原因 |
|:---|:---|
| 决定候选人是否匹配 | 这是 P4-01 的职责 |
| 修改 Match Score | 这是 P4-01 的确定性输出 |
| 修改 Candidate Domain 任何数据 | P3 冻结，只读 |
| 编造 JD 中不存在的要求 | 只能提取，不能臆测 |
| 修改已有 JobRequirementProfile 的匹配结果 | 只创建/更新 requirement 本身 |
| 删除 MatchResult | 完全不碰 P4-01 数据 |

---

## 3. 数据流

### 3.1 输入

```typescript
interface JobUnderstandingInput {
  enterpriseId: string;        // 企业 ID（必需）
  jobTitle: string;            // 职位名称（必需）
  jobDescription: string;      // JD 文本（必需，>= 50 字符）
  department?: string;         // 部门（可选）
  location?: string;           // 工作地点（可选）
  salaryMin?: number;          // 薪资下限（可选）
  salaryMax?: number;          // 薪资上限（可选）
  employmentType?: string;     // 雇佣类型（可选）
  language?: 'zh' | 'en';      // 输出语言（默认 zh）
}
```

### 3.2 输出（JobRequirementProfile）

```typescript
interface StructuredRequirement {
  // ── 基本信息（LLM 提取 + HR 可覆盖）──
  jobTitle: string;
  jobDescription?: string;

  // ── 技能要求 ──
  requiredSkills: Array<{
    name: string;              // 技能名称（标准化）
    level?: 'expert' | 'proficient' | 'intermediate' | 'beginner';
    yearsRequired?: number;     // 该技能最低年限
  }>;
  preferredSkills: Array<{
    name: string;
    level?: 'expert' | 'proficient' | 'intermediate' | 'beginner';
  }>;

  // ── 经验要求 ──
  experienceMin: number;        // 最低年限
  experienceMax?: number;       // 最高年限

  // ── 教育要求 ──
  educationMin?: string;        // high_school | associate | bachelor | master | doctorate
  preferredMajors?: string[];   // 优先专业

  // ── 行业要求 ──
  industries: string[];         // 行业领域

  // ── 职位信息 ──
  employmentType?: string;      // full_time | part_time | contract | internship
  location?: string;
  remoteOption?: 'onsite' | 'hybrid' | 'remote';
  salaryMin?: number;
  salaryMax?: number;

  // ── 匹配权重（LLM 建议，HR 可覆盖）──
  weights?: {
    skill: number;              // 默认 40
    experience: number;         // 默认 30
    education: number;          // 默认 15
    career: number;             // 默认 15
  };

  // ── 元数据 ──
  extractionConfidence: number; // LLM 提取置信度 0-1
  extractedAt: string;          // ISO timestamp
  modelUsed: string;            // 使用的模型
}
```

### 3.3 持久化

写入 `job_requirement_profile` 表（P4-01 已创建，FROZEN）。

**不新增表、不新增 Migration。** 复用现有 `JobRequirementProfile` 模型。

---

## 4. 处理流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 输入校验                                                  │
│    - jobTitle 非空                                          │
│    - jobDescription >= 50 字符                              │
│    - enterpriseId 有效                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 技能名称标准化                                            │
│    - 调用 Skill 表进行 canonical 匹配                        │
│    - "JS" → "JavaScript"                                    │
│    - "py" → "Python"                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. LLM 提取                                                  │
│    - System Prompt: 结构化提取指令                          │
│    - User Prompt: JD 文本                                   │
│    - temperature: 0.2（低温度，高确定性）                   │
│    - maxTokens: 2048                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Schema 校验                                               │
│    - JSON 格式合法                                          │
│    - requiredSkills 非空                                    │
│    - experienceMin >= 0                                     │
│    - educationMin 在枚举内                                  │
│    - weights 总和 = 100（如有）                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 后处理                                                    │
│    - 技能去重                                               │
│    - 经验范围校验（min <= max）                             │
│    - 默认值填充                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 持久化                                                    │
│    - 写入 job_requirement_profile                           │
│    - status = "draft"（HR 审核后 → "active"）              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. LLM Prompt 设计

### 5.1 System Prompt（中文）

```
你是一名资深 HR 专家。你的职责是从 JD 文本中提取结构化的岗位要求。

## 规则
1. 只提取 JD 中明确提及的要求，禁止臆测
2. 技能名称使用标准技术名词（如 "JavaScript" 而非 "JS"）
3. 经验年限：明确数字提取，模糊表述保守估计
4. 学历要求：只提取明确标注的最低学历
5. 行业：只提取明确提及的行业
6. 如果 JD 中某项信息不存在，不要编造

## 输出格式
严格按照 JSON 格式输出，不要包含任何额外文本：
{
  "requiredSkills": [{ "name": "技能名", "level": "expert|proficient|intermediate|beginner", "yearsRequired": 3 }],
  "preferredSkills": [{ "name": "技能名", "level": "expert|proficient|intermediate|beginner" }],
  "experienceMin": 3,
  "experienceMax": 5,
  "educationMin": "bachelor",
  "preferredMajors": ["计算机科学"],
  "industries": ["互联网"],
  "employmentType": "full_time",
  "remoteOption": "hybrid",
  "weights": { "skill": 40, "experience": 30, "education": 15, "career": 15 },
  "extractionConfidence": 0.9
}

## 枚举值说明
- level: expert(精通) | proficient(熟练) | intermediate(一般) | beginner(了解)
- educationMin: high_school | associate | bachelor | master | doctorate
- employmentType: full_time | part_time | contract | internship
- remoteOption: onsite | hybrid | remote
```

### 5.2 User Prompt

```
请从以下 JD 中提取岗位要求：

## 职位名称
{jobTitle}

## JD 文本
{jobDescription}

## 补充信息
- 部门：{department}
- 工作地点：{location}
- 薪资范围：{salaryMin} - {salaryMax}
```

---

## 6. Validation 规则

| 字段 | 规则 | 失败处理 |
|:---|:---|:---|
| `jobTitle` | 非空，<= 100 字符 | 400 错误 |
| `jobDescription` | >= 50 字符 | 400 错误 |
| `requiredSkills` | 非空数组，每项 name 非空 | 400 错误 |
| `experienceMin` | >= 0 | 设为 0 |
| `experienceMax` | >= experienceMin（如有） | 设为 experienceMin |
| `educationMin` | 在枚举内 | 忽略该字段 |
| `weights` | 总和 = 100（如有） | 使用默认值 |
| `extractionConfidence` | 0-1 | 忽略 |

---

## 7. 文件结构

```
src/services/matching/
├── services/
│   └── job-understanding.service.ts    ← 新增
├── routes/
│   └── job-understanding.routes.ts     ← 新增
├── validators/
│   └── job-understanding.validator.ts  ← 新增
seeds/
└── p4-validation-04.ts                  ← 新增
```

**不新增 Migration、不新增表。** 复用 P4-01 的 `job_requirement_profile` 表。

---

## 8. API 设计

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `POST` | `/api/job/understand` | 从 JD 文本提取结构化要求 |
| `POST` | `/api/job/understand/validate` | 校验结构化结果（不持久化） |
| `GET` | `/api/job/understand/supported-skills` | 获取支持的技能词表（用于前端提示） |

### 8.1 POST /api/job/understand

**请求体：**
```json
{
  "jobTitle": "高级前端工程师",
  "jobDescription": "负责...（>= 50 字符）",
  "department": "技术部",
  "location": "北京",
  "salaryMin": 25000,
  "salaryMax": 40000
}
```

**响应：**
```json
{
  "id": "uuid",
  "status": "draft",
  "extracted": {
    "requiredSkills": [...],
    "preferredSkills": [...],
    "experienceMin": 3,
    "experienceMax": 5,
    "educationMin": "bachelor",
    ...
  },
  "extractionConfidence": 0.92,
  "modelUsed": "gpt-4",
  "createdAt": "2026-07-25T19:37:00Z"
}
```

### 8.2 POST /api/job/understand/validate

**请求体：** 同 `/api/job/understand`

**响应：** 只返回校验结果，不持久化
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "extracted": { ... }
}
```

---

## 9. 错误处理

| 场景 | HTTP | 说明 |
|:---|:---|:---|
| JD 文本过短（< 50 字符） | 400 | "JD 文本至少需要 50 字符" |
| LLM 返回格式错误 | 502 | "JD 解析失败，请重试" |
| LLM 超时（> 30s） | 504 | "JD 解析超时，请重试" |
| Schema 校验失败 | 422 | 返回具体校验错误 |
| 企业不存在 | 404 | "企业不存在" |
| 未授权 | 401 | JWT 校验失败 |

---

## 10. Fallback 机制

| 场景 | 降级策略 |
|:---|:---|
| LLM 不可用 | 返回错误（不 Template Fallback）— JD 提取必须准确 |
| LLM 返回格式错误 | 重试 1 次（相同 prompt） |
| 重试仍失败 | 返回 502 + 错误详情 |

**设计理由：** JD 提取结果直接影响匹配质量，不能用 Template 降级。LLM 失败 = 用户需要重试或手动输入。

---

## 11. 实现计划

| 步骤 | 内容 | 产出 |
|:---|:---|:---|
| Implement-01 | `job-understanding.validator.ts` | Schema 校验 + 技能标准化 |
| Implement-02 | `job-understanding.service.ts` | LLM 提取 + 后处理 + 持久化 |
| Implement-03 | `job-understanding.routes.ts` | API 路由 + 注册 |
| Build | `tsc --noEmit` | 0 errors |
| Deploy | `pm2 restart` | Staging 部署 |
| Reality Test | `p4-validation-04.ts` | 端到端验证 |
| Gate Review | 掌柜 CTO 审核 | FROZEN |

---

## 12. 边界确认

| 边界 | 说明 |
|:---|:---|
| **P3 Candidate Domain** | ❌ 不读取、不修改 |
| **P4-01 MatchResult** | ❌ 不读取、不修改 |
| **P4-02 Explanation** | ❌ 不读取、不修改 |
| **JobRequirementProfile** | ✅ 创建、读取、更新 |
| **Skill 词表** | ✅ 只读（用于标准化） |

---

_设计文档结束。待掌柜 CTO Review。_
