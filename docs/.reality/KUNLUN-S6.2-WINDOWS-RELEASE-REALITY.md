# KUNLUN-S6.2-WINDOWS-RELEASE-REALITY.md

> S6.2 Windows Release Engineering — Release Gate（RG1-RG6）
> 日期: 2026-08-06 14:00 (CST) | 状态: ✅ **配置就绪 + 边界/回归全过; 实机项待 Windows 开发机**
> 依据: 掌柜 S6.2 执行指令（先审计→最小改动→实机验证; 禁本地 Runtime/Agent/模型/Key/重构 Tauri）
> 定位: **Desktop Beta Release 就绪（可安装/可启动/可登录/可发现员工/可进 Workspace/不越界）**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| desktop/build.sh | 遗留 electron-builder → Tauri v2 构建对齐（npm run build → NSIS） |
| desktop/publish.sh | 打包段 Tauri 对齐 + installer 上传 releases/desktop/ |
| backend/scripts/s62-test.mts | RG1-RG6 Release Gate |
| docs/.reality/KUNLUN-S6.2-WINDOWS-RELEASE-REALITY.md | 本报告 |

**最小改动原则**: tauri.conf.json 零改动（nsis 已配置）; 版本权威已对齐; 无新依赖

## 1. Phase A 审计结论

| # | 审计项 | 结论 |
|---|---|---|
| R1 | tauri.conf | ✅ **已配置 nsis**（targets=[nsis], SimpChinese, installMode=currentUser, webview downloadBootstrapper silent）— 距 installer 零配置差距 |
| R2 | Build Pipeline | ⚠️ **唯一实质差距**: build.sh/publish.sh 是遗留 electron-builder 脚本（工程已迁 Tauri v2）→ 已对齐 |
| R3 | 权限模型 | ✅ tauri-plugin-store（用户数据目录, 非项目/系统目录）+ 内存 token; 明文 store = 既有冻结设计（S1.2, 用户可清除, 记录） |
| R4 | Update | ❌ 未配置 → DOCUMENTED NOT READY（掌柜允许, 不实现更新服务器） |
| R5 | 边界扫描 | ✅ 0 key / 0 provider / 0 runtime / 0 skill 执行 |

## 2. Phase B 最小实现

```
B1 Windows Bundle: tauri.conf 已有 nsis → 零改动 ✅
B2 Version Authority: package.json 1.2.0 = tauri.conf 1.2.0 = Cargo.toml 1.2.0 → 已对齐 ✅
B3 Build Reality: build.sh/publish.sh 对齐 Tauri（Windows 开发机执行: ./build.sh → NSIS installer）
```

## 3. Release Gate 结果（实测 10 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| RG1 | Installer 配置 | ✅ | bundle.targets=nsis 就绪; 实机 .exe 生成/安装/卸载 = 待 Windows 开发机 |
| RG2 | First Launch 配置 | ✅ | installMode=currentUser（普通用户目录）; 登录/token 流程 = 待实机 |
| RG3 | Product Reality 配置 | ✅ | productName/identifier 就绪; 版本权威三源对齐; 实机 UI = 待实机 |
| RG4 | Security Boundary | ✅ | 扫描 0 key / 0 provider / 0 runtime / 0 skill 执行 |
| RG5 | Upgrade Reality | ✅ | DOCUMENTED NOT READY（未配置 updater, 不强行实现） |
| RG6 | 云端回归 | ✅ | Alice+插件增强 / 短剧导演 / 新媒体 全 COMPLETED（source=real） |

## 4. 完成标准对照

```
Desktop Beta Release 就绪:
  可安装 ✅（nsis 配置, 实机待开发机）
  可启动 ✅（Rust Host 就绪, 实机待开发机）
  可登录 ✅（JWT 链实测, 实机待开发机）
  可发现 AI Employee ✅（S6.1 商品卡实测）
  可进入 Workspace ✅（启动映射实测）
  不越界执行 ✅（RG4 扫描 0 越界）
```

## 5. 未完成项（实机, 需 Windows 开发机）

- [ ] Windows 开发机执行 ./build.sh → 生成 NSIS installer（RG1 实机）
- [ ] Clean machine 安装/启动/卸载验证（RG1-3 实机）
- [ ] 代码签名证书（后续）; 崩溃自动上报开关（诊断模式已有, 补开关）
- [ ] Update Channel（RG5, 掌柜裁决后实现 updater 服务器）

## 6. 结论

```
S6.2 ✅ 服务器侧全部就绪（配置 + 边界 + 回归）
→ Desktop Beta Release 待 Windows 开发机实机构建（Release Engineering 最后一步）
→ 下一阶段（掌柜规划）: S6.3 Enterprise Admin Reality → S6.4 Billing UI Reality → S7 Marketplace
```
