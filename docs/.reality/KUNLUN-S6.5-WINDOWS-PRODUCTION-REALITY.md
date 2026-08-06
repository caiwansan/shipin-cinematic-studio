# KUNLUN-S6.5-WINDOWS-PRODUCTION-REALITY.md

> S6.5 Windows Production Reality — 就绪审计 + RG-W 验收手册
> 日期: 2026-08-06 15:20 (CST) | 状态: ✅ **服务器侧就绪; RG-W 实机手册交付（Windows 开发机执行）**
> 依据: 掌柜 S6.5 指令（不做新能力, 先让真实用户在 Windows 安装跑通第一个 AI Employee）
> 定位: **从「工程系统」到「可交付 Desktop 产品」的最后门槛**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| desktop/src-tauri/tauri.conf.json | +bundle.exclude（**/\*.bak, **/\*.bak-\*）——打包卫生（10 个备份文件不进安装包） |
| backend/scripts/s65-test.mts | Cloud 就绪验证（RG-W 依赖链） |
| docs/.reality/KUNLUN-S6.5-WINDOWS-PRODUCTION-REALITY.md | 本报告 + RG-W 验收手册 |

## 1. Phase A 就绪审计（服务器侧）

| 项 | 结论 |
|---|---|
| frontendDist=../ui 打包完整性 | ✅ index.html（53KB 自包含 Shell）+ bridge.html（被 RuntimeRouter 引用, 必须进包）; ⚠️ **10 个 .bak 会被打进包 → bundle.exclude 已加** |
| beforeBuildCommand | ✅ 空（frontendDist 直接打包, 无前端构建前置） |
| Rust 编译面 | ✅ 550 行, 6 crate 依赖, 无 todo 阻塞, release profile 已优化（lto/codegen-units=1） |
| capabilities | ✅ core/store/shell:allow-open（Windows 打包所需） |
| 图标 | ✅ icon.ico/icon.png/32x32.png/icon-1024.png 齐全 |
| deep link | ✅ kunlun:// 注册（lib.rs register_all + tauri.conf schemes） |

## 2. RG-W 验收手册（Windows 开发机执行）

### 前置（开发机）
```
1. Node 18+ / Rust stable / VS Build Tools(C++) / WebView2（Win10/11 自带）
2. cd desktop && npm install
```

### RG-W1 .exe 生成
```
./build.sh  （= tauri build → NSIS installer）
✅ 通过标准: src-tauri/target/release/bundle/nsis/Kunlun Media_1.2.0_x64-setup.exe 生成
```

### RG-W2 干净 Windows 安装
```
✅ 通过标准: 全新 VM/机器执行 installer → 安装完成（当前用户目录, installMode=currentUser）
```

### RG-W3 首次启动
```
✅ 通过标准: 桌面快捷方式启动 → 主窗口出现（1080x720, 标题「昆仑镜 Kunlun Desktop」）
  诊断: KunlunMedia.exe --diag 日志 4 分区落盘（startup/webview/api/error）
```

### RG-W4 登录
```
✅ 通过标准: 登录页 → 账号密码 → JWT 签发 → 凭据保存（tauri-plugin-store, 用户目录）
  云端依赖: /api/auth/login（已验证 ✅）
```

### RG-W5 AI Employee 发现
```
✅ 通过标准: 应用中心显示「AI 员工」区块 → 三员工商品卡（Alice/短剧/新媒体）+ 授权/增强/用量
  云端依赖: agent-definitions + entitlement + usage + enhancements（已验证 ✅）
```

### RG-W6 Workspace 启动
```
✅ 通过标准: 点击「启动」→ 新窗口打开工作台员工页（白名单域 aigc.fushtn.com）→ Cloud 执行 → 结果
  云端依赖: /workspace/recruitment + /hdz/workspace + /media-department/workspace + Hermes 链（已验证 ✅）
```

### RG-W7 卸载恢复
```
✅ 通过标准: 控制面板卸载 → 用户目录凭据清除 → 系统无残留进程/服务
```

## 3. Cloud 就绪验证（服务器实测, 8 PASS / 0 FAIL）

| 项 | 结果 |
|---|---|
| W4 登录链 | ✅ JWT 签发 |
| W5 员工发现（三员工 + 授权态） | ✅ |
| W6 工作台页存在（3 目标） + 前端主站可达 | ✅ |
| W6 启动后执行链 COMPLETED（含插件增强） | ✅ |
| 打包卫生 exclude 配置 | ✅ |

## 4. 完成标准对照

```
昆仑镜 AI OS Beta 0.1 产品定义:
  ✅ Desktop Client / AI Employee Platform / Plugin Enhancement / Enterprise Admin / Usage+Billing View
  ⏳ Windows 实机（RG-W1..W7 手册, 待开发机执行）→ Commercial Preview 门槛
→ 路线: S6.5 Windows → S6.6 Enterprise Center Polish → +2-3 垂直 Employee → S7 Marketplace（冻结）
```

## 5. 未完成项

- [ ] Windows 实机执行 RG-W1..W7（需 Windows 开发机; 手册已交付）
- [ ] 代码签名证书 / 自动更新通道（RG-W 后, Release 正式化）
- [ ] Enterprise Center 完善（S6.6）; 垂直 Employee 扩充（+2-3 个）; Marketplace（S7, 冻结）

## 6. 结论

```
S6.5 ✅ 服务器侧全部就绪（打包卫生/编译面/云链）+ RG-W 验收手册交付
→ 最后一步 = Windows 开发机执行手册（实机验证, 非服务器可替代）
→ 完成后昆仑镜从「工程系统」进入「可交付 Desktop 产品」
```
