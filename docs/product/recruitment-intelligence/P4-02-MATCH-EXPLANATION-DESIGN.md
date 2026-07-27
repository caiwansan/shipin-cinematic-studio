# P4-02 MatchExplanationService — Design Document

> **状态**: DRAFT → 待掌柜 CTO Review  
> **日期**: 2026-07-25  
> **作者**: 小二 (OpenClaw)  
> **审批人**: 掌柜 (CTO)  
> **依赖**: P4-01 Talent Matching Engine ✅ FROZEN

---

## 1. Service 定位

### 1.1 一句话定义

> **MatchExplanationService = AI Presentation Layer**
> 
> 将 P4-01 的确定性匹配结果 + 证据链，转化为人类可读的招聘决策辅助文本。

### 1.2 在架构中的位置

```
 ┌─────────────────────────────────────────────────────┐
 │ P3 Candidate Domain (FROZEN)                         │
 │ CareerProfile / WorkExperience / Education / Skills   │
 └───────────────────────┬─────────────────────────────┘
                         │ (只读)
                         ▼
 ┌─────────────────────────────────────────────────────┐
 │ P4-01 Talent Matching Engine (FROZEN)                │
 │ Deterministic Score + Evidence Chain                  │
 └───────────────────────┬─────────────────────────────┘
                         │ (MatchResult + Evidence)
                         ▼
 ┌─────────────────────────────────────────────────────┐
 │ P4-02 MatchExplanationService ◄── 当前               │
 │ LLM Explanation (Human-Readable Reasoning)            │
 └───────────────────────┬─────────────────────────────┘
                         │ (Explanation DTO)
                         ▼
 ┌─────────────────────────────────────────────────────┐
 │ Enterprise API (Candidate Card + Score + Explanation) │
 └─────────────────────────────────────────────────────┘
```

### 1.3 核心原则

| 原则 | 说明 |
|:---|:---|
| **LLM 是解释层，不是真相层** | Score 和 Ranking 永远由 P4-01 Service 决定 |
| **输入冻结** | 只能消费 P4-01 的 MatchResult + Evidence，不能绕过 |
| **Evidence 约束** | LLM 生成的每一条结论必须有 Evidence 支撑 |
| **无状态** | 纯函数：MatchResult + Evidence → Explanation，无副作用 |
| **幂等** | 相同输入 → 相同输出（temperature=0 或 prompt cache） |

---

## 2. LLM Boundary（红线）

### 2.1 LLM 可以 ✅

| 能力 | 示例 |
|:---|:---|
| 生成自然语言摘要 | "候选人与岗位高度匹配，尤其在前端开发领域" |
| 归纳证据 | "候选人的 Vue3 项目经验与岗位要求高度吻合" |
| 生成面试建议 | "建议重点验证候选人的系统设计能力" |
| 格式化输出 | 按模板输出 strengths / gaps / suggestions |
| 识别潜在风险 | "候选人缺少金融行业经验，但技术栈匹配度高" |

### 2.2 LLM 禁止 ❌

| 禁止行为 | 原因 |
|:---|:---|
| 修改 score 数值 | Score 是 P4-01 的确定性输出 |
| 修改 ranking 顺序 | Ranking 由 score 决定 |
| 编造不存在的经历 | 所有结论必须有 Evidence 引用 |
| 修改 matchedSkills / missingSkills | 这是 P4-01 的计算结果 |
| 直接读取 Candidate Domain | 必须通过 Projection + MatchResult |
| 生成无 evidence 的结论 | 每一条 claim 必须有对应 evidence |

---

## 3. 输入 Schema（冻结）

### 3.1 ExplanationRequest

