# 数据库审计发现

- **审计对象**: PostgreSQL 16.12 @ localhost:5432/aigc_scs（464 张表，审计重点渠道相关 16 张 + 关联表）
- **审计时间**: 2026-08-03 01:10 (Asia/Shanghai)
- **审计员**: 第三方数据库审计（SQL 实测，全部结论附验证查询）

---

## 1. 高危 [H]（3 类，共 9 行数据直接涉及明文凭据）

### [H1] provider_credential.encrypted_key 明文存 API Key（3/7 行）
列名就叫 `encrypted_key`，但 3 行存的是**明文 API Key**，且 `health_status='decrypt_error'`（系统自己都解不开，证明从未加密）：

```sql
SELECT id, owner_type, organization_id, provider, encrypted_key, status, health_status FROM provider_credential;
-- 结果（节选）:
-- aa3addc5... | organization | 42f3da47... | openai   | sk-e2e-test-dummy-key | active | decrypt_error
-- dabe50ed... | organization | 3f09c684... | openai   | sk-dummy-e2e          | active | decrypt_error
-- 911bc78e... | organization | fb3a636d... | openai   | sk-e2e-test-dummy-key | active | decrypt_error
```
其余 4 行为 `hex:hex:hex` 加密格式。→ **3 条明文密钥**，且是真实 API 密钥形态（sk- 前缀）。

### [H2] UserModelConfigV2 明文存用户自配 API Key（6/55 行）
`UserModelConfigV2.llmApiKey` 等 6 个列直接存 Key，6 行为明文 `sk-` 前缀（其余行是 `hex:hex` 加密格式，说明加解密逻辑存在但部分写入路径未加密）：

```sql
SELECT "userId", "llmProvider", "llmApiKey" FROM "UserModelConfigV2"
WHERE "llmApiKey" LIKE 'sk-%' OR "imageApiKey" LIKE 'sk-%' OR "ttsApiKey" LIKE 'sk-%'
   OR "musicApiKey" LIKE 'sk-%' OR "videoApiKey" LIKE 'sk-%' OR "visionUnderstandApiKey" LIKE 'sk-%';
-- 结果:
-- d57b59a5... | aliyun   | sk-shared-fallback-key                 (4 个用户同值)
-- 3ff2328a... | aliyun   | sk-shared-fallback-key
-- a268759f... | aliyun   | sk-shared-fallback-key
-- 5ece9cf8... | aliyun   | sk-shared-fallback-key
-- 11111111-1111-1111-1111-111111111111 | deepseek | sk-09746cbe51a44e43b01b5a12ad49324f   (真实形态 DeepSeek Key，2 用户共享)
-- 22222222-2222-2222-2222-222222222222 | deepseek | sk-09746cbe51a44e43b01b5a12ad49324f
```
→ 6 行明文，其中 `sk-09746cbe...` 疑似真实可用密钥，且**两个账号共用同一把**。

### [H3] enterprise_channel_account.credential_encrypted：28/32 行"未加密"标记 + 双重 JSON 编码
列名 `credential_encrypted`（jsonb），但 28 行内容为 `"{\"_v\":1,\"_encrypted\":false}"` —— **显式声明未加密**，且是**被 JSON 字符串再包一层的双重编码**（jsonb_typeof='string'，而非 object，属写入 bug）：

```sql
SELECT jsonb_typeof(credential_encrypted) AS jtype, count(*) FROM enterprise_channel_account GROUP BY 1;
-- string | 28
-- object | 4
SELECT id, channel_type, credential_encrypted FROM enterprise_channel_account WHERE jsonb_typeof(credential_encrypted)<>'object' LIMIT 3;
-- 8b1cb420... | wecom          | "{\"_v\":1,\"_encrypted\":false}"
-- 1f5a19b0... | dingtalk       | "{\"_v\":1,\"_encrypted\":false}"
-- af652ee6... | bilibili       | "{\"_v\":1,\"_encrypted\":false}"
```
4 行 object 中 3 行是标准 `aes-256-gcm` 密文（`{cipher, payload}`），另 1 行（douyin 08a0f643，EXPIRED）也是 aes-256-gcm 超长密文。→ 当前 28 行内暂无真实密钥，但**一旦任何真实凭据走该路径写入即明文落库**，且双重编码会导致读取端解析失败。属于"明文凭据风险敞口 + 序列化 bug"。

