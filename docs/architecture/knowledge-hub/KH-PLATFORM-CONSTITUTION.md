# Knowledge Hub 平台宪法（Platform Constitution）

> **版本**: v1.0  
> **状态**: 冻结（Frozen）  
> **生效日期**: 2026-07-22  
> **覆盖范围**: Knowledge Hub 平台全模块

---

## 第一条：平台边界（Platform Boundary）

**Knowledge Hub 不依赖任何 Workspace。**

- 不允许 Workspace 层 import
- 不允许 Workspace 层类型引用
- 不允许 Workspace 层配置依赖
- Workspace 仅通过 `KnowledgeProvider` 接口接入

## 第二条：单向分层（Unidirectional Layering）

```
Core → Repository → Provider
↓
Publishing
↓
Review / Approval
↓
Distribution
↓
Monitoring
```

- 任意下层不允许 import 上层模块
- Monitoring（最高层）可 import 任意下层
- Distribution 不可 import Monitoring

## 第三条：Canonical Model（唯一平台对象）

- `KnowledgePackage` 是平台唯一知识对象
- 所有模块基于同一模型
- 不允许出现第二个知识模型

## 第四条：Provider Contract（冻结）

- `KnowledgeProvider` 接口冻结
- Workspace 接入的唯一入口
- 扩展通过新 Provider 注册，不修改接口

## 第五条：Registry First（注册优先）

新增以下对象时不得修改 Engine 代码：

| 对象 | 注册方式 |
|------|----------|
| Workspace | ProviderRuntime.register() |
| Provider | ProviderRuntime.register() |
| Publisher | PublisherRegistry.register() |
| Distribution Target | DistributionRegistry.register() |
| Metric | MetricsRegistry 定义 |
| Alert Policy | POST /monitoring/alerts/rules |

## 第六条：Observability 单一聚合

- `ObservabilityEngine` 是平台唯一快照入口
- Dashboard 不聚合数据
- `HealthEngine` 唯一健康来源
- `MetricsRegistry` 唯一指标来源

## 第七条：License（许可透明）

所有模块无硬编码角色判断：
- ReviewPolicy 驱动审批规则
- AlertPolicy 驱动告警规则
- 不写死用户角色或系统配置

## 第八条：Version Everything（版本化）

- 所有知识包有版本号
- 版本通过 `VersionEngine` 管理
- 快照不可变（Snapshot Immutable）
- 回滚创建新版本指向旧数据

## 第九条：Event-Driven（事件驱动）

- `AuditTimeline` 平台事件总线
- 13 种事件类型
- 模块间不直接互调，通过 Event 记录

## 第十条：Workspace 不干预平台

- Platform 不感知 Workspace 业务
- Workspace 不绕开 Platform 直接访问数据
- 所有平台能力通过 API 暴露

---

## 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-22 | 初始冻结 |
