# SPRINT-MEDIA-01-PREFLIGHT-CHECK — 微信公众平台真实接入前置检查

**Date:** 2026-08-02 01:50
**Gate:** 掌柜指令（先解决真实微信公众平台商务凭证路径，再开 Sprint-MEDIA-01）
**性质:** Preflight 检查清单 + 外部依赖确认书。**零代码**。通过本检查后拆 Sprint-MEDIA-01。

---

## 0. 结论先行

Sprint-MEDIA-01 的**唯一外部阻塞** = 微信公众平台凭证与账号权限。本文件把「需要掌柜确认的事项」「代码侧已验证的接入点」「技术验证方案」三者钉死。**掌柜完成 §7 开工清单中的凭证项后，Preflight 即通过，直接拆 Sprint-MEDIA-01。**

---

## 1. 微信公众号账号状态（需掌柜确认 ⚠️）

### 1.1 政策事实（2026-08 官方文档取证）
> 微信官方文档「发布能力」注：**2025 年 7 月起，个人主体账号、企业主体未认证账号及不支持认证的账号将被回收发布接口的调用权限。**

即：**发布闭环（freepublish/submit）要求「企业主体 + 已认证」**，个人主体订阅号无法真实发布（群发仅限每日 1 次且接口受限）。草稿箱接口文档标注「服务号可以通过服务端接口管理」——服务号可用；认证状态影响发布接口。

### 1.2 掌柜需确认的四选一

| 选项 | 账号类型 | 发布能力 | 数据接口 | Phase 1 可行性 |
|------|----------|----------|----------|----------------|
| A | 企业主体 · 已认证服务号 | ✅ freepublish 全通 | ✅ datacube 全通 | **首选，直接开工** |
| B | 企业主体 · 已认证订阅号 | ⚠️ 无 freepublish（官方政策） | ⚠️ 部分 | 需降级：仅素材/草稿，无真实发布 → **不满足 E2 Gate** |
| C | 企业主体 · 未认证 | ❌ 发布被回收 | ❌ | 不可行（Phase 1 无法真实发布） |
| D | 个人主体 | ❌ 发布被回收 | ❌ | 不可行 |
| E | 微信测试号（sandbox） | ⚠️ 接口存在但非真实对外 | — | 仅可验证 token/素材链路，**不可作为 E2 验收**（掌柜冻结：不 mock） |

**判定**：选项 A 才能过 Phase 1 E2 Gate（真实发布一条内容）。B/C/D 需掌柜先解决认证或换号；E 只作开发期链路调试，不作验收。

---

## 2. API 权限矩阵（Phase 1 用）

| 接口 | 路径 | 用途 | 权限要求（官方） | Phase 1 阶段 |
|------|------|------|------------------|--------------|
| 获取 access_token | GET /cgi-bin/token | 全局凭证 | appid/secret + IP 白名单 | 授权闭环 E1 |
| 获取关注者列表 | GET /cgi-bin/user/get | 账号基础数据 | 服务号/认证 | E1 补充 |
| 新增永久素材 | POST /cgi-bin/material/add_material | 图片/图文素材 | 服务号（认证更稳） | 发布前置 |
| 新增草稿 | POST /cgi-bin/draft/add | 图文草稿 | 服务号 | 发布前置 |
| 发布草稿 | POST /cgi-bin/freepublish/submit | **真实发布** | **企业主体+认证（2025.7 政策）** | **E2 核心** |
| 发布状态查询 | POST /cgi-bin/freepublish/get | 发布回查 | 同上 | E2 校验 |
| 用户分析 | POST /datacube/getusersummary | 粉丝增减 | 认证 | E3 数据回流 |
| 图文分析 | POST /datacube/getarticlesummary | 阅读/分享/收藏 | 认证 | E3 数据回流 |

> Preflight 执行时：用真实 appid/secret 逐个调通上述接口（账号 A 方案下），失败项记录具体 errcode/errmsg 进本文件附表。

---

