# MEDIA-LOGIN-FULL-CHAIN-AUDIT-02 新媒体账号登录全链路审计

**日期:** 2026-08-03 22:40
**Gate:** 掌柜战略指令（暂停逐平台盲修 → 全链路审计，找「扫码成功但身份没落地」的架构级统一断点）
**状态:** 审计完成 ✅（零代码修改；仅记录审计前已完成的视频号最小修复）

---

## 一、当前真实状态（2026-08-03 22:40 实测）

| 平台 | DB 状态 | 实测页面 | 探针信号 | 判定 | 真实性 |
|---|---|---|---|---|---|
| 抖音 | CONNECTED | creator-micro/home（工作台） | page✓ cookie✓ identity✓ | authenticated=true | ✅ 真实 |
| 视频号 | CONNECTED | channels.weixin.qq.com/platform（工作台） | page✓ cookie✓ identity✓ | authenticated=true | ✅ 真实（修复后） |
| 快手 | CONNECTED | **cp.kuaishou.com/profile（个人中心，非工作台）** | page✓* cookie✓ identity✗ | authenticated=true | ⚠️ **假成功**（*page 由 markers 误判） |
| 小红书 | WAITING_LOGIN | www.xiaohongshu.com/login（登录页） | 全 false | authenticated=false | ✅ 诚实（但扫码后永不认证，见下） |

**4 平台中：2 个真实、1 个假成功（快手）、1 个永不认证（小红书）。**

---

## 二、统一根因（架构级）

### 探针公式（browser-channel.probe.ts + identity-probe.ts）

```js
authenticated = credential && (identity || page)
credential    = cookie && !loginPage
cookie        = keyCookies 命中 ≥ 2
page          = urlFragments 命中  OR  markers 命中 ≥ 2   ← 漏洞
identity      = 任意页面提取到 userId/nickname（不限来源 URL）← 漏洞
```

### 根因 A：page 信号的 markers 分支绕过工作台 URL 检查（→ 快手假成功）

- 设计意图：markers（页面特征词）作为 urlFragments 的补充。
- 实际后果：创作者**个人中心**页（/profile）包含「作品管理/创作服务/视频管理」等导航 marker → markers 命中 ≥2 → page=true，**即使 URL 不在 urlFragments**。
- 快实现状：passport 会话有效（cookie=true）+ /profile 误判（page=true）+ 身份提取失败（identity=false）→ `authenticated = true && (false || true)` = **假成功**。
- 假成功下游污染：connect 返回 `connected` + `accountName = identity.accountName || meta.displayName` → **「快手」平台名冒充账号名** + externalAccountId 缺失 → 刷新/恢复全链路都认为已登录，但没有任何创作工作台会话。
- **掌柜问题C 实锤：authenticated=true 时身份可能不存在。**

### 根因 B：identity 信号与来源 URL 解耦（→ 快手假名 / 小红书提取失败）

- 身份提取在**任何页面**执行（登录页短路除外），不校验「是否工作台页面」。
- 快手：/profile 提取失败 → identity=false → 但 page 漏洞兜住（假成功），名字 fallback 假名。
- 小红书：主站页面**没有**「小红书号:」文本，hydration `user.*` 变量只在创作者中心 → identity=false；且主站 URL 永不命中 urlFragments → page=false → **永不认证（过严）**。
- **掌柜问题A 实锤：小红书/快手扫码确认后平台不跳转工作台，探针却把「跳工作台」当认证前提。**

### 根因 C：keyCookies 配置与平台真实登录 cookie 不符（→ 视频号永不认证，已修）

- 视频号：真实登录 cookie = sessionid + wxuin；旧配置 wxsid/rand_info/mm_lang 是公众号 cookie → 永不凑齐 ≥2 → cookie 永远 false。
- 快手：`did` 是**游客 cookie**，混入 keyCookies → 存在「游客态凑数」风险（当前未触发，但设计不洁）。
- 小红书：`gid/customerClientId` 是**游客 cookie**，web_session 才是登录 cookie。
- **掌柜问题B 实锤：cookie 信号既要防「游客 cookie 冒充登录」，又要认「平台真实登录 cookie」——配置必须逐平台实测校准。**

### 统一断点一句话

> **探针公式假设所有平台「扫码确认后自动跳转工作台 URL」，且把「页面特征词/任意页身份」当作工作台证明——但快手/小红书扫码后不跳转，快手个人中心页还有工作台导航词。公式的 page 分支和 identity 分支都不可信，导致快手假成功、小红书永不认证。**

---

## 三、修复方案（设计稿——只设计，本轮不改代码）

### 方案核心：认证硬条件 = 工作台 URL（credential && page，page 只认 urlFragments）

```
新公式：
  page       = urlFragments 命中（删除 markers ≥2 分支，或 markers 仅作辅助日志）
  identity   = 仅当「身份来源 URL 命中 urlFragments」才计入（来源 URL 随提取结果记录）
  authenticated = credential && page        ← 工作台 URL 是登录成功的唯一硬证明
  accountName / externalAccountId 仅从工作台身份提取填充（提取失败 → 不 connected，返回明确状态）
```

### 改哪里 / 为什么 / 影响 / 验收

