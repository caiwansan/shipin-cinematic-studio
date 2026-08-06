# KUNLUN-S5.1-SHORTDRAMA-EMPLOYEE-REALITY.md

> S5.1 第二 AI Employee 商品 — 短剧导演 AI Employee（Phase B/C Reality）
> 日期: 2026-08-06 11:50 (CST) | 状态: ✅ **SD1-SD6 全 PASS**
> 依据: 掌柜 S5.1 Phase B 执行指令（最小实现: 只证明短剧员工像 Alice 一样运行）
> 定位: **验证 Alice 商品模板可跨域复制（招聘 → 短剧）, 不复制 Runtime**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/shortdrama-parser.ts | 新增: 3 组纯函数（prompt 构建 + Schema 校验, 零 LLM） |
| backend/src/routes/skill-tools-internal.routes.ts | +3 内部路由（token 门禁 + unifiedAIGateway.invokeAI） |
| backend/src/ecosystem/skill-asset.service.ts | +deliverShortDramaAssets（3 JSON/任务, 复用 Asset+UserAsset 零新表） |
| backend/scripts/s51-seed.mts | 幂等 seed: 4 def（员工 + 3 组件 Skill） |
| backend/scripts/s51-test.mts | SD1-SD6 Reality Gate |
| tools/hermes-runtime-skill.mjs | Tool Sandbox +3 薄工具 |

**基础设施增量（掌柜观察指标）**: Entitlement 0 改动 / Usage 0 改动 / Desktop 0 改动 / Hermes Runtime 核心 0 改动（仅 Tool Sandbox +3 条目）✅

## 1. Identity（SD1）

```
def-shortdrama-director     短剧导演 AI Employee   [script.analysis, storyboard.plan, prompt.optimize]
def-script-analyst          剧本分析 Skill        [script.analysis]     （组件, F1 同构 Alice）
def-storyboard-planner      分镜规划 Skill        [storyboard.plan]     （组件）
def-prompt-optimizer        Prompt 优化 Skill     [prompt.optimize]     （组件）
```
- agent_definition.code @unique 幂等 seed, 不覆盖已有
- Desktop 目录 API 自动发现（AgentDefinition 全量）

## 2. Skill Contract（SD2）

| Skill | 输入 | 输出 | Schema 校验 |
|---|---|---|---|
| script.analysis | scriptText | summary + characters + structure | 非法 → null → INVALID_TOOL_RESULT |
| storyboard.plan | sceneText, shots(1-20) | shots[{index,description,camera}] + summary | 空 shots → null; 数量 ≤20 截断 |
| prompt.optimize | shotDescription, style? | prompt + keywords + negativePrompt | 缺 prompt → null |

## 3. Runtime（SD3）

```
Entitlement Gate → executeSkillPlan（orchestrator, 零改动）
  → Hermes Tool Sandbox（+3 薄工具: input→route→result）
  → 内部路由（x-internal-token 门禁）
  → unifiedAIGateway.invokeAI（唯一 LLM 入口; 禁 narrativeGateway 直连 ✅）
  → 纯函数解析器 → source=real
```

## 4. Asset（SD4）

```
deliverShortDramaAssets → script-analysis.json + storyboard-plan.json + optimized-prompts.json
  → Asset + UserAsset 落库（复用, 零新表）→ URL 可加载
```

## 5. Reality Gate 结果（实测 19 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| SD1 | Identity | ✅ | def 唯一 active; 目录 API 可发现 |
| SD2 | Skill Boundary | ✅ | 3 组件 Skill 授权 AUTHORIZED; 3 内部路由存在且 token 门禁生效; Parser 纯函数 8 项单测 |
| SD3 | Runtime | ✅ | Entitlement→Hermes→3 Skill 全链 COMPLETED, 3 工具 source=real; storyboard shots 数量限制生效 |
| SD4 | Asset | ✅ | 3 JSON 创建 + Asset/UserAsset 各 3 条 + URL 200 |
| SD5 | Commercial | ✅ | 未授权 → 拒绝; capabilityCodes 加 code → 执行 |
| SD6 | Alice 回归 | ✅ | Alice 3 Skills 保持 + 执行 COMPLETED + 授权隔离保持 |

## 6. 完成标准对照

```
短剧导演 AI Employee: 可发现 ✅ + 可授权 ✅ + 可执行 ✅ + 可产出资产 ✅ + 可计量 ✅ + 不影响 Alice ✅
基础设施增量 ≈ 0（Entitlement/Usage/Desktop/Hermes 核心零改动）
→ Alice 商品模板跨域复制成立（招聘 → 短剧）
→ 昆仑镜从「单员工产品」进化为「AI Employee Platform」
→ Marketplace 前置（3+ 稳定员工）推进 2/3
```

## 7. 未完成项

- [ ] 短剧域工作台深度集成（hdz/workspace 员工启动页参数对接, 可选）
- [ ] S5.2 Plugin Ecosystem Reality（插件如何增强员工能力, 掌柜后续裁决）
- [ ] S5.3 Enterprise Billing Reality（Plan/Seat/Usage Pricing, 仍不支付）
- [ ] Marketplace（继续冻结, 前置 3+ 员工 + 质量审核）

## 8. 结论

```
S5.1 Phase B/C: ✅ 通过
「复制模式, 不复制 Runtime」成立 —— 新增第二个员工, 基础设施增量接近零
→ 第三个员工商品（S5.2 或后续）将是同一模板的再次复制
```
