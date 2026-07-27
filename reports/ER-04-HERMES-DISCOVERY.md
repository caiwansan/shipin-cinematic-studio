# Hermes Runtime Discovery Report

**Date**: 2026-07-17
**Author**: OpenClaw (AI CTO Office)
**Runtime**: Hermes Agent v30 (config_version)
**Status**: ✅ Active & Deployed

---

## 1. 部署状态概览

| 检查项 | 状态 | 详情 |
| --- | --- | --- |
| Hermes 服务进程 | ✅ 运行中 | PID 1184, 自 2026-07-15 启动 |
| Gateway 状态 | ✅ Active | `gateway_state: running` |
| Platform 连接 | ✅ QQ Bot 已连接 | `qqbotplatform: connected` |
| 配置文件 | ✅ 完整 | 300+ 配置项，覆盖所有模块 |
| 模型配置 | ✅ DeepSeek + OpenRouter | 主模型 deepseek-v4-flash |
| Memory | ✅ 已启用 | memory_enabled: true |
| State DB | ✅ SQLite | 386MB state.db |
| API Gateway | ❌ 未启用 | api_server 默认关闭 |
| Dashboard | ⚠️ 可选 | 配置存在但未确认运行 |

---

## 2. 目录结构

```
/root/.hermes/
├── config.yaml              # 主配置 (300+ 项)
├── auth.json                # 凭证池 (DeepSeek + OpenRouter)
├── gateway_state.json       # Gateway 运行状态
├── gateway.pid              # PID 文件
├── .env                     # 环境变量
├── SOUL.md                  # Agent 人格
├── state.db                 # 主 SQLite DB (386MB)
├── hermes-agent/            # 核心代码
│   ├── agent/               # Agent 运行时 (100+ 模块)
│   ├── hermes_cli/          # CLI 入口 + Gateway
│   ├── skills/              # 技能包 (20+)
│   └── ...
├── skills/                  # 用户技能
├── sessions/                # 会话历史
├── memories/                # Memory 文件
│   ├── MEMORY.md
│   └── USER.md
├── cache/                   # 缓存
├── logs/                    # 日志
├── cron/                    # Cron 任务
├── docker/                  # Docker 配置
└── docs/                    # 文档
```

---

## 3. Hermes 核心能力

### 3.1 Agent 运行时

- **多模型适配**: DeepSeek, Anthropic, OpenAI, Gemini, Bedrock, Codex 等
- **并行工具调用**: `parallel_tool_call_guidance: true`
- **环境探测**: `environment_probe: true`
- **自动验证**: `verify_on_stop: true`
- **任务分解**: kanban 自动分解 (`auto_decompose: true`)
- **上下文压缩**: 多级压缩引擎 (`context_engine: compressor`)
- **技能系统**: 20+ 内置技能 + 用户自定义技能

### 3.2 Sub-Agent / Delegation 机制

```
delegation:
  max_spawn_depth: 1          # 最大嵌套深度 1 层
  max_concurrent_children: 3  # 最大并行子代理 3 个
  max_async_children: 3       # 最大异步子代理 3 个
  orchestrator_enabled: true  # 编排器启用
  subagent_auto_approve: false # 子代理需人工批准
  max_iterations: 50          # 子代理最大迭代
  child_timeout_seconds: 0    # 无超时限制
```

**关键**: Hermes 支持 `hermes profile create` 创建**完全独立的 Agent Profile**，每个 Profile 是独立的 HERMES_HOME 目录。

### 3.3 Profile 机制 (多租户基础)

```bash
hermes profile create coder          # 新建 Profile + 技能包
hermes profile create coder --clone  # 克隆配置 + SOUL.md
hermes profile create coder --clone-all  # 完整拷贝
hermes profile use coder             # 设为默认 Profile
hermes profile delete coder          # 删除 Profile
```

每个 Profile 拥有:
- 独立 SOUL.md (Agent 人格)
- 独立 MEMORY.md (记忆)
- 独立 sessions/ (会话)
- 独立 .env (环境变量)
- 独立 skills/ (技能子集)

### 3.4 Memory 隔离

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  memory_char_limit: 2200     # Agent 记忆上限
  user_char_limit: 1375       # 用户画像上限
  provider: ''                # 可配置外部 Provider
  write_approval: false       # 记忆写入无需审批
```

### 3.5 Tool 系统

```yaml
toolsets:
  - hermes-cli