**改动 1：browser-channel.probe.ts — page 信号收紧**
- `page = urlFragments.some(f => url.includes(f))`，删除 markers ≥2 分支（markers 保留用于诊断日志）。
- 为什么：个人中心页导航词导致误判是快手假成功直接机制。
- 影响：快手 /profile → page=false → authenticated=false → 诚实 EXPIRED（不再假成功）；抖音/视频号工作台 URL 不受影响。
- 验收：快手 connect 后返回 waiting_login 而非 connected；/profile 不再 loggedIn=true。

**改动 2：identity 提取记录来源 URL，仅工作台内身份计入**
- extractIdentity 返回 `sourceUrl`；仅当 sourceUrl 命中 urlFragments（或平台显式身份页）时 signals.identity=true。
- 为什么：防止「任意页身份」冒充工作台身份（快手 connect 假名「快手」的根源）。
- 影响：假名不再出现；authenticated 时身份必然来自工作台。
- 验收：快手 connect 不再返回 accountName='快手'。

**改动 3：快手/小红书 meta — 登录确认后自动导航工作台（登录流程修正，非新平台）**
- 快手 `loginEntry` 增加 `postLoginNavigate: 'https://cp.kuaishou.com/article'`（passport 会话确认后导航到工作台，页面自身请求带签名，无需手动点击）。
- 小红书 `loginEntry` 增加 `postLoginNavigate: 'https://creator.xiaohongshu.com/new/home'`（web_session 生效后导航创作者中心，工作台 DOM 提供 page+identity 双信号）。
- 为什么：解决问题A——探针要求工作台 URL，但这两个平台扫码后停留原页。导航是「把用户/浏览器带到工作台」，不是伪造登录。
- 影响：只影响快手/小红书两个平台配置；抖音/视频号（自动跳转）不配置即可。
- 验收：小红书扫码确认 → 页面自动进入 creator 工作台 → page=true + identity 提取成功 → CONNECTED。

**改动 4：keyCookies 逐平台实测校准（配置修正）**
- 快手：移除游客 cookie `did`（或改为 `did 仅作辅助不参与认证`）；保留 bUserId/kwssectoken。
- 小红书：登录 cookie = web_session；gid/customerClientId 游客就有——**认证依赖 page（工作台 URL）+ cookie 双条件**后，游客 cookie 不再构成冒充风险，但配置仍应收敛。
- 为什么：根因C——cookie 信号必须映射真实登录凭证，杜绝游客 cookie 冒充。
- 验收：游客态（未登录）cookie≥2 但 URL 非工作台 → authenticated=false（公式已保证）。

**改动 5（可选，后续）**：waitChannelLogin 的 connected 分支加硬校验——`identity.accountId` 缺失或 accountName 等于 displayName 时拒绝 connected（防假名回写）。现状代码已有 accountId 非空校验（LOGN-REALITY-FIX-01），但 connect 快速路径（connect 方法内 authenticated 直接 return connected）无此校验——**快手假成功即来自此路径**，需对齐。

### 影响矩阵

| 平台 | 改动前 | 改动后 | 变化 |
|---|---|---|---|
| 抖音 | ✅ 真实 | ✅ 真实 | 无（回归） |
| 视频号 | ✅ 真实（已修） | ✅ 真实 | 无（回归） |
| 快手 | ⚠️ 假成功 | ✅ 真实（导航工作台后） | 修复 |
| 小红书 | ❌ 永不认证 | ✅ 真实（导航工作台后） | 修复 |

### 统一验收（四平台全绿定义）

```
二维码出来 → 手机确认 → 浏览器自动进入工作台 URL
→ page=true（urlFragments 命中）
→ cookie=true（真实登录 cookie ≥2，无游客冒充）
→ identity=true（工作台内提取到 userId+nickname）
→ authenticated=true → 身份落库（externalAccountId+accountName）
→ credential 保存 → workspace 绑定 → CONNECTED
→ 刷新保持 → PM2 重启保持
缺任一环 = 未登录（诚实展示，不假装）
```

---

## 四、审计方法说明

- **静态审计**：browser-channel.meta.ts（8 平台配置）/ browser-channel.probe.ts（信号公式）/ login-state-machine.ts（探针驱动）/ channel.service.ts（waitChannelLogin 保存链）/ browser-channel.adapter.ts（connect/清理）。
- **动态审计**：4 平台真实 Chromium connect + 5×3s 轮询（真实 URL/cookie/probe 信号/状态机），全程零代码修改。
- **关键实测**：视频号直测浏览器（sessionid+wxuin cookie 实证）、快手 /profile 假成功（信号实测）、小红书登录页（诚实未登录）。
- **未覆盖**：扫码后动态段（掌柜真机扫码补全）——但断点定位不依赖扫码段：快手的假成功与小红书的过严判定，均已在「判定逻辑」层面用登录前状态 + 代码路径分析实锤。

## 五、待掌柜决策

1. 是否批准本修复设计（改动 1-5）进入下一 sprint 实施？
2. 视频号审计前的两处最小修复（keyCookies 配置 + 清理守卫）是否保留？（建议保留：守卫是保护性的，配置是实测校准）
3. 快手当前 DB CONNECTED 为假成功状态——修复后会自动诚实降级 EXPIRED，需掌柜真机扫码恢复真实登录。