## 3. ProviderCredential 接入点（代码侧已验证 ✅）

### 3.1 模型锚点
- `ProviderCredential`（schema.prisma:6887）：`ownerType=organization / organizationId / provider / encryptedKey / healthStatus(untested|ok|failed|decrypt_error) / healthLatencyMs / healthError`
- 唯一约束：`@@unique([ownerType, organizationId, provider])`；`provider` 为 VarChar(50)
- 加密链：`model-resolver.service.ts:151 saveOrgModelSettings` → `encryptKey(apiKey)`（with-user-key.ts）→ ProviderCredential 落库；读侧 `resolveEnterpriseModel` 解密（G4 管理员零明文已验收）

### 3.2 新媒体复用方式
- 微信凭证走同一 ProviderCredential 表：`ownerType='organization'`、`provider='wechat_mp'`（Phase 1 单账号）；encryptedKey 存 `appid:secret` JSON 密文
- healthStatus 直接承载微信凭证健康检查（token 可达性）——复用 `untested→ok/failed` 语义，零新表
- **设计约束（Sprint-MEDIA-01 定案项）**：唯一约束 `(ownerType, org, provider)` 意味着单企业单 provider 一条凭证 → 多公众号账号时 provider 值约定 `wechat_mp:<appid>`（50 字符内足够）或 SocialAccount.credentialId 直接外键（M1 已设计）——**Phase 1 单账号用 `wechat_mp`，多账号方案在 M1 migration 时定案，不影响 Preflight**

### 3.3 与招聘线差异（防混淆）
- 招聘渠道凭证：EnterpriseChannelAccount（渠道 Token）→ **新媒体不复用**（掌柜批准：SocialAccount 独立，语义错位纠正）
- 模型 Key：OrgModelConfig + ProviderCredential（deepseek 等）→ 与微信凭证同表不同 provider，天然隔离

---

## 4. 微信 adapter 技术验证方案（Sprint-MEDIA-01 交付后执行）

```
backend/src/services/media/platforms/wechat-mp.adapter.ts
├── getAccessToken(appid, secret)
│     GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=..&secret=..
│     → access_token(2h) + expires_in；内存缓存 + 过期前 5min 刷新；401/40001 触发强制刷新
├── getFollowerList(accessToken)          → openid 列表（分页）
├── addMaterial(accessToken, media)       → media_id（永久素材）
├── addDraft(accessToken, article)        → media_id（草稿）
├── submitPublish(accessToken, draftMediaId) → publish_id
├── getPublishStatus(accessToken, publishId) → SUCCESS/FAIL 轮询
└── getArticleSummary(accessToken, begin, end) → datacube 图文数据
```

验证脚本（真实调用，非 mock）：
```
scripts/verify-wechat-mp.ts
  1. token 获取 + 缓存命中 + 强制刷新 三态验证
  2. 素材上传（1 张测试图）
  3. 草稿新增 → 发布 → 状态轮询 → 平台可见（E2 截图）
  4. datacube 拉取 → SocialMetricsSnapshot 落库（E3）
  5. 错误矩阵：错 appid/secret → 40013/40125；IP 未白名单 → 40164；超频 → 45009
```

---

## 5. OAuth/token 流程验证

| 验证项 | 预期 | 失败信号 |
|--------|------|----------|
| token 获取 | access_token + expires_in=7200 | 40013 无效 appid / 40125 无效 secret / 40164 IP 未白名单 |
| token 缓存 | 2h 内复用不重复请求 | 每次请求都打 /cgi-bin/token = 缓存未生效 |
| 过期刷新 | 过期后自动重取 | 40001 后仍用旧 token |
| 凭证健康检查 | ProviderCredential.healthStatus=ok + healthLatencyMs | decrypt_error → 解密链问题 |
| 幂等发布 | 同一草稿不重复发布 | publish_id 重复产生 |
| 频控 | 发布频控（服务号月 4 次群发限制外的 freepublish 限制） | 45009/45064 按文档退避 |

