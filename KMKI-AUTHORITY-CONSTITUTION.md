# KMKI Authority Constitution v0.1
# 生效日期: 2026-07-23
# 状态: FROZEN

## 1. Identity Authority
- 唯一身份源: User.id
- 禁止新增: governance_user, AdminUser, customer_identity, studio_project_members, OrgMember
- 允许读取现有数据，禁止写入新数据

## 2. Tenant Authority  
- 唯一租户源: Organization.id
- 禁止新增: governance_tenant
- 新租户必须通过 Organization 创建

## 3. Credential Authority
- 唯一凭证源: credential_vault (待创建)
- 禁止新增: ApiKey 表数据
- 现有数据只读，新凭证走 Vault

## 4. Billing Authority
- 唯一商业源: Subscription / Order / Payment
- 禁止新增: governance_subscription

## 5. Agent Authority
- 唯一执行源: Agent Runtime
- 所有 AI 调用必须可追踪 (llm_execution_trace)

## 冻结规则
1. 违反以上规则的代码 PR 禁止合并
2. 现有违规代码标记 @deprecated，不强制立即重构
3. 新功能必须遵守本宪法
