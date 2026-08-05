# KUNLUN-S3.4.1-BLOCKED-PREPARATION-REALITY.md

> S3.4.1-BLOCKED PREPARATION — Reality Gate
> 日期: 2026-08-06 07:15 (CST) | 状态: ✅ **RP1-RP4 全 PASS（零 LLM 阶段）**
> 提交: feat(skill): real resume.parse + asset delivery (S3.4.1-blocked)
> 依据: 掌柜 S3.4.1-BLOCKED 执行指令 / C3 Reality First（不 mock LLM / 不冒充 / 不绕过）
> 定位: **LLM 无关基础设施做实；AI Employee Reality Gate 保持暂停（等待真实 Provider）**

---

## 0. 阶段状态

```
S3.4.1 全链路实施: ⛔ 暂停（LLM Provider 阻断, 见 S3.4-LLM-PROVIDER-REALITY-AUDIT.md）
S3.4.1-BLOCKED PREPARATION: ✅ 完成
  ✅ Task 01 resume.parse 真实化
  ✅ Task 02 Asset Delivery 管道
  ✅ Task 03 LLM Gateway Reality Probe（文档化）
  ⏸ Task 04 Planner LLM / candidate.score / interview.evaluate（等待 Provider）
  ❌ AI Employee Reality Gate RA1-RA5（保持暂停）
```

## 1. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/routes/skill-tools-internal.routes.ts | 内部工具路由（resume-parse, x-internal-token 门禁, fail-closed） |
| backend/src/ecosystem/skill-asset.service.ts | Asset 交付（JSON + PDF 骨架 → Asset/UserAsset, D4 每任务） |
| backend/src/routes/skill-assets.routes.ts | POST /api/skills/assets/deliver |
| tools/hermes-runtime-skill.mjs | resume.parse 工具 → 真实后端解析（Policy 不变） |
| backend/scripts/s341-sample-pdf.mts | 样例中文简历 PDF（pdf-lib + SimHei） |
| backend/scripts/s341-test.mts | RP1-RP4 + Asset 管道测试 |
| backend/package.json | +pdf-lib |
| docs/.reality/S3.4-LLM-PROVIDER-REALITY-AUDIT.md | LLM Provider 阻断审计 |
| docs/.reality/KUNLUN-S3.4.1-BLOCKED-PREPARATION-REALITY.md | 本报告 |

**未修改**: prisma/schema.prisma / migrations / Gateway / LLM 模块 / Commerce / Skill SSOT ✅

## 2. Task 01 — resume.parse 真实化（RP1-RP4 全 PASS, 实测 15 PASS / 0 FAIL）

```
真实 PDF（resume-sample.pdf, 中文简历）
  → pdftotext 文本提取（pdf-text-extractor）
  → ResumeParserAgent（确定性正则解析, 零 LLM）
  → 结构化: 姓名/邮箱/电话/教育/专业/技能(≥5)/经验(5年)/薪资/职业目标/项目
  → evaluateQuality（规则引擎评分）
  → Hermes Tool Policy 执行（resume.parse 已在 allowedTools）
  → KernelEvent 审计
```

| Gate | 判定 | 证据 |
|---|---|---|
| RP1 | 真实 PDF 输入 | ✅ 张伟/zhangwei@example.com/13812345678/5 年 全提取 |
| RP2 | resume.parse Skill Execution | ✅ Hermes COMPLETED + source=real + profile.name=张伟 |
| RP3 | KernelEvent 审计 | ✅ executionId/toolCalls/result 落库 |
| RP4 | 不涉及 LLM | ✅ 内部路由零 LLM 引用 + llmInvolved=false |

## 3. Task 02 — Asset Delivery 管道

```
输入: resume.parse 结果（真实 profile + quality）
  → candidate-analysis.json（真实结构化数据）
  → candidate-report.pdf（pdf-lib + SimHei 中文字体, 骨架渲染真实数据）
  → Asset(type=other) + UserAsset(type=document)（D4: 每任务目录）
  → /uploads/skill-assets/<taskId>/… 静态可访问（HTTP 200 实测）
```

- 禁止项确认: 无假造 AI 分析内容（PDF 仅渲染真实字段 + 规则评分）
- 中文字体: SimHei.ttf → /opt/kunlun/assets/fonts/（不入 git; 下载失败降级 Helvetica）

## 4. Task 03 — LLM Provider Reality Audit

两层阻断确认（详见 S3.4-LLM-PROVIDER-REALITY-AUDIT.md）:
```
L1: DEEPSEEK_API_KEY 未配置 / OPENAI_API_KEY 占位 / 无 ollama
L2: Gateway 无平台默认 fallback（强制 BYOK, UserModelConfigV2 表未建）
```
解阻路径 A（提供 Key）/ B（BYOK 建表, S4 决策提前）/ C（Gateway 平台默认 fallback）待掌柜裁决。

## 5. 验收对照

| 掌柜验收项 | 状态 |
|---|---|
| ✅ resume.parse 真实工作 | ✅ 确定性真实解析 |
| ✅ Asset Pipeline 可交付 | ✅ JSON + PDF + Asset/UserAsset + URL 可访问 |
| ✅ Gateway Reality 明确 | ✅ 两层阻断审计文档化 |
| ✅ S3.4 LLM Blocker 文档化 | ✅ S3.4-LLM-PROVIDER-REALITY-AUDIT.md |
| ❌ AI Employee Reality Gate | ⏸ 保持暂停（等待 Provider） |

## 6. 安全纪律

- 内部 token（KUNLUN_INTERNAL_TOKEN）: .env 追加（gitignored）, 不入代码/文档/日志
- 内部路由 fail-closed: 无 token 环境直接拒绝
- Key 处理: 等待掌柜提供 → 服务器安全配置 → Gateway Probe → RA Gate（顺序冻结）

## 7. 下一步（等待 Provider 条件满足）

```
掌柜提供 DeepSeek Key + 解阻路径裁决（B/C）
  → Planner LLM（意图→SkillPlan, invokeAI）
  → candidate.score / interview.evaluate（Skill LLM Tool, 经 Gateway）
  → S3.4 AI Employee Reality Gate RA1-RA5（上传→Alice→报告→资产→审计）
```

## 8. 结论

```
S3.4.1-BLOCKED PREPARATION: ✅ 无 LLM 依赖部分全部做实
真实 resume.parse / 可交付资产管道 / 阻断文档化 —— 无一造假, 无一绕过。
等 Provider 点火, Alice 即可成为第一个真实 AI 员工。
```