> 关联检查：全库敏感列扫描见「审计覆盖清单」#20。`User.passwordHash` 为 bcrypt（$2a$10$…）哈希，合规 ✓。

---

## 2. 中危 [M]（8 类）

### [M1] 核心渠道表几乎无外键 —— 引用完整性全靠应用层自觉
16 张渠道表中**只有 4 张有 FK**（channel_browser_session、browser_workspace、channel_verification_session、enterprise_channel_sync_log → enterprise_channel_account）。`enterprise_channel_account` 自身 **0 个外键**；channel_customer_mapping、agent_channel_binding、browser_trajectory、recruitment_channel_mapping、enterprise_interaction、provider_credential、ResourceCredential、credential_vault 全部无 FK：

```sql
SELECT conrelid::regclass, contype, count(*) FROM pg_constraint
WHERE connamespace='public'::regnamespace AND contype='f'
GROUP BY 1 ORDER BY 1;
-- 结果仅: browser_workspace, channel_browser_session, channel_verification_session, enterprise_channel_sync_log
```

### [M2] enterprise_channel_account 引用大量不存在的主体（孤儿引用，29/32 行）
```sql
SELECT 'org_id not in Organization' chk, count(*) FROM enterprise_channel_account a
  LEFT JOIN "Organization" o ON o.id::text=a.organization_id
  WHERE a.organization_id IS NOT NULL AND a.organization_id<>'' AND o.id IS NULL;      -- 28
SELECT 'tenant_id NOT in governance_tenant', count(*) FROM enterprise_channel_account a
  LEFT JOIN governance_tenant t ON t.id::text=a.tenant_id WHERE t.id IS NULL;          -- 30
SELECT 'owner_id not in governance_user', count(*) FROM enterprise_channel_account a
  LEFT JOIN governance_user u ON u.id::text=a.owner_id WHERE a.owner_id<>'' AND u.id IS NULL;  -- 29
-- 反查: 这 29 个 owner_id 全部存在于 User 表（user center），0 个缺失
-- 'owner_id not in User' → 0
```
- `owner_type='gov_user'` 但 owner_id 实际是 **User 表**的 id（如 0ba5bf98=南波万、6e476e6a=AuthTest），governance_user 里根本没有 → **owner_type 与 id 空间错位**，按 governance_user 做授权的代码必然查不到人。
- 租户 `affc9201 / d4568766 / 2adf05ef` 在 User / Organization / governance_tenant / OrgMember **任何表都不存在** → 这批渠道账号引用的租户/组织空间已被清空或迁移过（疑似历史遗留/测试种子），共 26 行（affc9201 12 行 + d4568766 13 行 + 2adf05ef 3 行…）。
- 3 行 `owner_type='org'` 的账号 **owner_id 为空字符串**（NOT NULL 被空串绕过，见清单 #13）：reality-test、phase-a、channels_wechat-视频号（其中视频号是 AUTHENTICATED 真实连接账号）。

### [M3] recruitment_channel_mapping 全部 24 行指向不存在的职位
```sql
SELECT count(*) FROM jobs;                                                             -- 0 行!
SELECT count(DISTINCT job_id) FROM recruitment_channel_mapping;                        -- 3
SELECT 'job 0b329262 in jobs' FROM jobs WHERE id='0b329262-f659-41ab-a062-37a9c91a6e93'; -- 0
-- 3 个 job_id（0b329262 / 83f80d0d / d483b79d）× 8 渠道 = 24 行，全部孤儿，且无 FK
```

### [M4] 全库无行级安全（RLS），多租户数据仅靠应用层 WHERE 隔离
```sql
SELECT c.relname, c.relrowsecurity FROM pg_class c ... -- 19 张敏感表全部 relrowsecurity=f
SELECT count(*) FROM pg_policies;                       -- 0（无任何策略）
```
库内存在 86 个 governance_tenant 的多租户数据 + 明文密钥表，任何 SQL 注入/应用层过滤遗漏 = 跨租户读取全部凭据。且**无任何非 superuser 授权**（`information_schema.role_table_grants` 对敏感表 0 条非 postgres 授权，应用疑似以 postgres 超级用户直连）。

