#!/bin/bash
# Runtime Stress Test Suite — Alpha Phase
# 自动执行多类输入测试，检测 runtime failure mode
# 输出：runtime-bug-map.json

BASE="http://localhost:4000"
TIMEOUT=30
RESULTS_DIR="/root/shipin-cinematic-studio/backend/scripts/stress-results"
mkdir -p "$RESULTS_DIR"

echo "Runtime Stress Test — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"

report() {
  local test_name="$1"
  local passed="$2"
  local detail="$3"
  echo "[$([ "$passed" == "true" ] && echo 'PASS' || echo 'FAIL')] $test_name → $detail"
  echo "{\"test\":\"$test_name\",\"passed\":$passed,\"detail\":\"$detail\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$RESULTS_DIR/results.ndjson"
}

# ─── Baseline: Normal Input ───
echo ""
echo "🧪 Baseline — Normal Input"
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"一个叫林风的少年剑客，二十岁，一袭白衣，背着一把青色长剑，独自行走在苍茫雪原上。"}')
G=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 6
S=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['status']); print(len(d['nodes']))" 2>/dev/null)
ST=$(echo "$S" | sed -n '1p')
NN=$(echo "$S" | sed -n '2p')
[ "$ST" = "completed" ] && [ "$NN" -ge 1 ] && report "baseline_normal" true "graph=$G status=$ST nodes=$NN" || report "baseline_normal" false "graph=$G status=$ST nodes=$NN"

BASELINE_GRAPH=$G

# ─── Empty Script ───
echo ""
echo "🧪 Edge — Empty Script"
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":""}')
[ -z "$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('graphId',''))" 2>/dev/null)" ] \
  && report "edge_empty_script" true "rejected empty script" \
  || report "edge_empty_script" false "graph created for empty input"

# ─── Single Word ───
echo ""
echo "🧪 Edge — Single Word"
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"哪吒"}')
G=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 6
S=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['status'] + '|' + str(len(d['nodes'])))" 2>/dev/null)
echo "$S" | grep -q "completed" && report "edge_single_word" true "graph=$G status=$S" || report "edge_single_word" false "graph=$G status=$S"

# ─── No Characters ───
echo ""
echo "🧪 Edge — No Characters in Script"
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"雪在下，风在吹，天地间一片苍茫。没有什么人，只有雪。"}')
G=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 6
S=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(d['status'] + '|' + str(len(d['nodes'])))
for n in d['nodes']:
    if n['output'] and n['output'].get('data'):
        chars = n['output']['data'].get('characters',[])
        print('chars:' + str(len(chars)))
" 2>/dev/null)
echo "$S" | grep -q "completed" && report "edge_no_characters" true "graph=$G status=$(echo "$S" | head -1)" || report "edge_no_characters" false "graph=$G"

# ─── Mixed Chinese/English ───
echo ""
echo "🧪 Edge — Mixed Language"
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"Dr. Wang is a 35-year-old scientist. 他在实验室里研究 quantum mechanics. His assistant 小陈 is 22."}')
G=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 6
S=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(d['status']+'|'+str(len(d['nodes'])))
for n in d['nodes']:
    if n['output'] and n['output'].get('data'):
        chars=n['output']['data'].get('characters',[])
        for c in chars: print(c.get('name','?'))
" 2>/dev/null)
echo "$S" | grep -q "completed" && report "edge_mixed_lang" true "graph=$G done" || report "edge_mixed_lang" false "graph=$G failed"

# ─── Long Script ───
echo ""
echo "🧪 Stress — Long Script (5k chars)"
LONG_SCRIPT=$(python3 -c "
import random,string
chars = '人物场景'
names = ['林风','雨辰','小月','云中鹤','铁心']
sys = ['天玄大陆','风灵国']
for i in range(200):
    n=random.choice(names)
    s=random.choice(sys)
    print(f'{n}在{s}中独行。',end='')
")
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d "{\"script\":\"$LONG_SCRIPT\"}")
G=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 8
S=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(d['status']); print(len(d['nodes']))
for n in d['nodes']:
    if n['output'] and n['output'].get('data'):
        chars=n['output']['data'].get('characters',[])
        print('chars:'+str(len(chars)))
" 2>/dev/null)
ST=$(echo "$S" | sed -n '1p')
[ "$ST" = "completed" ] && report "stress_long_script" true "graph=$G done nodes=$(echo "$S" | sed -n '2p')" || report "stress_long_script" false "graph=$G status=$ST"

