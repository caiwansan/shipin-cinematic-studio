# KUNLUN-S3.4.2-B-CANDIDATE-SCORE-REALITY.md

> S3.4.2-B candidate.score Realization — Reality Gate
> 日期: 2026-08-06 08:15 (CST) | 状态: ✅ **CS1-CS6 全 PASS**
> 提交: feat(skill): candidate.score realization (S3.4.2-B)
> 依据: 掌柜 S3.4.2-B 执行指令（CS1-CS6 冻结）
> 定位: **AI 员工可以完成专业判断（真实 LLM 评分, 非 mock）**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/score-parser.ts | buildScorePrompt（纯函数）+ parseScoreResult（Schema 校验, CS3） |
| backend/src/routes/skill-tools-internal.routes.ts | +POST /api/internal/skill-tools/candidate-score（token 门禁, invokeAI 唯一入口, CS2） |
| tools/hermes-runtime-skill.mjs | candidate.score 真实化（薄调用方: 内部路由, 零 provider SDK/Key 接触） |
| backend/scripts/s342b-test.mts | CS1-CS6 Reality Gate |
| docs/.reality/KUNLUN-S3.4.2-B-CANDIDATE-SCORE-REALITY.md | 本报告 |

**未修改（禁止范围）**: prisma/schema.prisma / migrations（无 CandidateScore 表）/ Gateway / Hermes 生命周期 ✅

## 1. 实现链路

```
Hermes candidate.score 工具（真实）
  → POST /api/internal/skill-tools/candidate-score（x-internal-token）
  → buildScorePrompt（固定评审角色 + JSON 契约）
  → unifiedAIGateway.invokeAI（dev provider; 唯一 LLM 入口, CS2）
  → parseScoreResult（Schema: score 0-100 / strengths / risks / recommendation）
  → 非法 → INVALID_TOOL_RESULT（拒绝, 不当最终结果, CS3）
  → 合法 → { score, strengths, risks, recommendation, source:real }
```

## 2. Reality Gate 结果（实测 20 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| CS1 | 真实评分 | ✅ | 张伟 profile + Java 岗位 → score(0-100) + strengths/risks/recommendation（真实 DeepSeek） |
| CS2 | LLM Boundary | ✅ | hermes 工具零 provider SDK/Key; 内部路由仅 invokeAI + token 门禁 |
| CS3 | 输出 Schema | ✅ | {"hello":"xxx"} / 非 JSON / score 非数字 → null; 合法 → 结构完整; score 钳制 0-100 |
| CS4 | Asset Delivery | ✅ | candidate-analysis.json + report.pdf → Asset/UserAsset → /uploads/ 可访问 |
| CS5 | Audit | ✅ | InvocationLog（provider=deepseek, latencyMs, success）+ KernelEvent（toolCalls/result） |
| CS6 | Gateway Regression | ✅ | payment → POLICY_REJECTED; Planner from-intent 正常; executeSkillPlan 回归 COMPLETED |

## 3. 边界确认

- ✅ LLM 输出必过 Schema 校验才成为工具结果（不把 LLM 输出直接当最终结果）
- ✅ Skill 工具不接触 API Key / 不直连 provider（唯一入口 = Unified AI Gateway）
- ✅ 零新表（无 CandidateScore 表）; 审计 = InvocationLog + KernelEvent
- ❌ 未做 candidate.score 缓存/表存储（评分随任务, 结果入资产 JSON）; 未做 interview.evaluate（S3.4.2-C）

## 4. 完成定义（S3.4.2-B）

```
✅ candidate.score = 真实 Hermes Tool → 内部路由 → Gateway → DeepSeek → 结构化评分 → 资产
AI 员工可以完成专业判断（评分/优势/风险/建议）
```

## 5. 未完成事项（后续阶段）

- [ ] S3.4.2-C interview.evaluate 真实化 + Alice Killer Demo（上传→解析→评分→评估→报告, RA4/RA5）
- [ ] S4: 调用方 BYOK 解析（当前内部工具调用用 dev 合成身份）

## 6. 结论

```
S3.4.2-B: ✅ AI 员工可以完成专业判断
下一步: S3.4.2-C interview.evaluate（AI 员工交付岗位成果）
```