```typescript
interface ExplanationRequest {
  // ── 匹配结果（来自 P4-01）──
  matchResultId: string;
  score: number;                                    // 0-100，P4-01 计算
  breakdown: {
    skill: number;                                  // 0-100
    experience: number;                             // 0-100
    education: number;                              // 0-00
    career: number;                                 // 0-100
  };
  
  // ── 技能匹配（来自 P4-01）──
  matchedSkills: Array<{
    name: string;                                   // "Vue3"
    level: string;                                  // "advanced"
    required: boolean;                              // true=required, false=preferred
    confidence: number;                             // 0-1
  }>;
  missingSkills: Array<{
    name: string;                                   // "Kubernetes"
    required: boolean;
  }>;
  
  // ── 证据链（来自 P4-01）──
  evidenceList: Array<{
    evidenceType: string;                           // "skill_match" | "experience_match" | ...
    claim: string;                                  // "候选人具备 5 年前端开发经验"
    sourceType: string;                             // "work_experience" | "candidate_skill" | ...
    sourceId: string;                               // P3 Frozen Domain 记录 ID
    confidence: number;                             // 0-1
  }>;
  
  // ── 风险标记（来自 P4-01）──
  riskFlags: Array<{
    type: string;                                   // "low_skill_match" | "insufficient_experience" | ...
    severity: 'low' | 'medium' | 'high';
    detail: string;
  }>;
  
  // ── 岗位上下文（来自 P4-01 JobRequirement）──
  jobTitle: string;                                 // "前端开发工程师"
  enterpriseId: string;                             // 用于 Model Router 路由
  
  // ── 控制参数 ──
  language?: 'zh' | 'en';                           // 默认 zh
  maxSuggestions?: number;                          // 默认 3
}
```

### 3.2 输入约束

| 约束 | 说明 |
|:---|:---|
| **不传 CandidateProfile** | 不传 CareerProfile / WorkExperience / Education 原始数据 |
| **不传 userId** | Explanation 不需要知道候选人的 userId |
| **enterpriseId 必填** | 用于 Model Router 路由（选择企业的 LLM 配置） |
| **matchResultId 必填** | 用于审计追踪（Explanation → MatchResult → Evidence） |

---

## 4. 输出 Schema（冻结）

### 4.1 ExplanationOutput

```typescript
interface ExplanationOutput {
  // ── 元数据 ──
  matchResultId: string;                            // 输入的回引
  generatedAt: string;                              // ISO 8601
  modelUsed: string;                                // 实际使用的模型（审计用）
  
  // ── 核心输出 ──
  summary: string;                                  // 1-2 句总结，<=100 字
  
  strengths: Array<{
    claim: string;                                  // "Vue3 项目经验与岗位要求高度吻合"
    evidenceIds: string[];                          // 引用的 evidence sourceId
    category: 'skill' | 'experience' | 'education' | 'career';
  }>;
  
  gaps: Array<{
    claim: string;                                  // "缺少金融行业经验"
    evidenceIds: string[];                          // 引用的 evidence sourceId
    severity: 'low' | 'medium' | 'high';
    mitigable: boolean;                             // 是否可弥补（可学习 vs 硬性要求）
  }>;
  
  interviewSuggestions: Array<{
    focus: string;                                  // "系统设计能力"
    reason: string;                                 // "岗位需要独立负责模块设计"
    evidenceIds: string[];
  }>;
  
  // ── 风险提示 ──
  riskWarnings: Array<{
    type: string;                                   // 同 P4-01 riskFlags.type
    description: string;                            // 人类可读描述
    evidenceIds: string[];
  }>;
  
  // ── 置信度 ──
  confidence: number;                               // 0-1，Explanation 自身置信度
}
```

### 4.2 输出约束

| 约束 | 说明 |
|:---|:---|
| **summary <= 100 字** | 简洁，HR 扫一眼就能判断 |
| **strengths ≤ 5 条** | 避免信息过载 |
| **gaps ≤ 5 条** | 同上 |
| **interviewSuggestions ≤ 5 条** | 同上限 |
| **每条 claim 必须有 evidenceIds** | 无 evidence 的 claim 不允许输出 |
| **confidence < 0.5 时标记** | 证据不足，LLM 不确定 |

---

## 5. Model Router 接入

### 5.1 复用策略

| 组件 | 现有实现 | P4-02 策略 |
|:---|:---|:---|
| **ModelRouterService** | `src/services/enterprise/model-router.service.ts` | ✅ 直接复用 |
| **EnterpriseLlmService** | `src/services/enterprise/enterprise-llm.service.ts` | ✅ 直接复用 |
| **Secret Vault** | `src/services/crypto.service.ts` (encryptKey/decryptKey) | ✅ 已集成在 EnterpriseLlm |
| **API Key 管理** | `enterprise_llm_config` 表 | ✅ 企业已有配置 |
| **调用统计** | `llm-usage-record` | ✅ 复用 GEO 模块的统计 |

