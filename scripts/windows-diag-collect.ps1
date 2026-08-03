# ═══════════════════════════════════════════════════════════
# SPRINT-RELEASE-WINDOWS-WHITE-SCREEN-ROOT-CAUSE-01 — Task 03
# Windows 真机诊断数据采集脚本
# 用法：右键「使用 PowerShell 运行」，或：
#   powershell -ExecutionPolicy Bypass -File .\windows-diag-collect.ps1
#
# 采集内容：
#   1. WebView2 Runtime 版本（注册表）
#   2. Windows 事件日志（应用程序错误/崩溃 + WebView2 相关）
#   3. Kunlun Media 日志目录（startup/webview/api/error.log）
#   4. 系统/安装信息
# 输出：桌面 kunlun-diag-<时间戳>.zip + 同目录报告文件
# ═══════════════════════════════════════════════════════════
$ErrorActionPreference = 'Continue'
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $env:TEMP "kunlun-diag-$ts"
$report = Join-Path $outDir "REPORT.txt"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Log([string]$m) { Write-Host $m; Add-Content -Path $report -Value $m }
function Run([string]$title, [string]$cmd) {
  Log "`n===== $title ====="
  try {
    $out = Invoke-Expression $cmd 2>&1 | Out-String
    Log $out
  } catch {
    Log "执行失败: $($_.Exception.Message)"
  }
}

Log "==============================================="
Log "  Kunlun Media 白屏诊断采集  $ts"
Log "==============================================="

# ── 1. WebView2 Runtime 版本 ──
Log "`n===== [1] WebView2 Runtime 版本 ====="
$wvKeys = @(
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  'HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
$wvFound = $false
foreach ($k in $wvKeys) {
  if (Test-Path $k) {
    $wvFound = $true
    $pv = (Get-ItemProperty -Path $k -Name pv -ErrorAction SilentlyContinue).pv
    $name = (Get-ItemProperty -Path $k -Name name -ErrorAction SilentlyContinue).name
    Log "FOUND: $k"
    Log "  name = $name"
    Log "  pv   = $pv"
  }
}
if (-not $wvFound) { Log "⚠️ WebView2 Runtime 注册表键未找到（可能未安装/精简系统）" }
Run "WebView2 安装目录" "Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients' -ErrorAction SilentlyContinue | Select-Object PSChildName"

# ── 2. Windows 事件日志 ──
Log "`n===== [2] Windows 事件日志 ====="
# 应用程序错误（Event ID 1000 = 应用崩溃，1001 = WER 报告）
Run "应用程序错误 (Event ID 1000/1001, 最近30条)" "Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000,1001} -MaxEvents 30 -ErrorAction SilentlyContinue | Select-Object TimeCreated, Id, @{n='Msg';e={$_.Message.Substring(0,[Math]::Min(500,$_.Message.Length))}} | Format-List | Out-String"
# 应用日志中 Kunlun/WebView2/msedgewebview2 相关
Run "应用日志含 WebView2/Kunlun 关键字" "Get-WinEvent -LogName Application -MaxEvents 500 -ErrorAction SilentlyContinue | Where-Object { $_.Message -match 'WebView2|webview2|Kunlun|kunlun|msedgewebview2' } | Select-Object -First 20 TimeCreated, Id, ProviderName, @{n='Msg';e={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}} | Format-List | Out-String"

# ── 3. Kunlun Media 日志目录 ──
Log "`n===== [3] Kunlun Media 运行时日志 ====="
$logDir = Join-Path $env:LOCALAPPDATA 'com.kunlun.desktop\logs'
if (Test-Path $logDir) {
  Log "日志目录: $logDir"
  Get-ChildItem $logDir -Filter *.log | ForEach-Object {
    Log "  - $($_.Name) ($($_.Length) bytes, 修改于 $($_.LastWriteTime))"
  }
  Copy-Item (Join-Path $logDir '*.log') $outDir -Force -ErrorAction SilentlyContinue
} else {
  Log "⚠️ 未找到日志目录 $logDir —— 应用可能从未成功启动到可写日志阶段"
}

# ── 4. 系统/安装信息 ──
Log "`n===== [4] 系统与安装信息 ====="
Run "OS 版本" "Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture | Format-List | Out-String"
Run "已安装程序（Kunlun 相关）" "Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Kunlun|昆仑' } | Select-Object DisplayName, DisplayVersion, InstallLocation, InstallDate | Format-List | Out-String"
Run "Kunlun Media 安装目录" "Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Kunlun Media') -ErrorAction SilentlyContinue | Select-Object Name, Length | Format-Table | Out-String"
Run "Edge 浏览器版本(参考)" "Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Edge\BLBeacon' -Name version -ErrorAction SilentlyContinue | Select-Object version | Format-List | Out-String"

# ── 5. 打包 ──
Log "`n===== [5] 打包 ====="
$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) "kunlun-diag-$ts.zip"
Compress-Archive -Path $outDir -DestinationPath $zip -Force
Log "采集完成 → $zip"
Log "请将 zip 发回给开发（或打开 zip 内 REPORT.txt 贴出关键部分）"
Write-Host "`n✅ 完成: $zip"