### [M5] channel_operation_log 唯一约束会阻断日志写入（日志表不该有 UNIQUE）
```sql
-- channel_operation_log_unique UNIQUE (workspace_id, action, target)
-- 同一 workspace 对同一 target 重复执行（重试、二次操作）将直接 unique_violation 失败；
-- 且 workspace_id 无 FK。该表当前 0 行，约束缺陷尚未暴露。
```

### [M6] 浏览器会话疑似僵尸化：4/4 全部 RUNNING，1 个从未健康检查
```sql
SELECT status, count(*) FROM channel_browser_session GROUP BY 1;  -- RUNNING | 4
SELECT id, channel_account_id, status, last_health_check_at FROM channel_browser_session;
-- 867cb2bf... (xiaohongshu) last_health_check_at = NULL 且 last_started_at=2026-08-02 17:02（至今 >8h）
-- 4 个会话全部 RUNNING、无 IDLE/CLOSED 生命周期状态；browser_workspace 3 行 CREATED×2 + RUNNING×1 与
-- 会话状态不一致（71641df4/0bc2bd64 为 CREATED 却无对应会话）
```

### [M7] ID 类型/格式混乱阻碍建 FK 与关联查询
- `provider_credential.organization_id uuid` vs `enterprise_channel_account.organization_id text`
- `credential_vault.owner_id uuid` vs `governance_user.id text`
- `Organization.id uuid` vs 渠道表 `organization_id text`（需要 `::text` 才能 join）
- `tenant_id` 混用：UUID、`phase-a`、`reality-test`、`t1`、`t2`、`default`（browser_workspace/browser_trajectory 用 `t1/t2/default`，渠道表用 `phase-a/reality-test`）
- 用户体系双轨：`User`（user center，131 行）与 `governance_user`（47 行）按邮箱仅 45 行重叠、86 个 User 无对应 governance_user；governance_tenant 86 个但 40 个无任何用户（孤儿租户）
```sql
SELECT 'governance_tenant 无任何 governance_user' ... LEFT JOIN ... WHERE u.id IS NULL;  -- 40
SELECT 'User 邮箱不在 governance_user' ... LEFT JOIN ... WHERE g.id IS NULL;             -- 86
```

### [M8] 审计/操作日志缺失：governance_audit_log、channel_operation_log、enterprise_channel_sync_log、enterprise_interaction 全部 0 行
"治理"体系无任何审计痕迹，渠道操作/同步/互动均不可追溯：
```sql
SELECT 'governance_audit_log' t, count(*) FROM governance_audit_log;  -- 0
SELECT 'channel_operation_log', count(*) FROM channel_operation_log;  -- 0
SELECT 'enterprise_interaction', count(*) FROM enterprise_interaction; -- 0
```

---

## 3. 低危 [L]

- **[L1]** 3 个渠道类型无 Provider 定义：accounts 用了 `wecom / dingtalk / channels_wechat`，enterprise_channel_provider 里没有（`SELECT DISTINCT channel_type FROM enterprise_channel_account EXCEPT SELECT name FROM enterprise_channel_provider` → 3 行）。反向（有 provider 无账号）= 0。
- **[L2]** enterprise_llm_config.encrypted_api_key 14 行中混入占位符测试值：`enc_test_gpt_key`、`enc_test_ds_key`、`iv:tag:ciphertext_placeholder`（5 行样本中 3 行占位）。
- **[L3]** storage_configs（1 行）：Tencent Cloud `accessKey` 明文（`AKIDhGcEdwCHBrPlz1wlTyEdxOfo9JEuTzPh`），`secretKey` 却是 hex:hex 加密格式 —— 同一对云凭据处理方式不一致（SecretId 单独不可认证，但与加密 SecretKey 配套即完整；建议同样加密）。
- **[L4]** provider_credential 唯一索引 `(owner_type, organization_id, provider)` 未覆盖 user_id 维度：owner_type='user' 时同一用户同 provider 可重复插。
- **[L5]** 渠道域 8 张表 0 行（功能未启用）：channel_operation_log、channel_customer_mapping、channel_outcome_mapping、enterprise_channel_sync_log、credential_vault、enterprise_interaction、ai_provider_config、job_agent_config。
- **[L6]** 测试/种子数据混杂：enterprise_channel_provider 13 行同一秒创建（2026-07-16 05:36:15.473，纯种子）；recruitment_channel 8 行同秒种子（07-23）；租户 `phase-a/reality-test/t1/t2/default`、org `11111111-2222-4333-8444-555555555555`（fake）、User `22222222-2222-2222-2222-222222222222`、`11111111-1111-1111-1111-111111111111`（测试用户）混在生产数据里。
- **[L7]** channel_verification_session 索引冗余：idx_cvs_account_status 已含 idx_cvs_channel_account 前缀，另有独立 idx_cvs_status —— 3 个索引覆盖 13 行数据。
- **[L8]** usage_logs 634,307 行 / 181MB 无保留策略迹象；hdz_* 系列表 1.2K~1.4K 行疑似演示数据。
- **[L9]** 时间字段质量良好：`updated_at < created_at`、未来时间、`completed_at < started_at` 均为 0 行 ✓。

