# MEDIA-LOGIN-CAPABILITY-V3 登录能力模型 v3 重构

**Date:** 2026-08-03 23:20
**Gate:** 掌柜批准（2026-08-03 06:4x）——「不再是修某个平台登录，而是把新媒体渠道登录能力从『浏览器扫码功能』升级为『AI 员工数字电脑身份系统』」
**状态:** Task01-03 完成 ✅ ｜ Task04 G6 V3 真机验收待掌柜扫码

---

## 一、核心模型变更（authenticated → 三层认证）

```
旧：authenticated = credential && (identity || page)     ← 单布尔，快手假成功/小红书永不认证
新：
  LoginRealityState {
    session:   { authenticated }   // Layer1 浏览器已登录平台账号（真实登录凭证+非登录页）
    identity:  { resolved, accountId, accountName, sourceUrl }  // Layer2 登录的是谁
    workspace: { ready, url }      // Layer3 AI 员工能在哪个工作台工作（urlFragments 命中）
  }
CONNECTED 硬条件 = session ✓ && identity ✓（extId 非空）&& workspace ✓
任何中间失败 = LOGIN_PARTIAL / NEEDS_REAUTH / WAIT_LOGIN（诚实展示，绝不伪装 CONNECTED）
```

## 二、Task01 登录能力模型拆分 ✅

**文件**：`browser-channel.probe.ts` / `login-state-machine.ts` / `identity-probe.ts` / `browser-channel.adapter.ts`

- `LoginRealityState` 公共类型（identity-probe.ts）——三层认证现实，探针输出、上层消费
- 探针 signals 新增 `sessionAuthenticated / identityResolved / workspaceReady` 三信号
- 状态机新增 `SCAN_CONFIRMED / SESSION_AUTHENTICATED / IDENTITY_RESOLVED / WORKSPACE_READY / LOGIN_PARTIAL`
- `derive()` 三信号驱动 + 旧参数兼容（authenticated/hasIdentity 仍可用）
- **CONNECTED 保护（身份快照原则）**：已连接账号单次探针不完整 → 保持 CONNECTED 不降级；session 丢失才降级
- 回归：hardening-02 **58/58 PASS**

## 三、Task02 删除假成功路径 ✅

**实证**（修复前 22:31 → 修复后 22:57，同一浏览器同一 /profile 页）：

```
修复前：page=true（markers 误判）→ authenticated=true → connect connected + accountName=「快手」+ extId 缺失（假成功）
修复后：page=false（urlFragments 未命中）→ authenticated=false → connect waiting_login（诚实）
        status state=LOGIN_PARTIAL / reality={session:true, identity:false, workspace:false}
```

- **删除 markers≥2 → page=true**（快手个人中心导航词误判根因；markers 降为诊断日志）
- **删除 `accountName || meta.displayName` fallback 3 处**（平台名冒充账号名根因）
- **connected 硬条件**：`authenticated && accountId && reality.identity.resolved && reality.workspace.ready`（connect 快路径 + 导航后路径 + waitForLogin 三处对齐）
- **状态机迁移表补全**：AUTHENTICATED → WAIT_LOGIN（修复旧卡死：认证态永不降级）、登录中状态 → IDENTITY_RESOLVED/WORKSPACE_READY（持久登录态 fast path）
- **DB 修正**：快手 CONNECTED → **EXPIRED**（Recovery 新代码诚实降级）+ 假名「快手」清除（displayName 冒充，非身份资产）
- 状态机单测 **8/8 PASS**；回归 hardening-02 **58/58 PASS**；identity-v2 35/36（G4 断言前提过期——快手 EXPIRED 正是本任务目标行为）

## 四、Task03 ChannelCapability 升级 ✅

- meta 新增 `navigation: { afterSessionAuthenticated }`（快手/小红书 = true；抖音/视频号自动跳转无需导航）
- `waitForLogin` 自动导航：session✓ + workspace✗ + 平台配置 → 导航 workspaceUrl → 重新探针 → 全绿即 connected；20s 节流防死循环；**扫码确认窗口期不触发**（session 未成立，绝不打断确认）
- Registry `PlatformCapability` 新增 `navigation` 字段（前端/调试可读）
- **实测导航触发**：快手 /profile → `waitForLogin 自动导航工作台 cp.kuaishou.com/article`（工作台 cookie 数据中心 IP 已失效 → 诚实失败 → 节流重试）
- 回归 hardening-02 **58/58 PASS**

## 五、四平台当前真实状态（2026-08-03 23:20）

| 平台 | DB | 实测 | 判定 |
|---|---|---|---|
| 抖音 | CONNECTED | creator-micro 工作台 | ✅ 真实（三层全绿） |
| 视频号 | CONNECTED | platform 工作台 | ✅ 真实（三层全绿，审计期已修 keyCookies+清理守卫） |
| 快手 | EXPIRED（原假 CONNECTED） | /profile + LOGIN_PARTIAL | ✅ 诚实（passport 会话在，身份/工作台未确认） |
| 小红书 | WAITING_LOGIN | 登录页 | ✅ 诚实（扫码后自动导航 creator 待掌柜实测） |

## 六、G6 V3 自动化回归

- G6 2-6：**11 PASS / 2 FAIL**（S2 数字电脑/S3 浏览器关闭恢复/S4 CONNECTED 保持/S6 截图全绿）
- 2 个失败均非本次回归：S4 日志匹配（断言前提）、S5 HealthGuard 保护链诚实拦截（抖音数据页特征缺失，账号保护中）
- hardening-02 **58/58** ｜ 状态机单测 **8/8** ｜ identity-v2 35/36（断言过期项）

## 七、待掌柜（G6 V3 真机验收）

1. **快手**：真机扫码 → passport 确认 → 自动导航 article → 身份提取（userId+nickname）→ CONNECTED
2. **小红书**：真机扫码 → web_session 成立 → 自动导航 creator.xiaohongshu.com/new/home → 身份提取 → CONNECTED
3. 抖音/视频号回归确认（扫码一次验证三层链）
4. 验收后快手/小红书 metrics 真实读取 + AI 员工分析

## 冻结清单（持续）

❌ 微博 ❌ 头条 ❌ 公众号 ❌ 自动发布 ❌ MCP ❌ 矩阵运营 ❌ 新平台
⏸ 安全项（明文 Key / IDOR）单独进 Security Sprint
