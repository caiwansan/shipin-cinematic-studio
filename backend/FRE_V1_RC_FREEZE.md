# P4-1 FRE v1 Release Candidate 冻结文档

**冻结时间:** 2026-06-27  
**状态:** ⏸ 冻结中 — 等待内测验证  
**签署者:** 架构收敛已冻结 (ARCHITECTURE_CONVERGENCE_V1.md)

---

## 里程碑定义

### ✅ Architecture Convergence v1（基础架构）
> 解决"系统如何调用 AI"

| 组件 | 状态 | 备注 |
|------|------|------|
| RuntimeCredential | ✅ Frozen | `runtime/runtime-credential.ts` |
| ModelAdapterRegistry | ✅ Frozen | `model-adapters/registry.ts` |
| Worker Runtime | ✅ Frozen | `queue/worker-runtime.ts` |
| Credential Pipeline | ✅ Frozen | UserConfig → RuntimePayload → WorkerRuntime → Adapter |
| 旧死代码删除 | ✅ Done | `production-loop/video/*` 6 文件物理删除 |
| 死引用清理 | ✅ Done | api.ts / render-queue.ts / render-router.ts / render-intelligence.ts |

*基线文档: `ARCHITECTURE_CONVERGENCE_V1.md`*

### ✅ FRE v1（首次使用体验）
> 解决"用户如何开始使用 AI"

| 组件 | 状态 | 备注 |
|------|------|------|
| Provider Registry | ✅ Released | 5 Provider 已注册 |
| Provider Routes (6端点) | ✅ Released | verify / list / detail / models / connect / status |
| Error Classifier | ✅ Released | 7 种错误码 + 28 个单元测试 |
| Wizard (FirstRunWizard.vue) | ✅ Built | 6 步流程，集成到 Studio v2 入口 |
| Provider API Client | ✅ Built | `utils/provider-api.ts` |

### ✅ P4.1.1 Verify API Hardening（验证能力强化）
> 解决"用户失败时知道为什么"

| 错误码 | HTTP | 场景 |
|--------|------|------|
| `INVALID_API_KEY` | 400 / 401 | API Key 格式或内容无效 |
| `EXPIRED_API_KEY` | 401 + "expired" | Key 已过期 |
| `PERMISSION_DENIED` | 403 | Key 无权限 |
| `QUOTA_EXCEEDED` | 403 + "quota" | 账户余额不足 |
| `RATE_LIMITED` | 429 | 请求过于频繁 |
| `PROVIDER_ERROR` | 5xx | Provider 服务端异常 |
| `DNS_ERROR` | — | DNS 解析失败 |
| `NETWORK_TIMEOUT` | — | 请求超时 |
| `NETWORK_ERROR` | — | 其他网络错误 |
| `UNKNOWN_ERROR` | — | 未分类错误 |

---

## Release Gate

| 门槛 | 状态 | 阻塞 | 负责人 |
|------|------|------|--------|
| Verify API 单元测试 | ✅ **28/28 PASS** | ✅ 是 | 已补齐 |
| 48–72 小时内测 | ⏳ **进行中** | ✅ 是 | 测试团队 |
| Funnel 数据正常 | ⏳ **等待数据** | ✅ 是 | 内测后评估 |
| 无 P0/P1 Bug | ⏳ **等待验证** | ✅ 是 | 内测后评估 |

---

## 成功标准 (KPI)

| 指标 | 目标 |
|------|------|
| 新用户完成 Wizard | ≥ 70% |
| Verify 成功率（排除无效 Key） | ≥ 90% |
| 首次 AI 调用成功率 | ≥ 80% |
| Studio → 首次 AI 平均耗时 | ≤ 3 分钟 |
| Wizard 前端异常退出率 | ≤ 5% |

---

## Funnel 指标（建议监控）

```
Studio Visits
  ▼
Wizard Shown
  ▼
Provider Selected
  ▼
Verify Success
  ▼
Configuration Saved
  ▼
First AI Success
  ▼
First Project Created
```

每层追踪：
- 转化率
- 平均耗时
- 退出率
- Provider 分布
- Verify 失败原因 Top N

---

## 文件清单

### 后端新建
| 文件 | 用途 |
|------|------|
| `src/runtime/provider-registry.ts` | Provider Registry 核心 |
| `src/providers/index.ts` | 初始化入口 |
| `src/providers/deepseek.provider.ts` | DeepSeek 实现 |
| `src/providers/volcengine.provider.ts` | 火山引擎 实现 |
| `src/providers/aliyun.provider.ts` | 阿里百炼 实现 |
| `src/providers/siliconflow.provider.ts` | 硅基流动 实现 |
| `src/providers/openai.provider.ts` | OpenAI 实现 |
| `src/providers/error-classifier.ts` | 错误分类器 (P4.1.1) |
| `src/providers/error-classifier.test.ts` | 错误分类器单元测试 (28 tests) |
| `src/routes/providers.ts` | Provider 路由 (6个端点) |

### 后端修改
| 文件 | 修改内容 |
|------|----------|
| `src/bootstrap/runtime-boot.ts` | 加入 Provider 初始化 |
| `src/index.ts` | 注册 Provider 路由 |
| `vitest.config.ts` | 加入 provider 测试目录 |
| `src/providers/deepseek.provider.ts` | 接入 Error Classifier |

### 前端新建
| 文件 | 用途 |
|------|------|
| `utils/provider-api.ts` | Provider API 客户端封装 |
| `components/wizard/FirstRunWizard.vue` | 6 步 Wizard 组件 |

### 前端修改
| 文件 | 修改内容 |
|------|----------|
| `studio-v2/layout/StudioWorkspaceLayout.vue` | 集成 Wizard |
| `studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue` | 修复 require() |

### 文档
| 文件 | 用途 |
|------|------|
| `ARCHITECTURE_CONVERGENCE_V1.md` | Architecture Convergence v1 基线 |
| `FRE_V1_PLAN.md` | FRE v1 计划 |
| `FRE_V1_RC_FREEZE.md` | 本文档 — RC 冻结 |

---

## 冻结规则

**冻结期间禁止:**
1. 修改 Frozen Core 组件（RuntimeCredential、ModelAdapterRegistry、Worker Runtime）
2. 添加新功能
3. 混入架构重构

**冻结期间允许:**
1. 修复内测中发现的 P0/P1 Bug
2. 补充单元测试
3. 调整前端 UI 文案

---

## 解冻条件（RC → GA）

当以下四项全部满足时，P4-1 正式宣布 GA：

1. ✅ Verify API 单元测试全部通过 (已完成)
2. ⏳ 48–72 小时内测完成，无阻塞性 Bug
3. ⏳ 漏斗数据无异常（Wizard 完成率 ≥ 70%）
4. ⏳ Production 日志无新增错误

解冻后启动 P4-2 Runtime Governance。