max_live_sessions: 16          # 最大活跃会话
```

- **Tool Guardrails**: 警告 + 硬停止
- **Tool Search**: 语义搜索 (`tool_search.enabled: auto`)
- **MCP 支持**: MCP 配置加载

---

## 4. 企业 AI 员工 Runtime 适配方案

### 4.1 租户隔离模型

```
┌──────────────────────────────────────────────┐
│                 Hermes Gateway               │
│                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────┐ │
│  │ Profile A  │  │ Profile B  │  │Profile C│ │
│  │ 企业A      │  │ 企业B      │  │ 企业C   │ │
│  │            │  │            │  │        │ │
│  │ SOUL.md    │  │ SOUL.md    │  │SOUL.md │ │
│  │ MEMORY.md  │  │ MEMORY.md  │  │MEMORY  │ │
│  │ sessions/  │  │ sessions/  │  │sessions│ │
│  │ .env       │  │ .env       │  │.env    │ │
│  └────────────┘  └────────────┘  └────────┘ │
│                                              │
│  organizationId → Profile 映射              │
│  workspaceId → SOUL.md 绑定                 │
│  agentId → Memory namespace                 │
└──────────────────────────────────────────────┘
```

### 4.2 推荐隔离策略

| 层级 | 隔离方式 | 实现 |
| --- | --- | --- |
| **Profile 级** | 每企业一个 Profile | `hermes profile create org_enterpriseA` |
| **Memory 级** | 独立 MEMORY.md | Profile 自动隔离 |
| **Session 级** | 独立 sessions/ 目录 | Profile 自动隔离 |
| **Env 级** | 独立 .env | Profile 自动隔离 |
| **SOUL 级** | 独立人格定义 | 写入角色 + 权限边界 |
| **Tool 级** | Tool guardrails | 限制可调用工具范围 |
| **Network 级** | 容器/网络策略 | Docker network_mode: host 需调整 |

### 4.3 创建隔离子代理流程

```bash
# Step 1: 为企业创建 Profile
hermes profile create org_enterpriseA --clone-all

# Step 2: 配置 SOUL.md (角色: 销售增长官)
# 写入人格、权限边界、租户标识

# Step 3: 配置 .env (API keys, resource limits)
# 设置 organizationId, workspaceId, agentId

# Step 4: 限制 Toolset
# 编辑 config.yaml: disabled_toolsets: [...]

# Step 5: 启动 Profile
hermes profile use org_enterpriseA
```

---

## 5. 与昆仑镜集成方案

### 5.1 职责边界

```
昆仑镜 (KunLunJing)                Hermes
─────────────────                   ──────
企业组织      ──────────────────→   Profile 创建
AI员工身份    ──────────────────→   SOUL.md 定义
岗位定义      ──────────────────→   Persona 配置
权限治理      ──────────────────→   Tool guardrails
知识管理      ──────────────────→   Skills 加载
业务结果追踪  ←──────────────────   Outcome records
    
                        ↕
            
Hermes Sub-Agent (Runtime)
├── 推理执行
├── 工具调用
├── Memory 读写
├── Session 管理
└── 执行结果返回
```

### 5.2 数据流

```
Enterprise User
    ↓
昆仑镜 API (创建 AI 员工)
    ↓
昆仑镜 → Hermes CLI: `hermes profile create {orgId}_{agentType}`
    ↓
Hermes 返回: profile_id, status
    ↓
昆仑镜 → Hermes: 配置 SOUL.md (persona, permissions)
    ↓
昆仑镜 → Hermes: 配置 Toolset (allowed tools)
    ↓
Enterprise User 触发执行
    ↓
昆仑镜 API → Hermes: session.send(message, profile_id)
    ↓
Hermes Sub-Agent 执行
    ↓
Hermes → 昆仑镜: outcome, metrics, logs
```

### 5.3 必须实现的租户隔离

| 隔离维度 | 方案 | 优先级 |
| --- | --- | --- |
| Profile 隔离 | 每企业独立 Profile | P0 |
| Memory 命名空间 | Profile 自带隔离 | P0 |
| Session 隔离 | Profile 自带隔离 | P0 |
| Tool 权限 | Tool guardrails + disabled_toolsets | P0 |
| 资源限制 | config.yaml: max_concurrent_sessions | P1 |
| 网络隔离 | Docker 网络策略 | P2 |
| 数据加密 | Profile 目录加密 | P2 |

---

## 6. 风险评估

| 风险 | 状态 | 建议 |
| --- | --- | --- |
| 多企业共享同一 Profile | 🔴 高风险 | 必须实施 Profile-per-Org |
| Memory 跨租户泄露 | 🔴 高风险 | Profile 隔离自动解决 |
| Tool 越权调用 | 🟡 中风险 | Tool guardrails 必须配置 |
| 资源抢占 | 🟡 中风险 | 设置 max_concurrent_sessions |
| State DB 单点 | 🟡 中风险 | 考虑按 Profile 分库 |
| API Server 暴露 | 🟢 低风险 | 当前未启用，保持关闭 |

---

## 7. 推荐 ER 路线

```
ER-01 ✅ Identity Foundation
ER-02 ✅ Profile View Layer
ER-03   Memory Layer (Hermes Memory 集成)
ER-04   Hermes Agent Runtime Foundation
         ├── Profile-per-Org 机制
         ├── SOUL.md 模板系统
         ├── Tool 权限系统
         └── Session 隔离
ER-05   External Runtime Adapter
         ↔ OpenClaw 作为 Engineering/Audit Agent
         ↔ 不进入生产 Runtime
```

---

## 8. 下一步行动

| 步骤 | 内容 | 优先级 |
| --- | --- | --- |
| 1 | 确认 Hermes CLI 调用方式 | P0 |
| 2 | 测试 Profile 创建/切换 | P0 |
| 3 | 验证 Memory 隔离效果 | P0 |
| 4 | 设计 SOUL.md 模板 | P1 |
| 5 | 建立 Tool 权限矩阵 | P1 |
| 6 | 昆仑镜 → Hermes CLI 集成 | P1 |
| 7 | 监控 Dashboard 部署 | P2 |

---

*OpenClaw — Enterprise Engineering*
*Hermes Discovery Report — ER-04 Foundation*
