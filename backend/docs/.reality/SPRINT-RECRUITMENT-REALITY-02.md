# Sprint-RECRUITMENT-REALITY-02 — AI Employee Reality Upgrade

**日期:** 2026-08-01 00:35 CST
**Gate:** G1 AI真实性 ✅ / G2 模型治理 ✅ / G4 数据真实性 ✅（Runtime Verified）
**范围:** Phase 1 仅（Bob + Alice + Matching），未动订阅/新 Agent/知识图谱

---

# 目标

> 用户购买 AI 招聘员工后，真的得到 AI 员工。
> 让 Alice / Bob / Carol 三个招聘员工全部成为真实 AI Agent。

# 完成 Task

| Task | 优先级 | 交付 | 状态 |
|------|--------|------|------|
| T01 Bob LLM 评估 | 🔴 P0 | `interview-agent.ts` `generateEvaluationWithLLM` + evaluate 路由改造 + questionScores 回写 | ✅ Runtime Verified |
| T02 Bob 动态面试题 | 🔴 P0 | `generateInterviewPlanWithLLM`（删除 Math.random 模板出题） | ✅ Runtime Verified |
| T03 Alice AI JD 生成 | 🔴 P0 | `generateJDWithLLM` + 招聘策略输出（定位/画像/关键词/面试重点/风险） | ✅ Runtime Verified |
| T04 统一匹配算法 | 🟠 P1 | `simple-match.adapter.ts` — 三套算法 → 唯一 TalentMatchingEngine（0.40/0.30/0.15/0.15） | ✅ Runtime Verified |

# 核心改动

## Task 01+02 — Bob 真实化

```
改造前（假 AI）:
  题目 = TECHNICAL_TEMPLATES + Math.random()
  评分 = 前端提交 score（前端甚至硬编码 score: 70）
  评估 = avgScore 公式聚合（默认70分）

改造后（真 AI）:
  POST /:id/generate-questions → LLM（JD+岗位要求+简历 → 个性化出题 5-7 题）
  POST /:id/submit-answers   → 🔴 只接受 answer，忽略前端 score（评分只能来自 AI）
  POST /:id/evaluate         → LLM 逐题评分 + 综合评估（overall/technical/communication/culture/
                               strengths/risks/recommendation/summary/nextSteps/questionScores）
                               questionScores 按真实 questionId 回写 InterviewQuestion.score
  旧模板方法保留为 fallback（LLM 不可用/解析失败时降级，打日志 + aiSource=fallback）
```

## Task 03 — Alice 真实化

```
改造前: generateJD = 模板字符串拼接（buildDescription/buildRequirements）

改造后:
  POST /api/enterprise/jd/generate → generateJDWithLLM（企业 LLM 配置）
  输出扩展: positioning(岗位定位) / targetProfile(候选人画像) / keywords(筛选关键词)
            / interviewFocus(面试重点) / risks(风险点) / qualityScore / improvements
  recruitment-director executeSubTask 同步接入 LLM 版
  旧 generateJD 保留为 fallback（aiSource=fallback 标记）
```

## Task 04 — 统一匹配

```
新文件: src/services/matching/simple-match.adapter.ts
  matchSimpleCandidates() → 内部调用 talent-matching.service 的 matchCandidate（唯一引擎）

删除的私有权重:
  ❌ recruit-agent.matchCandidates:  0.35/0.2/0.2/0.15/0.1（技能/经验/城市/薪资/学历）
  ❌ search-agent.searchTalents:     0.30/0.20/0.15/0.15/0.10/0.10（6维）
  ✅ 统一: talent-matching.service  matchCandidate: skill 0.40 / exp 0.30 / edu 0.15 / career 0.15

LLM 边界（保持）: LLM 只解释推荐理由/风险，不参与排名计算（排名 = matchScore 降序）
```

# Runtime Reality Test（真实 LLM 验证，deepseek-chat 企业配置）

| 测试 | 输入 | 结果 |
|------|------|------|
| T01 统一匹配 | 3 候选人 vs Python/AI 岗位 | ✅ c1=90(全中) > c3=55 > c2=41，确定性，权重 0.40/0.30/0.15/0.15 |
| T02 Alice JD | AI应用工程师 18-25K | ✅ aiSource=llm，LLM 输出定位/画像/关键词/面试重点/风险全齐 |
| T03 Bob 出题 | 支付重构+RAG 简历 | ✅ aiSource=llm，7 题全个性化（"支付系统重构中处理高并发一致性，请说明RAG索引更新…"） |
| T04 Bob 评估 | 优质回答 vs 未回答 | ✅ aiSource=llm，未答行为题 0 分，回答空洞 45-60 分，无默认 70 分 |
| T05 questionId 回写 | 真实 DB id | ✅ LLM 按 [id=xxx] 返回真实 id，回写成功 |
| T06 E2E DB 闭环 | 建 session→出题→提交→评估 | ✅ 7 题 LLM 评分全回写 DB，overall=35 真实反映测试回答质量，测试数据已清理 |

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 AI 真实性 | Alice/Bob 输入→LLM 输出（aiSource=llm 实测） | ✅ PASS |
| G2 模型治理 | 统一 executeViaGateway + enterpriseLlmConfig（provider=deepseek 实测） | ✅ PASS |
| G4 数据真实性 | 无 Math.random 出题 / 无前端 score / 无默认70分 / 无假推荐 | ✅ PASS |

# 附带发现（不在本次范围，记录待治理）

| # | 发现 | 建议 |
|---|------|------|
| 1 | `recruitment-orchestrator.service.ts` 全仓 0 引用（死代码），内含模板 JD stage | Phase5 式死代码审计时归档 |
| 2 | `services/enterprise/interview-agent.service.ts` 有 CareerProfile.skills 类型错误（存量） | 与 enterprise.routes.ts match 段同源类型问题，待 schema 对齐 |
| 3 | 12 个 enterpriseLlmConfig 中 11 个 key 失效/未配置，仅 `4e2f6062` deepseek-chat 有效 | 需掌柜确认测试租户 key 配置策略 |
| 4 | 演示租户 8aed92ac（Alice/Bob/Carol）无企业 LLM 配置 → 功能会降级 fallback | 演示环境需配置企业 LLM key 才能展示 AI 能力 |

# 验证方式

- `npx tsc --noEmit`：本次改动 6 文件 0 错误（存量错误不属本次范围）
- `npx pm2 restart api-server`：服务已重启生效（tsx 直跑，无需编译）
- Runtime 测试：service 层真实 LLM 调用 + DB 闭环（一次性数据已清理）
