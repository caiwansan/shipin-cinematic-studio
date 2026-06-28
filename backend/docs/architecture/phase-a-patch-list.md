# Phase A — Type System + Registry + Candidate Type Upgrade

**精确到文件的改动清单，每处标注"改动行"和"不动行"。**

---

## A1: `core/provider-registry/types.ts` — 新文件

```ts
// Capability 类型（固定4值，永不扩展）
export type Capability = 'image' | 'video' | 'llm' | 'tts'

// Execution 原子单元 — 替代原 string[] 中的 provider ID
export interface Candidate {
  provider: string
  model: string
  capability: Capability
  cost: number     // normalized 0–1
  latency: number  // normalized 0–1
  quality: number  // normalized 0–1
  reliability: number // normalized 0–1
}

// Provider 描述（用于 UI/配置）
export interface ProviderDescriptor {
  id: string
  name: string
  capabilities: Capability[]
  models: string[]
  configSchema: Record<string, 'string' | 'number' | 'boolean'>
}

// 插件适配器接口
export interface ModelPluginAdapter {
  provider: string
  models(): Candidate[]
  execute(candidate: Candidate, request: any, signal?: AbortSignal): Promise<any>
}
```

---

## A2: `core/provider-registry/plugin-registry.ts` — 新文件

```ts
// 单例注册表
export class PluginRegistry {
  private plugins = new Map<string, ModelPluginAdapter>()
  private candidatesByCapability = new Map<Capability, Candidate[]>()
  
  register(adapter: ModelPluginAdapter): void {
    // 1. 获取 adapter.models() 列表
    // 2. 按 capability 分桶到 candidatesByCapability
    // 3. 存储 adapter 到 plugins map
  }
  
  getCandidates(capability: Capability): Candidate[] {
    return this.candidatesByCapability.get(capability) ?? []
  }
  
  getAdapter(provider: string): ModelPluginAdapter | undefined {
    return this.plugins.get(provider)
  }
}

export const pluginRegistry = new PluginRegistry()
```

---

## A3: `core/provider-registry/merged-view.ts` — 新文件

```ts
import { pluginRegistry } from './plugin-registry.js'
import { Candidate, Capability } from './types.js'

// 合并系统 + 用户候选列表
export async function getEffectiveCandidates(
  userId: string | undefined, 
  capability: Capability
): Promise<Candidate[]> {
  // 1. 获取系统候选
  const system = pluginRegistry.getCandidates(capability)
  
  if (!userId) return system
  
  // 2. 获取用户候选（从 userApiKey 表）
  const userCandidates = await getUserCandidates(userId, capability)
  
  // 3. merge：用户优先，去重（相同 provider+model+capability 取用户版本）
  return mergeCandidates(userCandidates, system)
}
```

---

## A4: `core/policy-adapter/policy-adapter.types.ts` — 3 行改动

```ts
// === 改动 1: PolicySignalMeta.fallback_chain 类型升级 ===
// PolicySignal 在 core/policy-signal/policy-signal.types.ts 中定义

// core/policy-signal/policy-signal.types.ts — 仅改 1 行：
// BEFORE:  fallback_chain: string[]
// AFTER:   fallback_chain: string[]   ← 保持兼容，业务层负责格式

// === 改动 2: PolicyResult.fallback_chain_used 类型升级（这行在 policy-adapter.types.ts） ===
// BEFORE:
//   fallback_chain_used: string[]
// AFTER:
//   fallback_chain_used: Candidate[]   ← 需要 import Candidate

// === 改动 3: PolicyEvaluation / PolicyResult 增加 capability 字段 ===
// AFTER:
//   capability?: Capability   ← 可选的，用于 trace 上下文
```

**实际改动：`policy-adapter.types.ts` 仅改 `fallback_chain_used` 类型，1 行声明。`policy-signal.types.ts` 不改（保持向后兼容）。**

---

## A5: `core/provider-registry/index.ts` — 新文件（barrel）

```ts
export { getEffectiveCandidates } from './merged-view.js'
export { pluginRegistry, PluginRegistry } from './plugin-registry.js'
export type { Candidate, Capability, ProviderDescriptor, ModelPluginAdapter } from './types.js'
```

---

## 改动总计（Phase A）

| 文件 | 操作 | 净代码量 |
|------|------|----------|
| `core/provider-registry/types.ts` | NEW | ~40 行 |
| `core/provider-registry/plugin-registry.ts` | NEW | ~50 行 |
| `core/provider-registry/merged-view.ts` | NEW | ~40 行 + getUserCandidates 骨架 |
| `core/provider-registry/index.ts` | NEW | ~5 行 |
| `core/policy-adapter/policy-adapter.types.ts` | EDIT 1 行 | `fallback_chain_used: Candidate[]` |
| **Total Phase A** | **4 new + 1 edit** | **~135 行 net new** |

## Phase A 完成后验证点

```bash
# 1. 编译检查
npx tsc --noEmit --pretty | grep -i error | head -10

# 2. 验证注册表可注册插件
# 添加 test_plugin 注册 → candidatesByCapability 非空

# 3. 验证类型兼容
# Candidate 类型在 images.ts 中可被 import
# fallback_chain_used: Candidate[] 编译通过
```
