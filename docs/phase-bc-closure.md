# Phase B+C 收敛终局
## 冻结时间：2026-06-24 02:45 (CST)

## 系统身份
**PromptIR Video Compiler System**（非 AI 视频生成系统）

## 完成状态

### Phase B — Single Entry Video Compiler
| Step | 内容 | 状态 |
|------|------|------|
| 1 | PromptIR Canonical Schema (`types/promptIR.ts`) | ✅ |
| 2 | Deterministic Compiler (`services/video-compiler.ts`) | ✅ |
| 3 | Single Entry API (`/api/video-optimize`) + Shadow Mode | ✅ |
| 4 | Legacy Collapse (UI dual entry + Worker strict mode) | ✅ |

### Phase C — Productization
| 工程 | 内容 | 状态 |
|------|------|------|
| C1 | UI Collapse — 语义统一为"视频编译" | ✅ |
| C2 | PromptIR Workspace — 轻量 debug panel + shots table | ✅ |
| C3 | Transparency Layer — debug toggle 展示编译中间态 | ✅ |

## 系统终态架构
```
PromptIR ← structured JSON 输入
    ↓
/api/video-optimize → compileVideo() (deterministic, 无 LLM)
    ↓
Worker (Strict Mode, PromptIR only, 零 flat field)
    ↓
Video Model
```

## 冻结规则（不可违反）

### ❌ 禁止
- 新增任何 `optimize-*` 类 LLM agent 或 API
- 新增 narrative rewrite / reinterpretation 步骤
- 新增"AI 优化"类 UI 按钮或入口
- Worker 接收 flat fields (narrative/dialogue/effects) 作为输入
- 在 Compiler 层引入任何 LLM 或非确定性逻辑

### ✅ 允许
- PromptIR schema 演进（v1 → v2，前向兼容）
- Compiler 的确定性映射优化（better shot → camera mapping）
- Worker template 微调（仅 placeholder 字符串）
- Cache / memoization 性能层
- 编译输出可视化增强

## 删除/废弃路由
| 端点 | 文件 | 状态 |
|------|------|------|
| `POST /api/ai/optimize-shot-script` | `routes/ai-optimize-shot.ts` | 410 DEPRECATED |
| `POST /api/ai/optimize-video-prompt` | `routes/optimize-video-agent.ts` | 410 DEPRECATED |

## 宪法级规则
**PromptIR 是视频编译的 SINGLE SOURCE OF TRUTH。**
所有视频生成必须经过：`PromptIR → compileVideo() → Worker → Video Model`。
旁路 = 架构违规。