> 注：freepublish 的频控限制（每日/每月发布次数）以官方最新文档 + 真实调用为准，adapter 内实现退避重试，Preflight 记录实测频控值。

---

## 6. IP 白名单验证方案

- **服务器公网 IP（已取证）**：`124.223.208.24`（腾讯云，出口 IP；生产域名解析同机）
- 验证步骤：
  1. 掌柜在公众平台后台「开发 → 基本配置 → IP 白名单」添加 `124.223.208.24`
  2. Preflight 脚本用真实 appid/secret 请求 /cgi-bin/token
  3. 成功 → 白名单生效；返回 `errcode:40164` → 白名单未生效或出口 IP 变化（需复查 NAT/代理出口）
- **风险标注**：服务器存在 Docker 网桥（172.17/172.20）与 eth0 内网 10.0.16.10——出网统一走公网 IP，但若未来加代理/CDN 需重验；IP 白名单仅限服务器本机出网，不影响用户端

---

## 7. Phase 1 开工清单（Preflight Gate）

### 7.1 掌柜提供项（外部依赖，唯一阻塞）
| # | 项 | 说明 |
|---|----|------|
| P1 | 公众号主体与认证确认 | 按 §1.2 选型（首选 A：企业已认证服务号） |
| P2 | appid + secret | 企业资产，交付后由我加密入 ProviderCredential（禁明文外传） |
| P3 | IP 白名单授权 | 同意将 `124.223.208.24` 加入公众号 IP 白名单（或掌柜代操作） |
| P4 | （可选）测试号 appid/secret | 开发期链路调试用，不作 E2 验收 |

### 7.2 开发项（Preflight 通过后 Sprint-MEDIA-01 交付）
- M1 migration（SocialAccount/SocialPost/SocialMetricsSnapshot，provider 多账号方案定案）
- B1 media-workspace 路由骨架 + B2 account.service + wechat-mp adapter
- 凭证存取 API（复用 saveOrgModelSettings 模式，provider='wechat_mp'）
- 验证脚本 scripts/verify-wechat-mp.ts（§4 五步）

### 7.3 Preflight Gate 判定
```
PASS = P1(选项A) + P2 交付 + P3 确认
     + 验证脚本 5 步真实跑通（token/素材/草稿/发布/datacube）
     + ProviderCredential.healthStatus=ok
     + E2 平台可见截图 + E3 数据落库截图
FAIL = 任何 mock / 任何明文凭证 / 发布接口权限不足（降级方案需掌柜书面批准）
```

### 7.4 不满足时的降级路径（需掌柜拍板，不可自行降级）
- 若只有认证订阅号 → Phase 1 改为「素材+草稿真实链路 + 数据回流」，E2 发布 Gate 挂起等认证升级（掌柜确认）
- 若只有测试号 → 仅开发调试，E2/E3 验收等待真实号（掌柜确认）

---

## 8. 风险登记表

| 风险 | 等级 | 缓解 |
|------|------|------|
| 发布接口权限回收（2025.7 政策） | 高 | §1.2 选型前置确认，杜绝开工后返工 |
| IP 白名单出口变化（NAT/代理） | 中 | Preflight 实测 + 文档记录当前出口 |
| freepublish 频控未知 | 中 | adapter 退避重试 + 实测记录 |
| 多公众号凭证唯一约束冲突 | 低 | M1 migration 定案 provider 命名方案 |
| 凭证明文泄露 | 高（红线） | ProviderCredential 加密 + G4 掩码展示 + 禁日志打印 |

---

**锚点索引**：ProviderCredential `schema.prisma:6887`；唯一约束 `:6902`；加密写入 `model-resolver.service.ts:151-200`；加密函数 `with-user-key.ts`；发布政策来源 developers.weixin.qq.com/doc/service/guide/product/publish.html（2025.7 权限回收注）；草稿箱来源 .../guide/product/draft.html；服务器公网 IP `124.223.208.24`（本机 ifconfig.me 实测）
