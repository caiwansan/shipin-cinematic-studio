# Hybrid AI Runtime 架构

## 架构总览

```
                     ┌──────────────┐
                     │   Workspace  │
                     │  (不分层)     │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │UnifiedAI     │
                     │Gateway       │ { runtimeType: 'user' | 'platform' }
                     └──┬────────┬──┘
                        │        │
              ┌─────────▼┐    ┌──▼──────────┐
              │User      │    │Platform     │
              │Runtime   │    │Runtime      │
              ├──────────┤    ├─────────────┤
              │BYO AI    │    │Platform     │
              │          │    │Provider Pool│
              ├──────────┤    ├─────────────┤
              │UserModel │    │OpenAI       │
              │ConfigV2  │    │Claude       │
              │          │    │Gemini       │
              │          │    │DeepSeek     │
              │          │    │豆包         │
              │          │    │通义         │
              │          │    │Kimi         │
              │          │    │元宝         │
              │          │    │Perplexity   │
              │          │    │...          │
              └──────────┘    └─────────────┘
```

## Runtime 职责划分

| 功能 | Runtime 类型 | 说明 |
|------|-------------|------|
| Knowledge Quality | USER | 用用户自己的 Provider 推理 |
| Evidence | USER | 同上 |
| Claim | USER | 同上 |
| FAQ | USER | 同上 |
| Schema | USER | 同上 |
| Content Generation | USER | 同上 |
| Discovery | USER | 用用户自己的 Provider（GEO 自有） |
| **AI Visibility Scan** | **PLATFORM** | 平台扫描各 AI 平台对品牌认知 |
| **Presence Scan** | **PLATFORM** | 同上 |
| **Cross AI Detection** | **PLATFORM** | 跨平台检测 |
| Provider Health Check | PLATFORM | 平台维护的 Provider 健康检查 |

## 数据模型

### PlatformProviderConfig
- id: string
- provider: string (openai, claude, gemini, deepseek, doubao, tongyi, kimi, yuanbao, moonshot, perplexity, wenxin, xinghuo)
- encryptedApiKey: string
- baseUrl: string
- model: string
- isEnabled: boolean
- dailyQuota: number (每日调用次数上限)
- dailyUsed: number (已用次数)
- lastHealthCheckAt: DateTime
- healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown'
- costPerCall: number (估算单次调用成本)
- createdAt: DateTime
- updatedAt: DateTime

### PlatformUsageLog
- id: string
- provider: string
- runtimeType: 'platform'
- capability: string
- tokensIn: number
- tokensOut: number
- latency: number
- cost: number
- success: boolean
- errorMessage: string?
- userId: string? (触发用户，用于匿名统计)
- createdAt: DateTime
