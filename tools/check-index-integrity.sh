#!/bin/bash
# =============================================================================
# check-index-integrity.sh — 索引完整性校验门
# =============================================================================
# 核心问题：当 function-index.json 落后于实际代码时，guard 系统进入
# "看似正确但实际错误"的状态。此脚本在每次 edit 后自动验证索引一致性。
#
# 检查项：
#   1. index 文件存在
#   2. 每个被索引的文件仍存在
#   3. 随机采样验证：索引中的行号在文件中确实有函数体
#   4. 文件总行数未发生显著缩减（文件被截断的检测）
#
# 用法: ./tools/check-index-integrity.sh [--quick | --full]
#       --quick: 只抽样 10% 的文件（默认）
#       --full:  检查所有 indexed 文件
# =============================================================================

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"
INDEX="tools/structure-index/function-index.json"

MODE="${1:-quick}"
EXIT_CODE=0

echo "=========================================="
echo "🔐 Index Integrity Gate"
echo "=========================================="
echo ""

# ── 1. index 文件存在 ──
if [ ! -f "$INDEX" ]; then
  echo "❌ [MISSING] function-index.json not found"
  echo "   Run ./tools/build-function-index.sh first"
  exit 1
fi
echo "✅ Index file exists ($(du -h "$INDEX" | cut -f1))"
echo ""

# ── 2. 加载 index ──
FUNCTIONS_DATA=$(python3 -c "
import json, sys
d = json.load(open('$INDEX'))
files = list(d.keys())
total_funcs = sum(len(v) for v in d.values())
print(f'TOTAL_FILES={len(files)}')
print(f'TOTAL_FUNCS={total_funcs}')
# 输出每个文件的函数列表 (stdout 给 bash)
for f in files:
    for fn in d[f]:
        print(f'FN|{f}|{fn[\"name\"]}|{fn[\"startLine\"]}|{fn[\"endLine\"]}')
")

TOTAL_FILES=$(echo "$FUNCTIONS_DATA" | grep "^TOTAL_FILES=" | cut -d= -f2)
TOTAL_FUNCS=$(echo "$FUNCTIONS_DATA" | grep "^TOTAL_FUNCS=" | cut -d= -f2)
echo "📊 Index stats: $TOTAL_FILES files, $TOTAL_FUNCS functions"
echo ""

# ── 3. 采样检查 ──
if [ "$MODE" = "--full" ]; then
  SAMPLE_RATIO=1.0
  echo "🔍 Full check mode: verifying all entries..."
else
  SAMPLE_RATIO=0.1
  SAMPLE_COUNT=$((TOTAL_FUNCS / 10))
  echo "🔍 Quick check mode: sampling 10% (~${SAMPLE_COUNT} functions)..."
fi

# 用 Python 完成所有验证（避免 bash 循环缓慢）
python3 -c "
import json, random, os, sys

d = json.load(open('$INDEX'))
files = list(d.keys())

# 收集所有 (file, func) 条目
entries = [(f, fn) for f in files for fn in d[f]]

# 采样
sample_ratio = $SAMPLE_RATIO
sample_size = max(1, int(len(entries) * sample_ratio))
sampled = random.sample(entries, min(sample_size, len(entries)))

missing_files = 0
truncated_files = 0
range_invalid = 0
orphan_funcs = 0
brace_mismatch = 0
total_checked = 0

# 先检查所有文件是否存在（不采样）
checked_files = set()
for f in files:
    if not os.path.exists(f):
        if f not in checked_files:
            print(f'  ❌ [DELETED] {f}')
            checked_files.add(f)
            missing_files += 1

# 检查文件的缩短（截断检测）
for f in files:
    if not os.path.exists(f):
        continue
    # 获取文件当前行数
    try:
        with open(f, 'r', errors='ignore') as fh:
            current_lines = len(fh.readlines())
    except:
        continue
    
    # 获取该文件索引中的最大 endLine
    max_end = max((fn['endLine'] for fn in d[f]), default=0)
    if max_end > current_lines:
        if f not in checked_files:
            print(f'  ⚠️  [TRUNCATED] {f} — index expects >= {max_end} lines, file has {current_lines}')
            checked_files.add(f)
            truncated_files += 1

# 采样检查条目
for f, fn in sampled:
    total_checked += 1
    if not os.path.exists(f):
        orphan_funcs += 1
        continue
    
    start = fn['startLine']
    end = fn['endLine']
    
    with open(f, 'r', errors='ignore') as fh:
        lines = fh.readlines()
    
    if start > len(lines) or end > len(lines):
        range_invalid += 1
        if total_checked <= 5:
            print(f'  ⚠️  [RANGE] {fn[\"name\"]} in {f}: range {start}-{end} exceeds file ({len(lines)} lines)')
        continue
    
    # 检查函数体 braces
    body = ''.join(lines[start-1:end])
    opens = body.count('{')
    closes = body.count('}')
    if opens != closes:
        brace_mismatch += 1
        if total_checked <= 5:
            print(f'  ⚠️  [BRACE] {fn[\"name\"]} in {f} — {opens} open / {closes} close')

print()
print(f'📋 Checked {total_checked} entries ({sample_ratio*100:.0f}% sample)')
print(f'  Deleted files:       {missing_files}')
print(f'  Truncated files:     {truncated_files}')
print(f'  Range invalid:       {range_invalid}')
print(f'  Orphan functions:    {orphan_funcs}')
print(f'  Brace mismatch:      {brace_mismatch}')

issues = missing_files + truncated_files + range_invalid + orphan_funcs
if issues > 0:
    print(f'')
    print(f'⚠️  {issues} integrity issue(s) detected — rebuild index:')
    print(f'   ./tools/build-function-index.sh')
    sys.exit(1)
else:
    print('✅ Index integrity verified')
    sys.exit(0)
" 2>&1

RESULT=$?
echo ""

if [ "$RESULT" -eq 0 ]; then
  echo "✅ Index integrity gate passed"
else
  echo ""
  echo "⚠️  Index drift detected — run: ./tools/build-function-index.sh"
  EXIT_CODE=1
fi

exit $EXIT_CODE
