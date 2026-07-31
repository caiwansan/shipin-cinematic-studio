# HDZ-DIRECT-LLM-USAGE — 混沌珠直接 LLM 调用清单

- Sprint: ShortDrama-Reality-Recovery-Phase5 / Task 5.1-B
- 日期: 2026-07-31
- 性质: 审计报告（只列风险，不迁移）。混沌珠为独立业务线，**不在短剧工作台 SSOT 冻结清单内**

---

## 结论

混沌珠（hdz）存在**完整的旁路 LLM 调用系统**：`services/hdz/llm.client.ts` 通过**直接 HTTP fetch**（`${baseUrl}/chat/completions`）调用 LLM，**完全不经过 narrativeGateway**（全仓 0 引用）。文件头注释自述："混沌珠内部专用的 LLM 调用封装，**绕过 broken 的 unifiedAIGateway adapter imports**"。

## 调用矩阵（15 个调用方）

| 文件 | callLLM 次数 | 用途 |
|------|-------------|------|
| `services/hdz/writer.service.ts` | 4 | 写作（章节生成） |
| `services/hdz/llm.client.ts` | 2 | analyzeStyleDna 等内部封装 |
| `services/hdz/worldbuilder.service.ts` | 1 | 世界观构建 |
| `services/hdz/screenwriter.service.ts` | 1 | 剧本化 |
| `services/hdz/reviewer.service.ts` | 1 | 审校 |
| `services/hdz/planner.service.ts` | 1 | 规划 |
| `services/hdz/master-plan.service.ts` | 1 | 主计划 |
| `services/hdz/master-plan-analyzer.service.ts` | 1 | 主计划分析 |
| `services/hdz/event-extractor.service.ts` | 1 | 事件抽取 |
| `services/hdz/director.service.ts` | 1 | 导演 |
| `services/hdz/character-state-evolution.service.ts` | 1 | 角色状态演化 |
| `services/hdz/character.service.ts` | 1 | 角色 |
| `routes/hdz/story-event.ts` | 1 | 故事事件 |
| `routes/hdz/novel-reference.ts` | 1 | 小说参考 |
| `routes/hdz/master-plan.ts` | 1 | 主计划 API |
| `routes/hdz/chat.ts` | 1 | 聊天 |

## 调用方式

```
callLLM(llmCfg, systemPrompt, userMessage)
  ↓ 从 UserModelConfigV2 读取 BYOK 配置（decryptKey 解密，不硬编码 key ✅）
  ↓ 直接 fetch `${baseUrl}/chat/completions`
  ↓ 返回文本
```

## 风险

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| R1 | 绕过统一网关 | 🟠 中 | 无 narrativeGateway 的统一限流/审计/回退/模型映射 |
| R2 | 双 LLM 路径并存 | 🟠 中 | 短剧走 narrativeGateway，混沌珠走直连，行为不一致 |
| R3 | 错误处理各自为政 | 🟡 低 | 直连 fetch 的重试/超时策略与网关不同 |
| R4 | 未来网关升级不同步 | 🟡 低 | 若网关加能力（缓存/评估），混沌珠拿不到 |
| R5 | 模型名映射本地化 | 🟡 低 | resolveDeepSeekModel 在 llm.client 内实现，与全局映射可能漂移 |

## 缓解现状（已有）

- ✅ BYOK 纪律：不硬编码任何 API Key（decryptKey 解密用户配置）
- ✅ usage-quota 计数：incrementDailyUsage 调用（有计量）
- ✅ 模型名自动迁移（deepseek-chat → deepseek-v4-flash）

## 替代方案（不立即执行，供掌柜决策）

| 方案 | 说明 | 成本 |
|------|------|------|
| A. 保持现状 | 混沌珠独立线，网关能力不共享 | 0 |
| B. 迁移 narrativeGateway | callLLM 改为经网关执行，统一审计/限流 | 中（15 个调用方回归测试） |
| C. 网关提供 adapter 直连 API | narrativeGateway 暴露 executeRaw()，混沌珠改调 | 中（需先修 unifiedAIGateway imports） |

## 建议

混沌珠是活跃业务线（前端 6 个页面调用），**Phase 5 不做迁移**。建议作为独立 Sprint 评估方案 B/C，前提是 unifiedAIGateway adapter imports 修复完成。
