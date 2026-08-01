# Sprint-10D Career Identity SSOT Integration Audit — COMPLETE ✅

**Date:** 2026-07-31  
**Gate:** 掌柜验收通过 ✅

## 架构收敛

### Before: 三路事实源并行注入 LLM

```
用户输入
  ↓
CareerConversationProfile (Sprint-10B)  ← 独立字段
  ↓
SessionCareerState.confirmedFacts      ← 独立字段
  ↓
CareerSummaryGenerator                  ← 从历史消息解析
  ↓
LLM 收到 3-4 套矛盾的事实
```

### After: 唯一路径

```
用户输入
  ↓
CareerIdentityProfile (SSOT)
  ↓
Context Builder
  ↓
LLM 收到 1 套结构化事实
```

## Reality Gates

| Gate | 结果 | 验证 |
|------|------|------|
| G1 Single Source | ✅ PASS | buildIdentityCardSection 只接受 identityCard 参数，conversationProfile 不再传入 |
| G2 No Contradiction | ✅ PASS | Turn1: Python/React/Java → Turn2: +大模型/AI (原技能保留) |
| G3 New Window | ✅ PASS | 新对话正确读取 "王磊" + "10年经验" + "Python/Java/React/AI/大模型" |
| G4 Projection | ✅ PASS | CandidateCard 使用 profile.yearsExperience 而非自算 |

## 6 项修改

| Task | 文件 | 修改 |
|------|------|------|
| T01 | career-conversation-profile.ts | 接口标记 @deprecated，+toConversationProfile 适配器，mergeProfiles 废弃 |
| T02 | career-conversation-orchestrator.ts | buildIdentityCardSection 删除 conversationProfile 参数，prompt 函数收敛 |
| T03 | career-conversation-orchestrator.ts | SessionCareerState 降级为仅对话状态(stage/pendingExtraction/lastTurnSummary) |
| T03 | career-conversation-orchestrator.ts | 删除 4 个废弃方法(syncProfileToCareerState/updateConversationIdentityCard/等) |
| T04 | career-advisor.service.ts | 新增 generateFromIdentityProfile 方法 |
| T05 | candidate-card-projection.service.ts | projectCard 使用 profile.yearsExperience 替代 calculateYearsExperience |

## 禁止原则（已记录）

❌ careerAdvisor 自己存一份事实  
❌ Career Agent 自己存一份事实  
❌ Resume 再复制一份事实  
❌ Matching 再解析一份事实  

→ 统一 CareerIdentityProfile 作为 SSOT

## 下一步：Sprint-10E Product Reality Test

不继续写架构代码。

- Test 01: 首次体验（5分钟聊天→画像→简历卡）
- Test 02: 画像质量（检查错误事实）
- Test 03: 付费价值感（"我替你工作" vs "我帮你分析"）

最大风险不再是技术，而是用户是否感受到"这是我的职业助理员工"。