---

## 4. 信息 [I]

### 4.1 数据量总览（count(*) 实测）
| 表 | 行数 | 表 | 行数 |
|---|---|---|---|
| enterprise_channel_account | 32 | enterprise_channel_provider | 13 |
| channel_browser_session | 4 | channel_verification_session | 13 |
| channel_operation_log | 0 | channel_customer_mapping | 0 |
| channel_outcome_mapping | 0 | enterprise_channel_sync_log | 0 |
| browser_workspace | 3 | browser_trajectory | 2 |
| agent_channel_binding | 1 | credential_vault | 0 |
| provider_credential | 7 | ResourceCredential | 2 |
| recruitment_channel | 8 | recruitment_channel_mapping | 24 |
| enterprise_interaction | 0 | Organization | 75 |
| governance_user | 47 | User | 131 |
| OrgMember | 51 | governance_tenant | 86 |

### 4.2 连接状态分布（enterprise_channel_account）
```sql
SELECT channel_type, connection_status, count(*) FROM enterprise_channel_account GROUP BY 1,2 ORDER BY 1,2;
-- PENDING 27 行（占 84%）、AUTHENTICATED 2（kuaishou、channels_wechat）、CONNECTED 1（douyin reality-test）、
-- EXPIRED 1（douyin 08a0f643）、WAITING_LOGIN 1（xiaohongshu）
-- 关键健康度: connected_at IS NULL = 28/32（从未连接成功）; last_sync_at IS NULL = 32/32（从未同步）
```
### 4.3 会话/工作区/验证状态分布
- channel_browser_session：RUNNING 4/4（均 chromium，profile 在 /data/browser-profiles/…）
- browser_workspace：RUNNING 1、CREATED 2（chrome，business_type=media）
- channel_verification_session：AUTH_SUCCESS 9、FAILED 2、WAIT_USER_LOGIN 2（全部集中在 4 个账号：douyin 08a0f643 ×8、kuaishou ×1、xiaohongshu ×1、channels_wechat ×2）
- agent_channel_binding：active 1（agent 7e0b486f → douyin 08a0f643 → workspace b27a2e1e，链路完整，agent 在 enterprise_agent_instance 中存在 ✓）

### 4.4 一致性核验（全部通过 ✓）
```sql
-- 9 项 FK 存在性校验全部 0 孤儿:
-- cbs/cvs/browser_workspace.channel_account_id、browser_trajectory.workspace_id、
-- agent_channel_binding.channel_account_id/browser_workspace_id、sync_log.channel_account_id、
-- rcm.channel_id、ccm.channel_account_id → 全部 LEFT JOIN 无缺失
-- external_account_id 唯一约束下无重复（唯一索引存在，28 行 NULL + 4 行唯一非空，无 '' 空串）
-- (tenant_id, channel_type) 唯一约束下无重复
```
### 4.5 Schema 与索引概况
- 16 张表全部有主键 + 二级索引齐全（agent_channel_binding 6 个索引、browser_trajectory 6 个、channel_customer_mapping 9 个），大表缺失索引问题不存在（最大表 32 行）。
- browser_workspace 唯一约束 `channel_account_id` → 账号与工作区 1:1。
- 表设计命名风格不统一（camelCase：User/ResourceCredential/Organization/UserModelConfigV2；snake_case：其余），跨表 join 需注意大小写。

