# Kunlun Knowledge Hub (KKH)

> 昆仑镜知识操作系统 — 职业知识域（第一个行业域）

## 架构总览

```
┌────────────────────────────────────────────────────────┐
│  AI 产品层（Agent 层）                                   │
│  CareerAdvisorAgent / JD Agent / Resume Agent / ...     │
└────────────────────────┬───────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────┐
│  Context Builder + Memory Manager + Planning Engine      │
└────────────────────────┬───────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────┐
│  Career Knowledge OS                                    │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Knowledge   │ │Graph     │ │Retrieval │ │Evidence  │ │
│  │Repository  │ │Engine    │ │Engine    │ │Chain     │ │
│  └───────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Policy Engine（推荐策略/匹配策略/定价策略）       │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬───────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────┐
│  Tool Registry                                         │
│  searchJobs / analyzeResume / calculateSalary / ...    │
└────────────────────────┬───────────────────────────────┘
                         ▼
┌────────────────────────────────────────────────────────┐
│  LLM Gateway                                           │
│  DeepSeek / OpenAI / Claude / 通义千问 / 本地模型      │
└────────────────────────────────────────────────────────┘
```

## 目录结构

```
src/knowledge/
├── canonical/              # Phase 3-A: Schema 冻结
│   └── schemas.ts          # 所有 Canonical Object 定义
├── registry/               # Phase 3-A: Tool Registry
│   └── tool-registry.ts    # 工具注册表 + Repository 接口
├── engine/                 # Phase 3-C: Knowledge Engine
│   └── knowledge-engine.ts # 技能差距/职业路径/学习路径
├── memory/                 # Phase 3-D: Memory Engine
│   └── memory-engine.ts    # Working/Short/Long Memory
├── gateway/                # Phase 3-E: LLM Gateway
│   └── llm-gateway.ts      # 大模型调用封装
├── graph/                  # Phase 3-C: Skill Graph (TODO)
└── index.ts                # 统一入口
```

## Phase 路线图

### Phase 3-A: Knowledge Schema 冻结 ✅
- [x] Career Canonical Object (CCO)
- [x] Skill Canonical Object (SCO)
- [x] Company Canonical Object (CCO-Comp)
- [x] Job Canonical Object (CJO)
- [x] Candidate Canonical Object (CCO-Cand)
- [x] Memory Canonical Object (MCO)
- [x] Tool Capability 定义
- [x] Repository/Graph/Memory 接口

### Phase 3-B: Knowledge Repository（下一步）
- [ ] 职业知识库：50+ 职业 CCO
- [ ] 技能图谱：200+ SCO + 关系边
- [ ] 薪资数据：按城市/经验/技能
- [ ] 企业知识库：企业信用/活跃度
- [ ] 行业趋势数据
- [ ] 面试题库

### Phase 3-C: Knowledge Engine ✅（骨架）
- [x] 技能差距分析 Skill Gap Analysis
- [x] 职业路径规划 Career Path Planning
- [x] 学习路径生成 Learning Path Builder
- [ ] 图数据库迁移（内存 → Neo4j/PostgreSQL）
- [ ] 向量检索（关键词 → Embedding）
- [ ] 岗位推荐引擎

### Phase 3-D: Memory Engine ✅（骨架）
- [x] Working Memory（会话内）
- [x] Short Memory（7天）
- [x] Long Memory（永久）
- [ ] 记忆巩固算法
- [ ] 向量召回
- [ ] Redis + PostgreSQL 持久化

### Phase 3-E: LLM Integration
- [ ] DeepSeek API 接入
- [ ] OpenAI API 接入
- [ ] Claude API 接入
- [ ] 通义千问 API 接入
- [ ] 本地模型（Ollama/LLM Studio）
- [ ] BYOK（用户自带 Key）
- [ ] Prompt 模板管理
- [ ] Token 用量追踪

## 核心原则

1. **Schema 先于内容**：先冻结 Schema，再填数据
2. **LLM 是发动机，不是车**：LLM 只负责表达，决策靠 Knowledge OS
3. **知识是资产**：所有数据版本化、可溯源、带置信度
4. **域无关设计**：Career 是第一个域，未来法律/音乐/媒体复用
5. **记忆分层**：Working/Short/Long 三层，不同生命周期
6. **工具即能力**：所有外部能力通过 Tool Registry 注册

## 未来扩展（其他行业域）

| 域 | 知识类型 | 特殊需求 |
|----|----------|----------|
| **法律** | 法条、案例、判例 | 时效性、权威性 |
| **音乐** | 乐理、曲谱、版权 | 多媒体、版权链 |
| **GEO** | 平台规则、算法、趋势 | 实时性、多平台 |
| **新媒体** | 平台算法、内容模板、趋势 | 实时性、创意性 |
| **广告** | 受众画像、投放策略、ROI | 数据驱动、A/B测试 |
| **小说创作** | 题材、风格、读者偏好 | 创意性、叙事结构 |

所有域共享：Memory Engine + Tool Router + LLM Gateway
