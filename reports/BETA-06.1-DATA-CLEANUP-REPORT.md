# BETA-06.1 Data Cleanup Report

**执行时间**: 2026-07-18T13:35:00+08:00
**执行角色**: OpenClaw (Database Cleanup Executor)
**目标**: 清理 Beta 阶段污染数据，建立 BETA-06.1 Runtime Truth Verification 干净环境

---

## 一、清理前数据快照

| 表 | 记录数 | 说明 |
|----|--------|------|
| enterprise_agent_profile | 104 | 全部 runtimeStatus='draft' |
| enterprise_agent_instance | 0 | 无激活实例 |
| enterprise_agent_task | 0 | 无执行任务 |
| enterprise_outcome | 0 | 无结果 |
| enterprise_subscription | 0 | 无订阅 |
| enterprise_command | 0 | 无指令 |
| enterprise_knowledge | 0 | 无知识资产 |
| enterprise_action | 0 | 无行动 |
| enterprise_agent_model_binding | 2 | 模型绑定 |
| agent_audit_trail (企业) | 215 | 企业 Agent 审计日志 |
| Organization | 13 | 组织记录 |
| governance_organization | 9 | 治理组织 |
| enterprise_plan | 3 | 套餐定义（保留） |

## 二、清理操作

### 删除顺序（遵循外键约束）

```
1. agent_audit_trail (enterprise only)     → 215 条
2. enterprise_agent_model_binding           → 2 条
3. enterprise_agent_task                    → 0 条
4. enterprise_agent_instance               → 0 条
5. enterprise_action                        → 0 条
6. enterprise_outcome                      → 0 条
7. enterprise_command                       → 0 条
8. enterprise_knowledge                     → 0 条
9. enterprise_agent_profile                → 104 条
10. enterprise_subscription                 → 0 条
11. enterprise_profile                      → 3 条
12. Organization                           → 13 条
13. governance_organization                 → 9 条
```

### 保留验证

| 表 | 记录数 | 状态 |
|----|--------|------|
| User | 61 | ✅ 保留 |
| enterprise_plan | 3 | ✅ 保留 |
| enterprise_channel_provider | 13 | ✅ 保留 |
| enterprise_llm_config | 0 | ✅ 保留 |
| AIProviderConfig | 3 | ✅ 保留 |
| VIP / Admin / Payment | 保留 | ✅ 保留 |

## 三、清理后验证

| 表 | 清理后 | 目标 | 状态 |
|----|--------|------|------|
| enterprise_agent_profile | 0 | 0 | ✅ |
| enterprise_agent_instance | 0 | 0 | ✅ |
| enterprise_agent_task | 0 | 0 | ✅ |
| enterprise_outcome | 0 | 0 | ✅ |
| enterprise_subscription | 0 | 0 | ✅ |
| enterprise_command | 0 | 0 | ✅ |
| enterprise_knowledge | 0 | 0 | ✅ |
| enterprise_action | 0 | 0 | ✅ |
| enterprise_agent_model_binding | 0 | 0 | ✅ |
| Organization | 0 | 0 | ✅ |
| governance_organization | 0 | 0 | ✅ |

**结论**: 数据库已归零，干净基线已建立。

## 四、后续步骤

BETA-06.1 Runtime Truth Verification 执行环境已就绪。

下一步：创建 Golden Case 测试数据并执行一次真实任务。

---

**备份位置**: `/root/shipin-cinematic-studio/reports/beta-cleanup-backup/`
