# Sprint-ShortDrama-02 Task 02.2 — Director Decision Contract Reality

**Date:** 2026-07-31 16:34 CST
**Status:** COMPLETE ✅

---

## 目标

让 AI 导演从「观察」升级到「建议」：

```
Asset Quality Report        ← Task 02.1
 ↓
Director Decision Contract    ← 你在这里 ✅
 ↓
User Confirm
 ↓
Execution Task（预留）       ← Task 02.3
```

---

## 文件改动

| 文件 | 类型 | 说明 |
|------|------|------|
| `types/director-decision-contract.ts` | **新增** | 决策契约类型定义 |
| `services/director/director-decision-generator.service.ts` | **新增** | 决策生成器 |
| `routes/director-decision.route.ts` | **新增** | 决策 API（生成+确认+查询） |
| `src/index.ts` | 修改 | 注册路由 |

**无 DB schema 变更** ✅ — 决策存储在 TaskLog.metadata

---

## 决策契约

```typescript
interface DirectorDecisionContract {
  id: string                    // UUID
  assetId: string               // VideoTask.id
  decisionType: DecisionType    // 'keep' | 'regenerate' | 'modify_prompt' | 'replace_asset'
  reason: string                // 理由
  confidence: number            // 0-100
  suggestedAction: {
    description: string
    affectedAssets: string[]
    estimatedCost?: string
  }
  requiresConfirmation: true    // 类型锁死 🔒
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: Date
}
```

### 决策规则

| score | 条件 | decisionType | confidence |
|-------|------|-------------|------------|
| ≥ 75 | 已输出 | keep | 60-95 |
| ≤ 40 | 无输出 | regenerate | 50-90 |
| 41-74 | 有角色/场景问题 | modify_prompt | 55-85 |
| 41-74 | 其他 | modify_prompt | 50-85 |

---

## API

### POST /api/director/assets/:assetId/decision

生成导演建议：

```json
// 请求
POST /api/director/assets/442e2b88.../decision
Authorization: Bearer <token>

// 响应 (Case A — 高质量资产)
{
  "success": true,
  "decision": {
    "id": "uuid-...",
    "decisionType": "keep",
    "reason": "综合评分 80/100，未发现明显质量问题",
    "confidence": 67,
    "suggestedAction": {
      "description": "无需操作",
      "affectedAssets": ["project-id"]
    },
    "requiresConfirmation": true,
    "status": "pending"
  }
}
```

### POST /api/director/decisions/:decisionId/confirm

用户确认/拒绝决策：

```json
// 请求
{
  "assetId": "442e2b88...",
  "action": "confirmed",
  "note": "我确认"
}

// 响应
{
  "success": true,
  "data": {
    "status": "confirmed",
    "message": "用户已确认该建议。执行功能将在后续版本中提供。"
  }
}
```

### GET /api/director/assets/:assetId/decision

查询决策历史：

```json
{
  "success": true,
  "data": {
    "totalDecisions": 3,
    "decisions": [
      { "decisionType": "keep", "confidence": 67, ... }
    ]
  }
}
```

---

## Reality Tests

### Case A — 高质量资产 → keep ✅

| 输入 | 决策 | 预期 | 结果 |
|------|------|------|------|
| score=80, completed, rich prompt | decisionType=keep, confidence=67 | **keep** + requiresConfirmation=true | ✅ |

### Case B — 低质量资产 → regenerate ✅

| 输入 | 决策 | 预期 | 结果 |
|------|------|------|------|
| score=0, failed, no output | decisionType=regenerate, confidence=90 | **regenerate** + requiresConfirmation=true | ✅ |

### Case C — 确认/拒绝 ✅

| 端点 | 输入 | 预期 | 结果 |
|------|------|------|------|
| confirm | action=confirmed, note="确认" | status=confirmed | ✅ |
| confirm | action=rejected, note="不需要" | status=rejected | ✅ |

### Case D — 不存在资产 → 404 ✅

| 输入 | 预期 | 结果 |
|------|------|------|
| assetId=no-such-id | 404 ASSET_NOT_FOUND | ✅ |

### Case E — 决策历史可查询 ✅

| 端点 | 结果 |
|------|------|
| GET /api/director/assets/:assetId/decision | totalDecisions=3, 每条含 decisionType+confidence | ✅ |

---

## Reality Gates

| Gate | 要求 | 状态 |
|------|------|------|
| **D1** | Decision 不调用 Provider | ✅ 纯规则引擎，无 LLM 调用 |
| **D2** | Decision 不修改 Asset | ✅ 只写 TaskLog.metadata |
| **D3** | 所有建议需确认 | ✅ `requiresConfirmation` 类型锁死 = true |
| **D4** | 状态可追踪 | ✅ TaskLog.metadata.decisionAction 记录完整决策链 |
| **D5** | 未来可接 Execution | ✅ confirm API 已预留，Task 02.3 接入 |

---

## 明确禁止清单

| 禁止项 | 状态 |
|--------|------|
| 自动导演（AI 自主决定） | ❌ 不实现 |
| 自动重生成 Asset | ❌ 不实现 |
| 自动修改 Prompt | ❌ 不实现 |
| 自动提交 BullMQ | ❌ 不实现 |
| 新 Agent | ❌ 不实现 |
| 新 Runtime | ❌ 不实现 |

---

## 数据流（完整链路）

```
User clicks "生成"
 ↓
剧本 → 导演拆解 → AiSceneSpec
 ↓
Production Preparation → 补全 prompt
 ↓
Task Runtime (BullMQ) → Provider → Asset
 ↓
GET /api/director/assets/:assetId/quality     ← 02.1 观察
 ↓ AssetQualityReport
POST /api/director/assets/:assetId/decision    ← 02.2 建议 ← 你在这里
 ↓ DirectorDecisionContract
User sees: "AI建议保持/修改/重生成"
 ↓
POST /api/director/decisions/:id/confirm      ← 02.2 确认
 ↓ status: pending → confirmed | rejected
Task 02.3 → Execution Runtime                  ← 预留
```

---

## 代码统计

| 指标 | 值 |
|------|-----|
| 新增文件 | 3 |
| 修改文件 | 1 |
| 新增代码行 | ~480 |
| 删除代码行 | 0 |

---

## 是否可以进入 Task 02.3

### 条件

| 条件 | 状态 | 说明 |
|------|------|------|
| 观察层稳定 | ✅ | Task 02.1 验收通过 |
| 决策层就绪 | ✅ | Task 02.2 全部 Gate 通过 |
| 确认链路可用 | ✅ | confirm/reject 已验证 |
| 执行预留 | ✅ | 不自动触发，用户可控 |

### 建议

✅ **可以进入 Task 02.3**，方向：

> Decision Execution Adapter — 用户确认后，自动提交重新生成任务到 Task Runtime

但前提是：

- 用户确认 regenerate → 提交新的 image/video task 到 BullMQ
- 用户确认 modify_prompt → 先 update prompt 再提交 task
- 保持 requiresConfirmation = true（不能跳过确认）

---

**Task 02.2 — Director Decision Contract Reality ✅**

报告：`docs/reality/SHORTDRAMA-02-TASK02.2-DIRECTOR-DECISION-CONTRACT.md`
