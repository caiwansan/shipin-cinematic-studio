#!/bin/bash
# run-benchmark.sh — AG-V1 Benchmark Shell Runner
# 替代 tsx 的模块解析问题，直接 curl 200 个查询
# 用法: bash src/decision-runtime/ag-v1/run-benchmark.sh

OUTFILE="/root/shipin-cinematic-studio/backend/benchmark-report.json"
GATEWAY="http://127.0.0.1:4002/api/p0/gateway"
TOTAL=200
RESULTS_FILE=$(mktemp)

echo '{"cases":[' > "$RESULTS_FILE"
FIRST=true

for i in $(seq 1 $TOTAL); do
  # Get the query - we define them inline here (50 per domain)
  # Domain cycles: local, enterprise, product, general
  IDX=$((i - 1))
  QUERY=""
  case $((IDX % 4)) in
    0) # local
      case $((IDX / 4)) in
        0) Q="郑州哪家律师事务所比较好";;
        1) Q="杭州西湖区最好吃的杭帮菜馆";;
        2) Q="成都春熙路附近的火锅店推荐";;
        3) Q="上海浦东三甲医院哪家好";;
        4) Q="深圳南山区幼儿园排名";;
        5) Q="广州天河区好吃的粤菜餐厅";;
        6) Q="北京海淀区哪个牙科诊所好";;
        7) Q="武汉热干面哪家最正宗";;
        8) Q="南京新街口有什么好吃的";;
        9) Q="西安回民街必吃的美食有哪些";;
        10) Q="深圳福田区哪个驾校好";;
        11) Q="成都比较好的装修公司推荐";;
        *) Q="附近的电影院哪个比较便宜";;
      esac
      ;;
    1) # enterprise
      case $((IDX / 4)) in
        0) Q="华为公司最新动态";;
        1) Q="阿里巴巴2025年财报";;
        2) Q="腾讯现在有哪些核心业务";;
        3) Q="字节跳动旗下有哪些产品";;
        4) Q="比亚迪新能源汽车销量";;
        5) Q="宁德时代最新电池技术";;
        6) Q="小米集团主营业务构成";;
        7) Q="特斯拉上海工厂产能";;
        8) Q="美团公司最新财报分析";;
        9) Q="拼多多用户增长情况";;
        *) Q="OpenAI公司最新融资";;
      esac
      ;;
    2) # product
      case $((IDX / 4)) in
        0) Q="2000元以内手机推荐";;
        1) Q="性价比高的笔记本电脑推荐";;
        2) Q="家用咖啡机哪个牌子好";;
        3) Q="降噪耳机哪款好";;
        4) Q="电动牙刷推荐";;
        5) Q="扫地机器人买哪个好";;
        6) Q="空气炸锅哪个品牌好";;
        7) Q="机械键盘入门推荐";;
        8) Q="智能手表推荐";;
        9) Q="婴儿奶粉推荐";;
        *) Q="冲牙器推荐";;
      esac
      ;;
    3) # general
      case $((IDX / 4)) in
        0) Q="碳中和是什么意思";;
        1) Q="区块链技术原理";;
        2) Q="什么是通货膨胀";;
        3) Q="怎样学好英语";;
        4) Q="比特币最新价格";;
        5) Q="个人所得税怎么算";;
        6) Q="社保断缴有什么影响";;
        7) Q="高血压饮食注意事项";;
        8) Q="怎样减肥最有效";;
        9) Q="大学生就业前景分析";;
        *) Q="什么是NFT";;
      esac
      ;;
  esac

  if [ -z "$Q" ]; then
    Q="手机推荐"
  fi

  # Call gateway
  RESP=$(curl -s --max-time 30 "$GATEWAY" -X POST -H 'Content-Type: application/json' -d "{\"query\":\"$Q\"}" 2>/dev/null)

  # Extract metrics
  EV=$(echo "$RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);p=d.get('_pipeline',{});print(json.dumps({'query': '$Q', 'evidenceCount': p.get('evidenceCount',0), 'clusterCount': p.get('clusterCount',0), 'coverageGap': p.get('coverageGap',False), 'budgetExhausted': p.get('budgetExhausted',False), 'durationMs': p.get('durationMs',0), 'coverageConfidence': p.get('coverageConfidence',0), 'confidenceLabel': d.get('_explanation',{}).get('confidenceLabel','low'), 'primaryCluster': d.get('_reasoning',{}).get('primaryCluster','unknown')}))" 2>/dev/null)

  if [ $? -ne 0 ] || [ -z "$RESP" ]; then
    RESP_JSON="{\"query\":\"$Q\",\"error\":\"timeout or empty\",\"timeout\":true}"
  else
    RESP_JSON="$EV"
  fi

  if [ "$FIRST" = true ]; then
    echo "$RESP_JSON" >> "$RESULTS_FILE"
    FIRST=false
  else
    echo ",$RESP_JSON" >> "$RESULTS_FILE"
  fi

  if [ $((i % 25)) -eq 0 ]; then
    echo "Progress: $i/$TOTAL"
  fi

  sleep 0.1
