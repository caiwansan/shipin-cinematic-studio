# KUNLUN-BETA0.1-RELEASE-CLOSURE-AUDIT.md

> Beta 0.1 Release Closure Audit（Task 01/02）— 阻塞根因定位
> 日期: 2026-08-06 23:50 (CST) | 状态: ⚠️ **BUILD_READY（通道存在）但 Actions 账户级故障阻塞**
> 依据: 掌柜 Release Closure 指令（结束等待模式; 审计构建链; 找阻塞原因; 完成第一个 1.2.0 安装包）

---

## 0. 重要事实修正

之前以为「没有 Windows 构建环境」——**审计后更正**：

```
✅ Windows 构建通道已存在（.github/workflows/desktop-release.yml）
   windows-latest runner + Node 22 + Rust stable + NSIS + GitHub Release 自动发版
✅ 首个 v1.2.0 安装包曾成功生成（2026-08-05 13:39 UTC, 2,076,189 字节）
   Kunlun.Media_1.2.0_x64-setup.exe（当时 tag 指向旧代码, 不含 S8 体验层）
⚠️ 之后每次构建全部失败（Set up job 阶段, 非代码问题）
```

## 1. Task 01 — 构建条件审计

| 项 | 状态 |
|---|---|
| 服务器直接构建 | ❌ Linux（OpenCloudOS 9.4）无 Windows 工具链（无 rustc/cargo/makensis） |
| GitHub Actions windows-latest | ✅ 环境可用（Node/Rust/NSIS 流程完整, 历史成功 1 次） |
| workflow 文件语法 | ✅ YAML OK / 无隐藏字符 / 完整提交历史（Release-01 系列） |
| **失败定位** | ❌ **build-windows job「Set up job」阶段失败**（runner 分配前）; geo-gate 等所有 workflow 同步失败 → **账户级故障, 非 workflow 代码** |

## 2. Task 02 — 阻塞根因与最短闭环

```
根因: GitHub Actions 账户级 runner 分配失败（Set up job failure）
  可能: 免费额度耗尽 / 并发限制 / 账户 Actions 服务问题（需 GitHub 侧检查）
证据: 2026-08-05 构建成功 → 此后所有 workflow（含无关的 geo-gate）全 failure

最短闭环方案:
  A. 恢复 GitHub Actions（掌柜 GitHub 侧检查配额/账单/runner 状态）→ 重新触发构建
     （tag v1.2.0 已移动到最新代码 ea7c7a8f 含 S8, push 即触发）
  B. 备用: 掌柜提供 Windows 机器 → ./build.sh + ./publish.sh（手册已交付）
  C. 不建议: 分发 08-05 旧 UI 安装包（体验层 S8 缺失）
```

## 3. 当前产物状态

```
GitHub Release v1.2.0: tag 移动后 Release 已失效（旧资产关联已删）
服务器 releases/desktop/: 空壳 yml + 旧测试 exe（非 1.2.0 正式）
latest.json: 缺失（publish.sh 已具备生成逻辑）
```

## 4. 结论

```
BUILD_READY = true（GitHub Actions 通道完整, 昨日成功先例）
BLOCK_REASON = GitHub Actions 账户级 runner 分配故障（外部, 非代码/非服务器）
→ 需掌柜 GitHub 侧检查恢复; 恢复后 tag v1.2.0 重新 push 即自动构建发版
→ 服务器收到新 exe 后: 下载 → releases/desktop/ → latest.json → 下载中心验证（闭环已备）
```

## 5. 待掌柜动作

```
1. GitHub → Settings → Actions（或 Billing）检查: 配额/可用性/runner 状态
2. 恢复后告知 → 服务器 re-push tag v1.2.0 触发构建（或掌柜 GitHub 手动 Run workflow）
3. 或提供 Windows 机器走方案 B
```
