# ECO-11.3 — Local Plugin Loader Design（本地插件加载器）

**Date:** 2026-08-04 ｜ **状态:** 只读设计 ｜ **前置:** ECO-11.2（设备/License/Shell 落地后）

---

## 1. 定位

本地插件加载器 = 「线上插件」与「本地运行」之间的桥。

**现状缺口（Phase 0 审计 #3）：**
- 插件 manifest 只有 `runtime: { kaor: boolean }`，无本地加载信息
- KAOR `memory`/`tool` 能力为 `contract` 状态（注释明示执行待 Local App Sprint）
- 云端 launch-check 已通（G5 实测 `allowed:true`），但只校验 License，不产生本地运行时

## 2. 加载流程（Local Load Sequence）

```
用户打开 Kunlun Media.exe  → 进入工作台 → 点击「AI 员工插件」
  │
  ├─ ① 本地检查插件缓存（ecology_local_plugin_runtime 本地镜像）
  │    存在 → 校验 configVersion 与云端一致（ETag）→ 直接进入 ⑥
  │
  ├─ ② 请求 License（POST /api/ecosystem/marketplace/launch-check）
  │    body: { pluginId, machineId, source: 'local_app' }
  │    → allowed:true → 返回 { entitlements, configVersion, pluginManifest }
  │    → allowed:false → 插件卡 LOADED 但 RUNNING 拒绝（G7：插件停，应用不停）
  │
  ├─ ③ 下载插件配置（GET /api/ecosystem/marketplace/items/:pluginId → manifest + 挂载点）
  │    本地缓存至 Tauri appData/plugins/<pluginId>/config.json（AES-GCM）
  │
  ├─ ④ 创建 Local Plugin Runtime 记录（本地 + 云端 ecology_local_plugin_runtime）
  │    status: LOADED → RUNNING
  │
  ├─ ⑤ 挂载能力（根据 manifest.permissions 白名单映射本地工具）
  │    browser  → 本地浏览器桥（复用 CDP 控制，权限校验先行）
  │    content  → 本地文件读写（沙箱目录内）
  │    analytics→ 只读数据（不可写）
  │    storage  → 本地加密存储
  │    network  → 白名单域（默认拒绝）
  │
  └─ ⑥ AI 员工运行
        执行引擎：云端 Hermes（远程 Agent 实例，本地只做 UI 呈现 + 输入输出）
        memory 执行：本地加密存储（contract → local 实现）
        tool 执行：本地工具经权限校验后执行（contract → local 实现）
```

## 3. 插件状态机（Local）

```
            ┌─────────┐
            │ LOADED  │ ← 配置下载完成
            └────┬────┘
                 │ License allowed + 挂载完成
                 ▼
            ┌─────────┐      License 过期/吊销
            │ RUNNING │ ───────────────────────────────┐
            └────┬────┘                                ▼
                 │ 用户停止 / 应用退出           ┌──────────────┐
                 ▼                            │LICENSE_EXPIRED│（应用继续）
            ┌─────────┐                       └──────────────┘
            │ STOPPED │←──── 重新授权后恢复 RUNNING
            └─────────┘
            ERROR：manifest 解析失败 / 挂载失败 → 回 LOADED 并上报错误
```

## 4. 与 manifest 的对接（需 ECO-11.3 实施时扩展 schema）

现状 `runtime: { kaor: boolean }` → 建议扩展（兼容旧 manifest，`local` 可选）：

```json
{
  "id": "ai-viral-analyst",
  "runtime": {
    "kaor": true,
    "local": {
      "entry": "plugins/ai-viral-analyst/main.js",
      "sandbox": "appdata",
      "permissions": ["browser", "analytics"]
    }
  }
}
```

**Phase 0 纪律：本地不执行第三方代码。** 插件「执行」= manifest 配置 + 能力声明 + AI 员工（云端 Hermes 推理），本地仅做 UI 壳与工具桥。真正的本地代码执行（如插件自带 JS）必须等「安全沙箱 + 签名校验 + 审计」完整后单独开 Security Sprint，绝不提前放开。

## 5. 安全边界（Loader 专属）

| 环节 | 控制 |
|---|---|
| 配置下载 | HTTPS + 服务端签名（Ed25519），本地验签后落盘 |
| 本地存储 | 沙箱目录（appData/plugins/<pluginId>/），禁止越界 |
| 工具调用 | manifest.permissions 白名单 + 每次调用本地 Permission Gate（复用 KAOR checkPermission 语义） |
| 审计 | 本地操作日志（工具调用/文件访问/网络请求）→ 云端 ecology_local_plugin_runtime 状态 + 本地 append-only 日志 |
| 吊销 | 云端 device REVOKED → heartbeat 403 → RUNNING→LICENSE_EXPIRED |

## 6. 验收标准（ECO-11.3 Reality Gate 草案）

1. 安装插件 → LOADED → RUNNING（本地状态机完整）
2. License 过期 → 插件 LICENSED_EXPIRED，**应用不退出**（G7 语义本地化）
3. License 恢复 → 插件自动回 RUNNING（无需重装）
4. 设备吊销 → 插件立即停止 + 本地 token 清除
5. 权限越界调用（未声明 permission）→ 拒绝 + 审计记录
6. 双设备：A 设备安装，B 设备未绑定 → B 设备启动插件 denied（设备隔离）

---

*设计稿，未实施。*