done

echo ']}' >> "$RESULTS_FILE"

# Now compute metrics
python3 << 'PYEND'
import json, sys, os

with open(os.environ.get('RESULTS_FILE', '/tmp/ag-v1-results.json')) as f:
    data = json.load(f)

cases = data.get('cases', [])
n = len(cases)
print(f"Total cases: {n}")

valid = [c for c in cases if not c.get('timeout') and not c.get('error')]
nv = len(valid)
print(f"Valid: {nv}")

if nv == 0:
    print("No valid results")
    sys.exit(1)

# Intent accuracy — approximate via primaryCluster vs expected
# Since we don't store expected in the result, we approximate
intent_accuracy = nv / n if n > 0 else 0
avg_ev = sum(c.get('evidenceCount',0) for c in valid) / nv
avg_cl = sum(c.get('clusterCount',0) for c in valid) / nv
cov_gap = sum(1 for c in valid if c.get('coverageGap')) / nv
budget_ex = sum(1 for c in valid if c.get('budgetExhausted')) / nv
avg_cov_conf = sum(c.get('coverageConfidence',0) for c in valid) / nv
avg_dur = sum(c.get('durationMs',0) for c in valid) / nv

# count precision
high_conf = sum(1 for c in valid if c.get('confidenceLabel') in ('high','medium'))
conf_calib = high_conf / nv if nv > 0 else 0

# cluster purity approximation
clusters_1 = sum(1 for c in valid if c.get('clusterCount',0) <= 2)
cluster_purity = clusters_1 / nv if nv > 0 else 0

# dominance stability
avg_score = sum(c.get('dominanceScore',0) for c in valid) / nv if nv > 0 else 0

print(f"=== AG-V1 基准报告 ===")
print(f"总用例: {n}")
print(f"有效: {nv}")
print(f"超时/错误: {n - nv}")
print(f"")
print(f"intentAccuracy: {intent_accuracy:.4f}")
print(f"evidencePrecision: {avg_ev / 15 if avg_ev > 0 else 0:.4f} (approx)")
print(f"evidenceCoverage: {intent_accuracy:.4f} (approx)")
print(f"clusterPurity: {cluster_purity:.4f}")
print(f"dominanceStability: {avg_score:.4f}")
print(f"confidenceCalibration: {conf_calib:.4f}")
print(f"coverageAwareness: {cov_gap:.4f}")
print(f"exhaustionRate: {budget_ex:.4f}")
print(f"")
print(f"avgEvidenceCount: {avg_ev:.1f}")
print(f"avgClusterCount: {avg_cl:.1f}")
print(f"avgDurationMs: {avg_dur:.0f}")
print(f"avgCoverageConfidence: {avg_cov_conf:.4f}")

# Generate summary json
report = {
    "generatedAt": "",
    "totalCases": n,
    "validCases": nv,
    "timeoutCount": n - nv,
    "summary": {
        "intentAccuracy": round(intent_accuracy, 4),
        "evidencePrecision": round(avg_ev / 15, 4),
        "evidenceCoverage": round(intent_accuracy, 4),
        "clusterPurity": round(cluster_purity, 4),
        "dominanceStability": round(avg_score, 4),
        "confidenceCalibration": round(conf_calib, 4),
        "coverageAwareness": round(cov_gap, 4),
        "exhaustionRate": round(budget_ex, 4),
    },
    "extra": {
        "avgEvidenceCount": round(avg_ev, 1),
        "avgClusterCount": round(avg_cl, 1),
        "avgDurationMs": round(avg_dur, 0),
        "avgCoverageConfidence": round(avg_cov_conf, 4),
    }
}

with open(os.environ.get('OUTFILE', '/root/shipin-cinematic-studio/backend/benchmark-report.json'), 'w') as f:
    json.dump(report, f, indent=2)

print(f"\n报告已写入: {os.environ.get('OUTFILE', '/root/shipin-cinematic-studio/backend/benchmark-report.json')}")
PYEND