### 4.6 活动时间线
- 渠道账号：2026-07-16 ~ 2026-08-02（最近更新 08-02 16:34）
- 验证会话：最晚 2026-08-02 23:59（AUTH_SUCCESS 至 08-03 00:34）
- User：2026-06-13 ~ 2026-08-02；governance_user：2026-06-29 ~ 07-19（**07-19 后无新 governance 用户**）

---

## 5. 修复建议优先级

1. **[紧急]** 轮换并清除明文密钥：provider_credential 3 条、UserModelConfigV2 6 条（尤其 `sk-09746cbe…` 疑似真实 Key，需立即吊销轮换）；storage_configs.accessKey 补加密。
2. **[高]** 修复 credential_encrypted 双重编码写入 bug（28 行 string → object），并强制 `_encrypted:true` 才允许落库；对 29 行 `_encrypted:false` 占位行做数据修复。
3. **[高]** 渠道表补外键（tenant_id→governance_tenant、organization_id→Organization、owner_id→User/governance_user 统一 id 空间）；清理 26 行幽灵租户账号与 24 行孤儿职位映射。
4. **[中]** 删除 channel_operation_log 唯一约束；为浏览器会话补 IDLE/CLOSED 生命周期与僵尸清理任务。
5. **[中]** 评估启用 RLS 或至少为敏感表收敛数据库账号权限（应用不应使用超级用户）。
6. **[低]** 清理测试/种子数据（phase-a、reality-test、t1/t2/default、fake UUID、占位密钥），统一 tenant/org 命名规范。

---

## 审计覆盖清单（实际执行的关键 SQL）

1. `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` → 464 表确认
2. 16+ 表行数 `count(*)` 全量（UNION ALL）
3. `information_schema.columns` 16 张渠道表全列/类型/默认值/可空性（195 列）
4. `pg_indexes` + `pg_get_indexdef` 16 表全索引（79 个索引）
5. `pg_constraint` 16 表全部约束（主键/外键/唯一/CHECK，26 条）
6. `SELECT id, credential_encrypted, jsonb_typeof(credential_encrypted) ...` → 双重编码 + _encrypted:false（28 行）
7. `SELECT id, encrypted_key, health_status FROM provider_credential` → 3 条明文 Key
8. `SELECT "userId", "llmApiKey", ... FROM "UserModelConfigV2" WHERE ... LIKE 'sk-%'` → 6 条明文 Key
9. `SELECT ... FROM storage_configs` → accessKey 明文
10. `SELECT ... FROM enterprise_llm_config` → 占位密钥
11. 孤儿校验：org/tenant/owner 三组 LEFT JOIN（Organization::text、governance_tenant、governance_user、User）
12. id 空间反查：`affc9201/d4568766/2adf05ef` 在 User/Organization/governance_tenant/OrgMember 全表查询
13. `WHERE owner_id=''` / `owner_type='org'` 空 owner 检查（3 行）
14. `GROUP BY channel_type, connection_status` 状态分布 + connected_at/last_sync_at 空值率
15. 9 项子表→父表 LEFT JOIN 孤儿校验（cbs/cvs/bw/bt/acb×2/esl/rcm/ccm）→ 全部 0
16. `jobs` 表 0 行 + rcm.job_id 3 个 job 全部不存在
17. `agent 7e0b486f` 在 enterprise_agent_instance 存在性（存在 ✓）
18. 重复检查：external_account_id 分组、`(tenant_id,channel_type)` 分组 → 均 0 重复
19. 时间异常：updated_at<created_at、未来时间、completed_at<started_at → 全部 0
20. 全库敏感列扫描：`column_name ILIKE '%token%|%secret%|%password%|%credential%|%api_key%|%access%|%refresh%'` → 60 列，逐表抽查内容
21. `pg_policies` 0 条 + 19 表 relrowsecurity 全 f
22. `information_schema.role_table_grants` 敏感表非 postgres 授权 → 0 条；current_user=postgres
23. `User.passwordHash` 抽样 → bcrypt（$2a$10$）哈希合规
24. 孤儿租户/用户：governance_tenant 无用户 40 个；User 与 governance_user 邮箱重叠 45/131
25. 种子时间分析：provider/recruitment_channel 同秒批量创建
26. 最大表扫描：usage_logs 634K 行 181MB（pg_class.reltuples 排序）
27. 各表 created/updated 时间范围（enterprise_channel_account / User / governance_user / governance_tenant / recruitment_*）
