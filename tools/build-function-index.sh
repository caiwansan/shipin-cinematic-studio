#!/bin/bash
# =============================================================================
# build-function-index.sh — Function Range Index Generator (轻量版)
# =============================================================================
# 扫描项目的 .ts / .vue 文件，提取每个函数的起止行号，构建结构化索引。
# 输出: tools/structure-index/function-index.json
#
# 注意：这是轻量版，逐个文件用 Python 处理（比 awk 快）
# =============================================================================

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"

OUT="tools/structure-index/function-index.json"

echo "📦 Building Function Range Index..."
echo ""

# 生成 JSON — 用 Python 扫描（比 awk 快，比 bash 精确）
python3 -c '
import json, os, re, sys

result = {}

# 匹配函数声明的各种模式
func_patterns = [
    re.compile(r"function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\("),
    re.compile(r"export\s+(default\s+)?(function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)"),
    re.compile(r"const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(async\s+)?(\(|function)"),
    re.compile(r"([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(async\s+)?function\s*\("),
]

skip_dirs = {"node_modules", "dist", ".nuxt", ".output", "eslint-rules", "backups"}
skip_prefixes = ("./frontend_before_restore",)

for root, dirs, files in os.walk("."):
    # 跳过备份目录
    if any(root.startswith(p) for p in skip_prefixes):
        dirs.clear()
        continue
    # 跳过排除目录
    dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
    
    for f in files:
        if not (f.endswith(".ts") or f.endswith(".vue")):
            continue
        filepath = os.path.join(root, f)
        
        try:
            with open(filepath, "r", errors="ignore") as fh:
                lines = fh.readlines()
        except:
            continue
        
        functions = []
        depth = 0
        current_func = None
        
        for i, line in enumerate(lines):
            lineno = i + 1
            stripped = line.strip()
            
            # 检测函数声明
            if current_func is None:
                for pat in func_patterns:
                    m = pat.search(stripped)
                    if m:
                        name = m.group(1) or m.group(3) or m.group(4) or "unnamed"
                        current_func = {"name": name, "startLine": lineno, "endLine": lineno, "type": "function"}
                        break
            
            # 计算大括号深度
            opens = line.count("{")
            closes = line.count("}")
            
            if current_func is not None:
                current_func["endLine"] = lineno
                depth += opens - closes
                
                if depth == 0 and lineno > current_func["startLine"]:
                    functions.append(current_func)
                    current_func = None
            else:
                # 即使不在函数内也跟踪深度，防止被嵌套混淆
                depth += opens - closes
                if depth < 0:
                    depth = 0
        
        # 处理未闭合的函数
        if current_func is not None:
            current_func["truncated"] = True
            functions.append(current_func)
        
        if functions:
            result[filepath] = functions

print(json.dumps(result, indent=2, ensure_ascii=False))
' > "$OUT"

# 验证 JSON
if command -v jq &>/dev/null; then
  FUNC_COUNT=$(jq '[.[][] | select(.type=="function")] | length' "$OUT")
  FILE_COUNT=$(jq 'keys | length' "$OUT")
  echo "✅ JSON valid"
  echo ""
  echo "📊 Summary:"
  echo "  Files indexed:   $FILE_COUNT"
  echo "  Functions indexed: $FUNC_COUNT"
else
  FILE_COUNT=$(python3 -c "import json; d=json.load(open('$OUT')); print(len(d))")
  FUNC_COUNT=$(python3 -c "import json; d=json.load(open('$OUT')); print(sum(len(v) for v in d.values()))")
  echo "✅ Index built"
  echo ""
  echo "📊 Summary:"
  echo "  Files indexed:   $FILE_COUNT"
  echo "  Functions indexed: $FUNC_COUNT"
fi

echo ""
echo "📁 Output: $OUT"
echo "✅ Function Range Index built"