### 5.2 路由调用方式

```typescript
// P4-02 调用 Model Router 的方式
const routeResult = await modelRouterService.resolve({
  tenantId: request.enterpriseId,
  agentType: 'talent_matching',       // 新增 agentType
  taskType: 'explanation',            // 新增 taskType
});

if (!routeResult) {
  // Fallback: 使用平台默认模型
  return generateFallbackExplanation(request);
}

const llmConfig = modelRouterService.toLLMConfig(routeResult);
```

### 5.3 Fallback 策略

| 场景 | 策略 |
|:---|:---|
| 企业无 LLM 配置 | 使用平台默认模型（DeepSeek） |
| LLM 调用超时（>10s） | 返回 Template-Based Explanation（非 LLM） |
| LLM 返回格式错误 | 重试 1 次，仍失败则 Template Fallback |
| LLM 返回无 evidence 的 claim | 服务端过滤，剔除无 evidence 的 claim |

---

## 6. Prompt 设计

### 6.1 System Prompt（模板）

```
你是一名资深招聘专家。你的职责是根据匹配结果和证据链，为 HR 生成简洁、准确的候选人评估摘要。

## 规则

1. 所有结论必须基于提供的证据，禁止编造
2. 每条结论必须引用对应的证据 ID
3. 保持客观中立，不带主观偏见
4. 简洁明了，每条结论不超过 50 字
5. 如果证据不足，明确标注"证据不足"
6. 不修改任何分数或排名

## 输出格式

严格按照 JSON 格式输出，不要包含任何额外文本。
```

### 6.2 User Prompt（模板）

```
## 岗位信息
- 职位：{jobTitle}
- 综合匹配分：{score}/100

## 维度分数
- 技能匹配：{breakdown.skill}/100
- 经验匹配：{breakdown.experience}/100
- 教育匹配：{breakdown.education}/100
- 职业匹配：{breakdown.career}/100

## 技能匹配情况
### 已匹配技能
{matchedSkills 列表}

### 缺失技能
{missingSkills 列表}

## 证据链
{evidenceList 列表，每条包含 claim + evidenceType + confidence}

## 风险标记
{riskFlags 列表}

---

请生成：
1. 1-2 句总结（<=100 字）
2. 优势列表（≤5 条，每条引用 evidence）
3. 差距列表（≤5 条，每条引用 evidence）
4. 面试建议（≤5 条）
5. 风险提示（如有）
```

---

## 7. Evidence 约束机制

### 7.1 服务端验证（Post-LLM）

LLM 返回后，Service 必须执行以下验证：

```typescript
function validateExplanation(
  output: ExplanationOutput,
  evidenceList: EvidenceItem[]
): ValidationResult {
  const validIds = new Set(evidenceList.map(e => e.sourceId));
  const errors: string[] = [];
  
  // 1. 每条 strength 必须有有效的 evidenceIds
  for (const s of output.strengths) {
    const valid = s.evidenceIds.every(id => validIds.has(id));
    if (!valid) errors.push(`strength "${s.claim}" 引用了无效 evidence`);
  }
  
  // 2. 每条 gap 必须有有效的 evidenceIds
  for (const g of output.gaps) {
    const valid = g.evidenceIds.every(id => validIds.has(id));
    if (!valid) errors.push(`gap "${g.claim}" 引用了无效 evidence`);
  }
  
  // 3. summary 不能包含无 evidence 的具体数字
  // （正则检查：数字 + 年/月/个 等量词）
  
  return { valid: errors.length === 0, errors };
}
```

### 7.2 验证失败处理

| 场景 | 处理 |
|:---|:---|
| 部分 claim 无效 evidence | 剔除无效 claim，保留有效部分 |
| 全部 claim 无效 | 返回 Template Fallback |
| summary 包含无依据数字 | 替换为模糊表述 |

---

## 8. 文件结构（预期）

```
src/services/matching/
├── services/
│   ├── talent-matching.service.ts    ← P4-01 (FROZEN)
│   └── match-explanation.service.ts  ← P4-02 (新增)
├── routes/
│   ├── talent-matching.routes.ts     ← P4-01 (FROZEN)
│   └── match-explanation.routes.ts   ← P4-02 (新增)
└── validators/
    └── explanation.validator.ts      ← P4-02 (新增)
```

