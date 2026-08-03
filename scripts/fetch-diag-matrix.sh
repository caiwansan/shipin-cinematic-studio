#!/bin/bash
# RCA-01 Task04 部署脚本：拉取诊断矩阵 A/B/C 三件套 → releases/desktop/diagnostic/
# 用法: bash /root/shipin-cinematic-studio/scripts/fetch-diag-matrix.sh diag-1.1.0
#
# 注意：诊断版不进用户下载页（/download/desktop 不引用），仅掌柜真机测试用。
# 用户链路仍 = 官网下载页 → releases/desktop/windows/KunlunMedia-<ver>-setup.exe
set -euo pipefail

TAG="${1:-diag-1.1.0}"
REPO="caiwansan/shipin-cinematic-studio"
BASE="/www/wwwroot/aigc.fushtn.com/releases/desktop/diagnostic"
mkdir -p "$BASE"

echo "==> 查询诊断矩阵 Release: $TAG"
ASSETS=$(curl -s "https://api.github.com/repos/$REPO/releases/tags/$TAG")

echo "$ASSETS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('assets:', [a['name'] for a in d.get('assets',[])])
" 2>/dev/null || true

# 每个 exe 资产按原名落盘（KunlunMediaDiagA/B/C-1.1.0-setup.exe）
echo "$ASSETS" | python3 -c "
import json,sys,subprocess,os
d=json.load(sys.stdin)
base='$BASE'
for a in d.get('assets',[]):
    if not a['name'].endswith('.exe'):
        continue
    name=a['name']
    target=os.path.join(base,name)
    if os.path.isfile(target) and os.path.getsize(target)>0:
        print(f'==> 已存在，跳过: {name}')
        continue
    print(f'==> 下载: {name}')
    subprocess.run(['curl','-sL','-o',target,a['browser_download_url']],check=True)
    print(f'==> 落盘: {target}')
"

echo "==> 目录内容:"
ls -la "$BASE"
echo "==> 校验和:"
sha256sum "$BASE"/*.exe 2>/dev/null || echo "(无 exe)"

cat > "$BASE/README.txt" << EOF
昆仑镜 Kunlun Media 白屏 RCA 诊断矩阵（SPRINT-RELEASE-WINDOWS-WHITE-SCREEN-ROOT-CAUSE-01）

三个版本（同一 Tauri 壳，不同前端）：
  A = KunlunMediaDiagA-*-setup.exe   纯 HTML hello world    失败 => Tauri/WebView2/资源/CSP 层
  B = KunlunMediaDiagB-*-setup.exe   Vue 3 静态页(按钮+路由) 失败 => 前端框架层
  C = KunlunMediaDiagC-*-setup.exe   完整 Kunlun Media     失败 => 业务初始化层

诊断流程：
  1. 先装 A → 启动：看到 Hello World + JS 执行 OK = 壳层正常
  2. 装 B → 启动：Vue 渲染 + 按钮交互 + 路由切换 = 前端框架正常
  3. 装 C → 启动：正常界面；若白屏，用命令行启动收集日志：
     "C:\Program Files\Kunlun Media\KunlunMedia.exe" --debug
     （或诊断版 C 快捷方式目标后加 --debug / --diag）
  4. 日志目录: %LOCALAPPDATA%\com.kunlun.desktop\logs\（startup/webview/api/error.log）
  5. 运行采集脚本 scripts/windows-diag-collect.ps1 打包发回

判定矩阵：
  A失败            => Tauri/WebView2/资源嵌入/CSP 问题
  A成功 B失败      => Vue/前端框架层问题
  B成功 C失败      => 业务初始化（登录/API/License/Device/Plugin）问题
EOF

echo "==> README 已写入 $BASE/README.txt"
