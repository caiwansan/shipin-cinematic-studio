#!/bin/bash
# Runtime Stability Tests
# 测试：Replay Determinism, Failure Recovery, Scheduler Stability

BASE="http://localhost:4000"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo -e "  ${GREEN}✅ PASS${NC} $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}❌ FAIL${NC} $1"; }

echo "============================================"
echo "  Execution Graph Runtime Stability Tests"
echo "============================================"
echo ""

# ─── Test 1: Basic Graph Creation + Completion ───
echo "--- Test 1: Basic Graph Creation ---"
RESULT=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"test script with one character"}')
GRAPH_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 5
STATUS=$(curl -s "$BASE/api/v1/execution-graph/$GRAPH_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
if [ "$STATUS" = "completed" ]; then
  pass "Graph $GRAPH_ID completed"
else
  fail "Graph $GRAPH_ID status=$STATUS (expected completed)"
fi

# ─── Test 2: Replay Determinism ───
echo ""
echo "--- Test 2: Replay Determinism ---"
# Record original output
ORIG_CHAR=$(curl -s "$BASE/api/v1/execution-graph/$GRAPH_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
n=d['nodes'][0]
if n['output'] and n['output'].get('data'):
    chars = n['output']['data'].get('characters',[])
    if chars:
        print(chars[0].get('name',''))
        print(chars[0].get('role',''))
" 2>/dev/null)
ORIG_NAME=$(echo "$ORIG_CHAR" | sed -n '1p')
ORIG_ROLE=$(echo "$ORIG_CHAR" | sed -n '2p')

# Replay
curl -s -X POST "$BASE/api/v1/execution-graph/$GRAPH_ID/replay" > /dev/null 2>&1
sleep 5
NEW_CHAR=$(curl -s "$BASE/api/v1/execution-graph/$GRAPH_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
n=d['nodes'][0]
if n['output'] and n['output'].get('data'):
    chars = n['output']['data'].get('characters',[])
    if chars:
        print(chars[0].get('name',''))
        print(chars[0].get('role',''))
" 2>/dev/null)
NEW_NAME=$(echo "$NEW_CHAR" | sed -n '1p')
NEW_ROLE=$(echo "$NEW_CHAR" | sed -n '2p')

if [ "$ORIG_NAME" = "$NEW_NAME" ] && [ "$ORIG_ROLE" = "$NEW_ROLE" ]; then
  pass "Replay deterministic (character=$ORIG_NAME, role=$ORIG_ROLE)"
else
  fail "Replay changed: was ($ORIG_NAME/$ORIG_ROLE) now ($NEW_NAME/$NEW_ROLE)"
fi

# ─── Test 3: DAG Dependencies ───
echo ""
echo "--- Test 3: DAG Dependency Chain ---"
# Create new graph, append portrait_prompt+image
RESULT=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":"哪吒"}')
G2_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['graphId'])" 2>/dev/null)
sleep 5

# Get char node id
CHAR_NODE_ID=$(curl -s "$BASE/api/v1/execution-graph/$G2_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
for n in d['nodes']:
    if n['nodeType']=='character': print(n['id']); break
" 2>/dev/null)

# Append portrait_prompt with correct dependency
APPEND_INPUT=$(curl -s "$BASE/api/v1/execution-graph/$G2_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
n=d['nodes'][0]
char = n['output']['data']['characters'][0]
script = d['input']['script']
print(json.dumps({'character': char, 'script': script}))
" 2>/dev/null)

APPEND_RESULT=$(curl -s -X POST "$BASE/api/v1/execution-graph/$G2_ID/nodes" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeType\":\"portrait_prompt\",\"agentId\":\"agent_portrait_prompt\",\"label\":\"prompt\",\"dependencies\":[\"$CHAR_NODE_ID\"],\"input\":$APPEND_INPUT}" 2>/dev/null)

NODE_ID=$(echo "$APPEND_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
sleep 8

# Verify dependency was respected — portrait_prompt should have completed
PROMPT_STATUS=$(curl -s "$BASE/api/v1/execution-graph/$G2_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
for n in d['nodes']:
    if n['nodeType']=='portrait_prompt': print(n['status']); break
" 2>/dev/null)

if [ "$PROMPT_STATUS" = "completed" ]; then
  pass "DAG dependency: portrait_prompt dependsOn(character) → completed"
else
  fail "DAG dependency: portrait_prompt=$PROMPT_STATUS (expected completed)"
fi

# ─── Test 4: Graph Replay with appended nodes ───
echo ""
echo "--- Test 4: Replay with DAG ---"
curl -s -X POST "$BASE/api/v1/execution-graph/$G2_ID/replay" > /dev/null 2>&1
sleep 8
FINAL=$(curl -s "$BASE/api/v1/execution-graph/$G2_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
s=d['status']
nodes_str=':'.join([n['nodeType']+':'+n['status'] for n in d['nodes']])
print(f'{s}|{nodes_str}')
" 2>/dev/null)

if echo "$FINAL" | grep -q "completed" && echo "$FINAL" | grep -q "portrait_prompt:completed"; then
  pass "Replay with DAG: $FINAL"
else
  fail "Replay with DAG failed: $FINAL"
fi

# ─── Test 5: SSE Event Stream ───
echo ""
echo "--- Test 5: SSE Event Stream ---"
# Quick connect to SSE for existing graph
SSE_OUTPUT=$(timeout 5 curl -s -N "$BASE/api/v1/execution-graph/$G2_ID/events" 2>/dev/null | head -5 | tr '\n' '|')
if echo "$SSE_OUTPUT" | grep -q "event: connected"; then
  pass "SSE connected for graph $G2_ID"
else
  fail "SSE connection failed"
fi

# ─── Test 6: Error Handling and Retry ───
echo ""
echo "--- Test 6: Error Handling ---"
# Create a graph with missing input
RESULT=$(curl -s -X POST "$BASE/api/v1/execution-graph/script-analysis" \
  -H 'Content-Type: application/json' \
  -d '{"script":""}' 2>/dev/null)
echo "empty script result: $RESULT" | head -1

# ─── Summary ───
echo ""
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"

exit $FAIL