**注意**：P4-02 不新增任何数据库表或字段。Explanation 是实时计算、实时返回的，不需要持久化。

---

## 9. API 设计（预期）

### 9.1 端点

| 方法 | 路径 | 认证 | 说明 |
|:---|:---|:---|:---|
| POST | `/api/job/match/explain` | JWT | 生成匹配解释 |
| GET | `/api/job/match/results/:id/explanation` | JWT | 获取匹配结果的解释 |

### 9.2 POST /api/job/match/explain 请求体

```json
{
  "matchResultId": "uuid",
  "language": "zh",
  "maxSuggestions": 3
}
```

### 9.3 响应

```json
{
  "matchResultId": "uuid",
  "generatedAt": "2026-07-25T19:30:00Z",
  "modelUsed": "deepseek-chat",
  "summary": "候选人技术栈与岗位高度匹配（Vue3/TypeScript），但缺少金融行业经验。建议进入技术面试环节。",
  "strengths": [
    {
      "claim": "Vue3 + TypeScript 全栈开发经验 5 年，与岗位要求高度吻合",
      "evidenceIds": ["we-001", "cs-003"],
      "category": "skill"
    }
  ],
  "gaps": [
    {
      "claim": "无金融行业从业经验",
      "evidenceIds": ["we-001"],
      "severity": "medium",
      "mitigable": true
    }
  ],
  "interviewSuggestions": [
    {
      "focus": "系统设计能力",
      "reason": "岗位需要独立负责前端架构设计",
      "evidenceIds": ["mr-001"]
    }
  ],
  "riskWarnings": [],
  "confidence": 0.92
}
```

---

## 10. 数据边界（RED LINE）

| 边界 | 规则 |
|:---|:---|
| **P4-02 读取 Candidate Domain** | ❌ 禁止。只能通过 MatchResult + Evidence 获取信息 |
| **P4-02 写入 Candidate Domain** | ❌ 禁止。同 P4-01 |
| **P4-02 写入 MatchResult** | ❌ 禁止。MatchResult 是 P4-01 的不可变输出 |
| **P4-02 持久化 Explanation** | ❌ 不持久化。实时计算、实时返回 |
| **P4-02 调用 P4-01 Service** | ✅ 可以。通过 matchResultId 查询已有结果 |
| **P4-02 调用 Model Router** | ✅ 可以。通过 enterpriseId 路由 |

---

## 11. 错误处理

| 场景 | HTTP 状态 | 响应 |
|:---|:---|:---|
| matchResultId 不存在 | 404 | `{ error: "Match result not found" }` |
| 企业无 LLM 配置 | 200 | 返回 Template Fallback（标记 `fallback: true`） |
| LLM 超时 | 200 | 返回 Template Fallback（标记 `fallback: true`） |
| LLM 返回格式错误 | 500 | `{ error: "Explanation generation failed" }` |
| 权限不足 | 403 | `{ error: "Access denied" }` |

---

## 12. 实施计划

```
P4-02 Design Gate          ← 当前（本文档）
  ↓ APPROVED
P4-02 Implement-01: MatchExplanationService
  → match-explanation.service.ts
  → explanation.validator.ts
  ↓
P4-02 Implement-02: Routes + API
  → match-explanation.routes.ts
  → 注册到 index.ts
  ↓
P4-02 Validation: Reality Test
  → p4-validation-03.ts
  → 验证 LLM 输出 + Evidence 约束
  ↓
P4-02 Gate Review → FREEZE
```

---

## 13. 验收标准

| Gate | 标准 |
|:---|:---|
| **Design Gate** | 掌柜 CTO 审批本文档 |
| **Implement Gate** | 代码编译通过，0 新增 TS 错误 |
| **Reality Gate** | API 返回正确 Explanation，evidence 约束 100% 生效 |
| **Evidence Gate** | LLM 输出的每一条 claim 都有有效 evidenceId |
| **Boundary Gate** | P4-02 无 P3 Candidate Domain 直接访问 |

---

## 14. 审批

- [ ] 掌柜 CTO 审批 → **APPROVED**
- [ ] 日期: ___________

---

*P4-02 MatchExplanationService Design — 完*
