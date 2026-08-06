# KUNLUN-S4.1-BYOK-REALITY.md

> S4.1 BYOK Reality — Reality Gate
> 日期: 2026-08-06 09:20 (CST) | 状态: ✅ **BY1-BY5 全 PASS**
> 提交: feat(ai): byok tenant credential reality (S4.1)
> 依据: 掌柜 S4.1 执行指令（BY1-BY5 冻结）
> 定位: **企业用户可以使用自己的模型凭证，让 AI Employee 在 Hermes Runtime 中真实执行，且全过程可授权、可审计、可隔离**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| prisma/schema.prisma | +TenantProviderCredential 模型（tenant 级, 加密 ref, 每 org 唯一） |
| backend/src/services/user-model-resolver.ts | 解析优先级: tenant 凭证 → 用户配置 → dev（Gateway 零改动） |
| backend/src/ecosystem/skill-planner.service.ts | planFromIntent 支持 tenantUserId 透传 |
| backend/src/routes/skill-planner.routes.ts | from-intent 透传 tenantUserId |
| backend/src/routes/skill-tools-internal.routes.ts | candidate-score / interview-evaluate 透传 tenantUserId |
| tools/hermes-runtime-skill.mjs | 工具转发 tenantUserId（Skill 层仍零 Key） |
| backend/scripts/s41-test.mts | BY1-BY5 Reality Gate |
| docs/.reality/KUNLUN-S4.1-BYOK-REALITY.md | 本报告 |

**未修改（禁止范围）**: desktop/ frontend（0 行）/ Billing / Marketplace / Memory / 自动 Key 管理 / 新 Provider 路由体系 / Runtime 重构 ✅

## 1. 数据模型证据

```
TenantProviderCredential（tenant_provider_credentials, 唯一 [organizationId]）
  organizationId → governance_organization.id（租户隔离, G8）
  provider / modelName / baseUrl
  credentialRef  → encryptKey(iv:tag:cipher)（DB 无明文, 实测 split(':').length===3）
  status → ACTIVE | DISABLED | INVALID
实测: 凭证 A/B 落库, credential_ref 不含明文 sk- 前缀
```

## 2. Runtime Resolver 证据

```
解析优先级（冻结）: TenantProviderCredential(ACTIVE) → UserModelConfigV2 → Dev Provider
输入: capability + userId → (gov org) → tenant 凭证
输出: { provider, modelName, apiKey, baseUrl, source }（source 可审计）
实测: resolve(USER_A) → { deepseek, source: tenant-credential }
```

## 3. Gateway 路由证据

- 所有 LLM 调用唯一经 unifiedAIGateway.invokeAI（executeViaGateway）; resolver 为内部解析, 无新增路由体系
- 禁止项确认: Skill/工具层零 Key 引用（hermes/orchestrator 源码 grep 0）; Skill 不接触 Key

## 4. Tenant Isolation 证据（BY2）

```
租户 A（1111…, tenant_org_test）→ deepseek（真实 Key）
租户 B（ce80…, tenant_iso_test）→ volcengine（路由占位）
实测: resolve(USER_B) → volcengine（自身凭证）; 不泄露 A 的 deepseek
```

## 5. Failure Reality 证据（BY4）

```
B 凭证改 provider='bogus-provider'（模拟无效凭证）
→ gateway failEnvelope「不支持的服务商: bogus-provider」（明确错误, 秒级, 无外部依赖）
→ 错误信息不含 Key/sk- 字样（无敏感泄露）
→ InvocationLog 记录 status=failed（Audit 完整）
```

## 6. Alice Full E2E 证据（BY5）

```
tenantUserId=USER_A（租户 A 身份）
  → Planner（经租户 A deepseek 凭证生成 SkillPlan）
  → resume.parse / candidate.score / interview.evaluate（工具经内部路由 → 租户 A 凭证）
  → 全链 COMPLETED, candidate.score source=real
  → InvocationLog provider=deepseek（租户 A 凭证路由审计可追踪）
```

## 7. Reality Gate 结果（实测 17 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| BY1 | Credential Boundary | ✅ | Skill/工具零 Key; DB 加密 ref; Resolver 进程内获取（source=tenant-credential） |
| BY2 | Tenant Isolation | ✅ | B 解析自身凭证, 无跨租户泄露 |
| BY3 | Runtime Routing | ✅ | 同 capability: A→deepseek / B→volcengine |
| BY4 | Failure Reality | ✅ | 明确错误 + InvocationLog failed + 无敏感信息 |
| BY5 | Full Alice E2E | ✅ | 租户 A 身份全链真实执行 + 路由审计 |

## 8. 验收标准对照

```
✅ 企业用户可以使用自己的模型凭证
✅ AI Employee 在 Hermes Runtime 中真实执行
✅ 全过程可授权（逐 Skill）/ 可审计（InvocationLog+KernelEvent）/ 可隔离（org 级）
→ 达到进入 S4.2 Alice Commercial Reality 的条件
```

## 9. 结论

```
S4.1 BYOK Reality: ✅ 企业级成本归属与安全边界成立
Alice 具备从技术 Demo → 企业商品的基础条件
```