# ─── Rapid AppendNode (DAG extension stress) ───
echo ""
echo "🧪 Stress — Rapid AppendNode"
# Use baseline graph, append multiple portrait_prompt nodes in rapid succession
R=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"测试多节点追加。角色A和角色B。"}')
G=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 6
CHAR_NODE_ID=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
for n in d['nodes']:
    if n['nodeType']=='character': print(n['id']); break
" 2>/dev/null)
# Try to append two nodes simultaneously
for i in 1 2 3; do
  curl -s -X POST "$BASE/api/v1/execution-graph/$G/nodes" \
    -H 'Content-Type: application/json' \
    -d "{\"nodeType\":\"portrait_prompt\",\"agentId\":\"agent_portrait_prompt\",\"label\":\"prompt_$i\",\"dependencies\":[\"$CHAR_NODE_ID\"],\"input\":{\"test\":true}}" \
    -o /dev/null -w "%{http_code}" &
done
wait
sleep 8
S=$(curl -s "$BASE/api/v1/execution-graph/$G" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(d['status'])
for n in d['nodes']:
    if n['nodeType']=='portrait_prompt':
        pass
pending=\$(echo \"\$d\" | python3 -c \"import sys,json; d=json.load(sys.stdin); ns=[n for n in d['data']['nodes'] if n['nodeType']=='portrait_prompt']; print(sum(1 for n in ns if n['status']=='completed'),'/',len(ns))\")
echo \"portrait_prompts: \$pending\"
")
[ "$ST" = "completed" ] && report "stress_rapid_append" true "graph=$G completed" || report "stress_rapid_append" false "graph=$G status=$ST"

# ─── Replay Stability ───
echo ""
echo "🧪 Stability — Replay ×3"
for i in 1 2 3; do
  curl -s -X POST "$BASE/api/v1/execution-graph/$BASELINE_GRAPH/replay" > /dev/null
  sleep 5
done
S=$(curl -s "$BASE/api/v1/execution-graph/$BASELINE_GRAPH" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(d['status'] + '|' + str(len(d['nodes'])))
for n in d['nodes']:
    print(f\"{n['nodeType']}:{n['status']}\")
" 2>/dev/null)
echo "$S" | grep -q "completed" && report "stability_replay_x3" true "replay stable" || report "stability_replay_x3" false "replay broke: $S"

# ─── Generate Runtime Bug Map ───
echo ""
echo "========================================"
echo "📊 Generating Runtime Bug Map..."
echo "========================================"

python3 -c "
import json, os
results = []
ndjson_path = '$RESULTS_DIR/results.ndjson'
if os.path.exists(ndjson_path):
    with open(ndjson_path) as f:
        for line in f:
            line = line.strip()
            if line:
                results.append(json.loads(line))

tests = ['baseline_normal','edge_empty_script','edge_single_word','edge_no_characters','edge_mixed_lang','stress_long_script','stress_rapid_append','stability_replay_x3']
bug_map = {
    'timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'summary': {
        'total': len(results),
        'passed': sum(1 for r in results if r['passed']),
        'failed': sum(1 for r in results if not r['passed']),
    },
    'failure_map': {},
    'categories': {
        'baseline': {'tests': ['baseline_normal'], 'passed': 0, 'total': 0},
        'edge_cases': {'tests': ['edge_empty_script','edge_single_word','edge_no_characters','edge_mixed_lang'], 'passed': 0, 'total': 0},
        'stress': {'tests': ['stress_long_script','stress_rapid_append'], 'passed': 0, 'total': 0},
        'stability': {'tests': ['stability_replay_x3'], 'passed': 0, 'total': 0},
    }
}

for r in results:
    t = r['test']
    for cat, info in bug_map['categories'].items():
        if t in info['tests']:
            info['total'] += 1
            if r['passed']: info['passed'] += 1

    if not r['passed']:
        bug_map['failure_map'][t] = r['detail']

all_passed = bug_map['summary']['failed'] == 0
bug_map['verdict'] = '✅ ALL PASSED — No known failure mode' if all_passed else '⚠️ FAILURES DETECTED — See failure_map'

with open('$RESULTS_DIR/runtime-bug-map.json', 'w') as f:
    json.dump(bug_map, f, indent=2, ensure_ascii=False)

print(json.dumps(bug_map, indent=2, ensure_ascii=False))
"
