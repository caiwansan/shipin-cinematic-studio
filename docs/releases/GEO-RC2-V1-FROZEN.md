# GEO-RC2 V1 — 冻结声明

**冻结时间**: 2026-07-02
**版本**: GEO-RC2 v1.0
**Git Tag**: `geo-rc2-v1`
**状态**: ✅ **FROZEN** — 冻结后不允许新增功能，仅接受 Bug Fix 和安全修复。

---

## RC2 范围

RC2 聚焦 **Knowledge Hub → Golden Evaluation** 的完整闭环基础设施建设。

### 架构

```
                     ╔══════════════════╗
                     ║  Knowledge Hub   ║
                     ║  (Source of Truth)║
                     ╚══════════════════╝
                              │
                              ▼
                    ╔══════════════════╗
                    ║ Knowledge Compiler║
                    ╠══════════════════╣
                    ║  Package Builder  ║
                    ║  JSON-LD Builder  ║
                    ║  Prompt Builder   ║
                    ║  Snapshot Builder ║
                    ╚══════════════════╝
                              │
                              ▼
                 ╔══════════════════════╗
                 ║   Context Runtime    ║
                 ╠══════════════════════╣
                 ║ getDiscoveryContext()║
                 ║ getBrandContext()    ║
                 ║ getKnowledgeContext()║
                 ║ getReplayContext()   ║
                 ╚══════════════════════╝
                              │
                              ▼
               ╔════════════════════════╗
               ║    Provider Runtime    ║
               ╠════════════════════════╣
               ║ ExecutionEngine        ║
               ║ ProviderAdapter 框架   ║
               ║ Reliability 层         ║
               ║ Observability         ║
               ║ Structured Response   ║
               ╠════════════════════════╣
               ║ MockProvider           ║
               ╚════════════════════════╝
                              │
                              ▼
               ╔════════════════════════╗
               ║     Replay Runtime     ║
               ╠════════════════════════╣
               ║ Replay Recorder       ║
               ║ Replay Store          ║
               ║ Evidence Index        ║
               ║ Diff / Comparison     ║
               ║ REST API (5 endpoints)║
               ╚════════════════════════╝
                              │
                              ▼
              ╔══════════════════════════╗
              ║     Golden Evaluator     ║
              ╠══════════════════════════╣
              ║ Dataset Loader          ║
              ║ Scenario Resolver       ║
              ║ Evaluation Engine       ║
              ║   9 维评分               ║
              ║   Band (Excellent–Poor)  ║
              ║   Gap Analysis          ║
              ║   Explainability        ║
              ║   Calibration Candidate  ║
              ╚══════════════════════════╝
                              │
                              ▼
              ╔══════════════════════════╗
              ║     Evaluation API       ║
              ╠══════════════════════════╣
              ║ POST /benchmark/evaluate ║
              ║ POST /benchmark/evaluate ║
              ║   /batch                 ║
              ║ GET /benchmark/result/:id║
              ║ GET /benchmark/report/:id║
              ╚══════════════════════════╝
```

---

## 冻结模块清单

| 模块 | 路径 | 状态 |
|------|------|------|
| **Knowledge Hub** | `platform/knowledge-hub/` | ✅ FROZEN |
| Knowledge Compiler (Package/JSON-LD/Prompt/Snapshot) | `platform/knowledge-hub/core/` | ✅ FROZEN |
| Context Runtime | `services/geo/runtime/context-runtime.ts` | ✅ FROZEN |
| Provider Runtime (ExecutionEngine + Adapter + Reliability + Observability) | `services/geo/runtime/provider/` | ✅ FROZEN |
| Replay Runtime (Recorder + Store + Evidence + Diff + API) | `services/geo/runtime/replay/` | ✅ FROZEN |
| Golden Dataset + Loader | `services/geo/runtime/golden/` | ✅ FROZEN |
| Golden Evaluator (9 维评分 + Gap + Explain + Calibration) | `provider/benchmark/runtime/` | ✅ FROZEN |
| Evaluation API (4 endpoints) | `provider/benchmark/runtime/routes.ts` | ✅ FROZEN |
| Discovery Runner (串联桥接) | `services/geo/runtime/discovery/` | ✅ FROZEN |
| Golden Dataset Spec + Annotation Guide | `provider/benchmark/golden/` | ✅ FROZEN |

