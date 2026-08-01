# Sprint-RECRUITMENT-REALITY-05 — 真实企业运营验证（T01-T03）

**日期:** 2026-08-01 01:30 CST
**Gate:** 掌柜验收 96/100 后指令启动（T01→T03 开发完成；T04 等真实企业）
**范围:** 不扩 AI 能力，进入企业运营验证

---

# T01 — 企业模型恢复中心（P0）✅ Runtime Verified

## 目标
客户买 AI 员工后不因 Key 问题启动失败：Agent 启动前检查 ModelHealth，unhealthy → 阻断 + 明确提示。

## 交付（3 个改动）

| 文件 | 改动 |
|------|------|
| `enterprise-agent-runtime.service.ts` | **Model Health Gate**：executeTask 读取 enterpriseLlm 后，healthStatus ∈ {failed, decrypt_error, disabled} → 阻断返回 `MODEL_HEALTH_BLOCKED` + 原因 + 重配指引；同时写 audit log `execution.blocked_model_health`（Activity Center 可见） |
| `resolveRuntimeConfig.ts` | 企业配置解密失败从「静默标记 + fallthrough」升级为「标记 + **throw 阻断**」——不允许静默使用平台/用户 key（身份隔离）；外层 catch 仅吞 DB 读取错误，`[EnterpriseLLM]` 错误继续冒泡 |
| `enterprise-llm.service.ts` | 重新配置 key 时重置 healthStatus → untested（恢复闭环：重配 → 待检测 → test 验证 → ok/failed） |

## Reality 验证

```
resolveRuntimeConfig('llm', { tenantId: rg-tenant-... })  # 该租户配置为 decrypt_error
→ ✅ 阻断冒泡: [EnterpriseLLM] 模型密钥解密失败，AI 员工暂不可用。请在企业工作台重新配置模型密钥
```

**拦截链路**：executeTask gate（healthStatus 已知坏）→ 直接 MODEL_HEALTH_BLOCKED；若 status 未标记，resolveRuntimeConfig 解密失败 throw → 外层 catch → errorResult 返回错误。双保险。

## 恢复流程（闭环）

```
发现（Model Health Center list）
  ↓
重配（Admin agents.vue / 企业工作台，key 变更 → 自动重置 untested）
  ↓
验证（POST /api/admin/llm/health/test/:id → ok/failed）
  ↓
恢复（Agent 正常执行）
```

---

# T02 — AI 员工 ROI 报表（P1，销售武器）✅ Runtime Verified

## 交付

- `agent-activity.service.ts` 新增 `getRoiReport()`:
  - **人工耗时基准表**（分钟/次）：JD 60 / 岗位分析 45 / 面试评估 30 / 职业规划 30 / 面试推荐 30 / 面试出题 20 / 匹配报告 20 / 候选筛选 15 / 简历匹配 10 / 简历解析 8 / 回复 5 / 默认 15
  - 节省工时 = 成功任务数 × 基准；节省成本 = 工时 × HR 时薪（¥50/h 常量，可调）
  - ROI = 节省成本 ÷ AI 实际成本
  - 维度：summary + byType + byOrganization
- API: `GET /api/admin/enterprise/roi-report?days=&organizationId=`
- 前端: `/admin/enterprise/roi-report`（ROI 大卡片 + 任务类型表 + 企业表 + 口径说明），已注册 Admin 菜单「AI员工ROI 📈」

## Reality 验证（90 天真实数据）

```
30 任务 | 70% 成功率 | AI 成本 ¥0.0303 | 节省 4.85 小时 | 节省 ¥242.5 | ROI 8013×
byType top: 🎯职业规划激活 1.5h ¥75 · 📄简历解析 0.93h ¥46.67 · 📋岗位分析 0.75h ¥37.5
```

**销售话术**：花 3 分钱，替代 ¥242 人工 HR 工时。

---

# T03 — Quota 消费链（P2，观察模式）✅ Runtime Verified

## 交付

- `quota.service.ts` 新增:
  - `recordUsage(orgId, taskType, status)`：成功任务 → 对应能力配额实时 +1（跨周期自动重置，保留 limit/periodStart）
  - `checkQuota(orgId, taskType)`：执行前查询 → { used, limit, remaining, exhausted, level }
- `enterprise-agent-runtime.service.ts` 接入:
  - 执行前：checkQuota，**超额仅告警**（console.warn + audit log `execution.quota_exceeded_warning`，标注 `mode: observe_only`）——不硬阻断
  - 执行后：recordUsage fire-and-forget 累加

## 掌柜口径执行

> 「先观察真实消费，不要马上硬限制」→ 429 硬拦截为 P3 项，等真实数据沉淀后开启。

## Reality 验证

```
checkQuota('jd_generate') → used=0
recordUsage('jd_generate','success') → used=1
DB: {"AI_JD_GENERATE":{"unit":"次","used":1,"periodStart":"2026-07-31T16:00:00.000Z"}}
测试后已恢复 used=0 ✅
```

---

# T04 — 真实企业试运营 ⏸ 等掌柜

观察框架已具备（ROI 报表 + Activity Center + Quota 总览 + Model Health），**缺真实企业接入**。需要掌柜指定 1 家真实/演示企业跑 30 天，收集：启动成功率 / 模型失败率 / 任务完成率 / 单企业月成本 / 续费意愿。

---

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 启动前健康拦截 | 坏配置 → MODEL_HEALTH_BLOCKED（gate + throw 双保险） | ✅ PASS |
| G2 恢复闭环 | 重配 key → untested → test → ok/failed | ✅ PASS |
| G3 ROI 可计算 | 30 任务 → 4.85h / ¥242.5 / ROI 8013× | ✅ PASS |
| G4 消费链观察 | recordUsage 实时累加 + checkQuota 告警不阻断 | ✅ PASS |
| G5 无功能扩张 | 未新增 AI 能力，仅运营链路 | ✅ PASS |
| G6 回归 | 5 个 Admin 端点全 200 | ✅ PASS |

# 遗留

- hdz 存量类型错误（usage-quota.service 缺失）——未扩大，等掌柜批准修
- 3 条真实企业坏 key 待联系重配
- T04 等真实企业
