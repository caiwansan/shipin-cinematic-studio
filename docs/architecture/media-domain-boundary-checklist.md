# Media Domain Data Boundary Checklist — 新媒体域数据边界清单

**Date:** 2026-08-02 03:40
**Sprint:** Sprint-MEDIA-UX-03-PRODUCT-GRADE-DESIGN
**状态:** ✅ 已建立（UX-02 跨企业 schedule 泄漏教训 → 系统性固化为强制清单）

> 所有新媒体域（media）新增代码必须逐条自检本清单。任一 Fail 不得合并。

## 0. 背景

UX-02 期间发现：聚合端点在企业无 AI 员工实例时，schedule 查询无 tenantId 过滤，泄漏 10 条他企排程。已修复（显式空归属）。UX-03 将该教训固化为 **Media Domain Data Boundary Checklist**，作为后续所有 media 开发（Sprint-MEDIA-01/03/04）的强制验收项。

## 1. 数据实体归属维度

| 实体 | 归属键 | 隔离规则 |
|------|--------|---------|
| EnterpriseAgentInstance | organizationId / tenantId | 查询必须带 organizationId 或 tenantId，禁止全局查 |
| EnterpriseAgentProfile | id（被 instance 引用） | 只能通过已隔离的 instance 关联查询 |
| AgentSchedule | tenantId | **无归属推断时禁止查询**（显式空匹配 `tenantId: '__no_tenant__'`） |
| AgentOutcome | organizationId | 必须带 organizationId |
| UsageLog | organizationId | 必须带 organizationId |
| SocialAccount（未来） | organizationId | Sprint-MEDIA-01 接入时必须带 organizationId |
| SocialPost（未来） | organizationId | Sprint-MEDIA-01 接入时必须带 organizationId |

## 2. 强制检查项（Checklist）

### C1 身份来源
- [ ] 用户身份必须来自 JWT（`request.user` / `request.tenantContext`），禁止 body.userId / query 传入的 userId 作为归属依据
- [ ] 企业归属必须来自 `getOrganizationIdForUser(user.id)` 或 Tenant Guard 注入的 `ctx.orgId`

### C2 聚合查询边界
- [ ] 所有 findMany/groupBy/aggregate 必须带 organizationId 或 tenantId 过滤
- [ ] **空归属显式处理**：当归属集合为空时，使用不可能命中的哨兵值（如 `'__no_tenant__'`），禁止省略过滤条件
- [ ] 禁止 `where: {}` 形式的全表扫描

### C3 跨实体关联
- [ ] 通过 A 实体查 B 实体时，B 的归属必须与 A 的归属一致（禁止用 A 的 id 反查后不过滤）
- [ ] Profile/能力等「引用型」数据只能经已隔离的实例 id 集合查询

### C4 未来数据源（Sprint-MEDIA-01/03/04）
- [ ] SocialAccount / SocialPost / 消息 / 客户 全部必须带 organizationId
- [ ] 微信数据回流必须按 organizationId 分发，禁止全局 ingest

### C5 前端
- [ ] 前端所有 fetch 必须带 Bearer token（后端统一鉴权）
- [ ] 前端不得硬编码企业 ID / tenant ID

## 3. UX-03 已执行验证

| 检查项 | 验证结果 |
|--------|---------|
| C1 身份来源 | ✅ overview 端点使用 `resolveOrgId`（JWT → getOrganizationIdForUser），无 body userId |
| C2 空归属 | ✅ 无实例时 schedule 强制 `tenantId: '__no_tenant__'` 空匹配（实测 0 泄漏） |
| C2 无全表扫描 | ✅ overview 全部查询带 organizationId / tenantWhere |
| C3 关联隔离 | ✅ Profile 仅经 instances id 集合查询 |
| C5 前端 token | ✅ 所有页面 fetch 带 Bearer token |

## 4. 使用方式

- 本清单存放于 `docs/architecture/media-domain-boundary-checklist.md`
- 每个涉及 media 数据的新 Sprint，验收时必须逐条打勾
- 违反清单 = Gate 失败，禁止合并