---

## API 清单

### Knowledge Hub
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/knowledge-hub/knowledge` | 知识对象列表 |
| GET | `/api/v1/knowledge-hub/knowledge/:id` | 知识对象详情 |
| POST | `/api/v1/knowledge-hub/knowledge` | 创建知识对象 |
| PUT | `/api/v1/knowledge-hub/knowledge/:id` | 更新知识对象 |
| DELETE | `/api/v1/knowledge-hub/knowledge/:id` | 删除知识对象 |
| GET | `/api/v1/knowledge-hub/brands` | 品牌列表 |
| POST | `/api/v1/knowledge-hub/compile` | 触发编译 |
| POST | `/api/v1/knowledge-hub/version` | 创建版本 |

### GEO Runtime
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/geo/discovery/run` | 触发 Discovery 扫描 |
| GET | `/api/v1/geo/replay` | Replay 列表 |
| GET | `/api/v1/geo/replay/:id` | Replay 详情 |
| GET | `/api/v1/geo/replay/diff` | Replay 差异对比 |
| GET | `/api/v1/geo/replay/evidence` | 证据索引查询 |

### GEO Evaluation
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/geo/benchmark/evaluate` | 单次评测 |
| POST | `/api/v1/geo/benchmark/evaluate/batch` | 批量评测 |
| GET | `/api/v1/geo/benchmark/result/:id` | 评测报告 (JSON) |
| GET | `/api/v1/geo/benchmark/report/:id` | 评测报告 (Markdown) |

---

## 数据流

```
Knowledge Hub (Source of Truth)
    │ 品牌/产品/知识/实体
    ▼
Knowledge Compiler → Package + JSON-LD + Prompt + Snapshot
    │ snapshotHash, packageVersion
    ▼
Context Runtime → getDiscoveryContext()
    │ brandContext, knowledgeCount, entityCount, snapshotHash
    ▼
Provider Runtime → ExecutionEngine.execute()
    │ ProviderContext + Prompt
    │ → Reliability (Retry/Timeout/Cache/CircuitBreaker)
    │ → Observability (Trace)
    │ → StructuredResult
    ▼
Replay Runtime → createReplayRecord(trace, result)
    │ → replayStore.save()
    │ → evidenceIndex.indexFromReplay()
    ▼
Golden Evaluator → evaluateReplay(replay)
    │ Scenario Resolver → Golden Dataset
    │ 9 维评分 → Overall Score
    │ Band (Excellent–Poor)
    │ Gap Analysis
    │ Explainability
    │ Calibration Candidate
    ▼
Evaluation Report (JSON / Markdown)
```

---

## 已知限制

1. **Provider 实现**: 当前仅 MockProvider，返回模拟数据。接入真实 Provider（DeepSeek/Claude 等）属于 RC3。
2. **测试数据集**: golden-v1.json 仅包含 2 条入门级 Golden Entry。需要在 RC3 扩充到覆盖主流 Industry 的完整数据集。
3. **评测机制**: 当前基于规则评分 + 部分静态假设。RC3 可引入 AI Judge 评分。
4. **持久化**: Replay 为内存存储，服务重启后数据丢失。RC3 可迁移到数据库。
5. **无前端评测页**: Evaluation Report 通过 API 返回，尚无用户界面。
6. **Calibration 仅输出建议**: Calibration Candidate 已生成但尚未自动应用到 Prompt，属于 RC3 Prompt Optimization。

---

## 后续 RC3 范围（预告）

RC3 不修改 RC2 基线能力，所有新功能在 RC2 基础上叠加。

1. **Discovery Runtime Realization**
   - 真实 Provider 接入（DeepSeek、Claude、Gemini...）
   - 多 Provider 策略、配额、并发管理
   - Provider Registry 增强

2. **Production Replay**
   - Replay 数据库持久化
   - Customer Case → Candidate → Review → Golden 持续学习

3. **Knowledge Hub 产品化**
   - AI-first 内容编辑体验
   - JSON-LD / Prompt Block 自动生成
   - 知识版本审批和发布

4. **Workspace 用户体验打磨**
   - Discovery / Evaluation / Monitoring 界面
   - 面向非技术用户的完整操作流程
