# ADR-015: Agent Runtime (平台可调度 Agent 内核)

- **Status:** Accepted
- **Date:** 2025-07-15
- **Tags:** platform, agent, runtime, dispatcher, scheduler, memory, tools

## Context

The Studio platform needs an intelligent agent system that can orchestrate capabilities across multiple runtimes (Execution Runtime, AI Resource Runtime, Workspace Runtime). Previous agent implementations were hardcoded, lacked proper lifecycle management, and did not follow the platform's ARCH-002 runtime lifecycle pattern.

Key requirements:
1. **Agent = Capability 的智能编排执行者** — Not an LLM wrapper. Agents orchestrate capabilities.
2. **Agent 声明能力需求，底层自动解析** — Agent specifies `GenerateVideo` → Runtime resolves to correct provider.
3. **严禁硬编码 Agent** — All agents registered via Agent Registry.
4. **Agent Collaboration 统一通过 Dispatcher** — No direct agent-to-agent dependencies.
5. **Agent Session 必持久化** — Full audit trail, resumable, cost-tracked.
6. **Tool Adapter 预留统一接口** — MCP, Browser, Search, Python, Database, HTTP, Filesystem.
7. **统一 Context 注入** — AgentContext provides everything an agent needs.

## Decision

We implement an **Agent Runtime** as a platform kernel that manages agent lifecycle, registry, dispatch, scheduling, memory, and tool integration.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Runtime                         │
├─────────────────────────────────────────────────────────┤
│  AgentService (Business Orchestration)                  │
├──────────┬──────────┬───────────┬──────────┬────────────┤
│ Registry │ Contract │ Dispatcher│ Scheduler│ Memory     │
│ (Plugin  │ (Base    │ (DAG      │ (Seq/    │ (ShortTerm │
│  Registry│  Agent)  │  Dispatch)│  Par/    │  Workspace │
│  backed) │          │           │  Retry)  │  Knowledge)│
├──────────┴──────────┴───────────┴──────────┴────────────┤
│              Tool Adapter (Unified Interface)             │
├─────────┬─────────┬────────┬────────┬───────┬───────────┤
│ MCP     │ Browser │ Search │ Python │ DB    │ HTTP/Files│
└─────────┴─────────┴────────┴────────┴───────┴───────────┘
```

### Core Components

1. **Agent Registry** ([KMKI-PLAT-010-registry])
   - PluginRegistry-backed registration
   - `register(definition)`, `unregister(code)`, `findByCapability(capability)`
   - All agents must be registered — no hardcoded references

2. **Agent Contract** ([KMKI-PLAT-010-contract])
   - `AgentContract` interface: `initialize → plan → execute → stream → pause → resume → cancel → complete → dispose`
   - `BaseAgent` abstract class: default implementations for all methods
   - Agent developers extend BaseAgent, override what they need

3. **Agent Context** ([KMKI-PLAT-010-context])
   - `AgentContextFactory` builds complete context from sessionId
   - Injects: workspace, capabilityResolver, resourceResolver, conversation, memory, variables, settings, logger
   - Agent never accesses DB directly

4. **Agent Dispatcher** ([KMKI-PLAT-010-dispatcher])
   - Single entry point for all agent execution
   - `dispatch(agentCode, input)` — find agent → create session → execute → record
   - `dispatchMultiple(agents[])` — DAG-based collaboration
   - Agents never call each other directly

5. **Agent Scheduler** ([KMKI-PLAT-010-scheduler])
   - Supports sequential, parallel, priority, retry, timeout
   - `schedule(plan)` with dependency resolution
   - Integration with AgentQueue

6. **Agent Memory** ([KMKI-PLAT-010-memory])
   - Types: shortTerm, workspace, knowledge, summary
   - Store, retrieve, summarize, expire
   - In-memory with TTL-based expiry

7. **Tool Adapter** ([KMKI-PLAT-010-tools])
   - Unified `tool.invoke(type, name, params)`
   - Stub implementations for: MCP, Browser, Search, Python, Database, HTTP, Filesystem, Custom
   - Install/uninstall/enable/disable per tool type

### Data Model

8 new Prisma models (see `schema.prisma` for full definitions):
- **AgentDefinition** — Agent metadata and capability declaration
- **AgentSession** — Execution session with state management
- **AgentStepExecution** — Individual step tracking within a session
- **AgentEvent** — Event log for observability
- **AgentContextMemory** — Runtime memory storage
- **AgentQueue** — Scheduled task queue
- **AgentPermission** — Access control for agents
- **AgentArtifact** — Output artifacts from agent execution

### Agent Execution Flow

```
1. User/System → Dispatcher.dispatch(agentCode, input)
2. Dispatcher → Registry.findByCode(agentCode)
3. Dispatcher → ContextFactory.build(sessionId, definition, ctx)
4. Dispatcher → Agent.initialize(ctx)
5. Dispatcher → Agent.plan(ctx, input) → Plan
6. Dispatcher → Agent.execute(ctx, plan) → Result
7. Dispatcher → Agent.complete(ctx, result)
8. Dispatcher → Record session, emit events
9. Return DispatchResult
```

### Frontend Integration

- **AgentCenter.vue** — Main management page for agents, sessions, dispatch, tools
- **AgentCard.vue** — Agent visualization card
- **AgentSessionTimeline.vue** — Session history timeline
- **AgentDispatcher.vue** — Manual agent dispatch interface
- **ToolInvocationViewer.vue** — Tool call visualization
- **useAgentStore.ts** — Pinia store for agent state management

### Path Aliases

All backend agent modules live under:
```
backend/src/services/platform/agent/
├── types.ts                 — All TypeScript types
├── agent.service.ts         — Business orchestration
├── registry/                — Agent Registry
├── contract/                — Agent Contract + BaseAgent
├── context/                 — Agent Context Factory
├── dispatcher/              — Agent Dispatcher
├── scheduler/               — Agent Scheduler
├── memory/                  — Agent Memory Runtime
├── tools/                   — Tool Adapter
├── events/                  — Agent Events
└── runtime/                 — ARCH-002 Runtime Lifecycle
```

Frontend modules:
```
frontend/modules/platform/agent/
├── types/index.ts           — Frontend types
├── store/useAgentStore.ts   — Pinia store
├── runtime/agent.runtime.ts — Frontend runtime
├── services/                — API service + provider
├── pages/                   — Agent Center page
└── components/              — UI components
```

## Consequences

### Positive
- All agents follow the same contract: plan → execute → complete
- Runtime lifecycle (ARCH-002) compliance for the Agent Runtime
- Platform SDK exposes `platform.agent()` for unified access
- Frontend has full management UI for agents
- Workspace Runtime integration for session persistence
- Event-driven architecture via agent events
- No hardcoded agent logic — all agents discovered via Registry

### Negative
- Additional file overhead (12 backend modules + 8 frontend modules)
- Runtime memory is in-memory — needs DB-backing for production
- Tool adapters are stubs — actual implementations needed per tool type

### Mitigations
- Plugin registry pattern minimizes code duplication
- In-memory memory runtime is configurable for DB persistence
- Tool interface is stable — implementations can be added independently

## References

- ADR-007: Runtime Lifecycle (ARCH-002)
- ADR-011: Plugin Registry
- ADR-014: Workspace Runtime
- KMKI-PLAT-010: Agent Runtime Implementation
- ARCH-001: Platform Architecture
- ARCH-002: Runtime Lifecycle Contract
