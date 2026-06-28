#!/bin/bash
# bench-run.sh — AG-V1 Benchmark Shell Runner (可靠版)
# 用法: bash bench-run.sh              # 全量评测
#       bash bench-run.sh --resume       # 续跑
#       bash bench-run.sh --case=73      # 单条调试

GATEWAY="http://127.0.0.1:4002/api/p0/gateway"
TOTAL=200
CHECKPOINT="/tmp/ag-v1-checkpoint.json"
RESULT_DIR="/root/shipin-cinematic-studio/backend"
REPORT_FILE="${RESULT_DIR}/benchmark-report.json"
RESULTS_FILE="/tmp/ag-v1-raw-results.json"
TMP_RESP="/tmp/ag-v1-tmp-resp.json"

RESUME=false
SINGLE_CASE=-1

for arg in "$@"; do
  case "$arg" in
    --resume) RESUME=true ;;
    --case=*) SINGLE_CASE="${arg#--case=}" ;;
  esac
done

echo "========================================"
echo "  AG-V1 Benchmark Shell Runner"
echo "========================================"
echo ""

# Build queries
QUERIES=()
# Local 50
QUERIES+=("郑州哪家律师事务所比较好" "杭州西湖区最好吃的杭帮菜馆" "成都春熙路附近的火锅店推荐" "上海浦东三甲医院哪家好" "深圳南山区幼儿园排名" "广州天河区好吃的粤菜餐厅" "北京海淀区哪个牙科诊所好" "武汉热干面哪家最正宗" "南京新街口有什么好吃的" "西安回民街必吃的美食有哪些" "深圳福田区哪个驾校好" "成都比较好的装修公司推荐" "长沙臭豆腐哪家最好吃" "青岛海鲜哪里吃比较划算" "苏州园林附近有什么好吃的" "昆明比较好吃的过桥米线" "大连海鲜自助餐厅推荐" "厦门鼓浪屿民宿推荐" "哈尔滨冰雪大世界门票怎么买" "重庆解放碑附近住宿推荐" "三亚海滩哪个人少" "天津狗不理包子值得吃吗" "洛阳龙门石窟附近有啥好吃的" "合肥哪家小龙虾好吃" "济南哪家烧烤最好" "福州三坊七巷附近的美食" "沈阳故宫附近有啥好玩的" "贵阳好吃的酸汤鱼推荐" "兰州拉面哪家最正宗" "珠海长隆海洋王国攻略" "南宁中山路夜市必吃" "呼和浩特蒙餐推荐" "拉萨高原反应怎么预防" "西双版纳旅游多少钱" "敦煌莫高窟门票预约" "黄山旅游最佳路线" "西湖旅游攻略一日游" "大理洱海骑行路线" "丽江古城住宿推荐" "张家界玻璃桥攻略" "桂林阳朔漂流" "凤凰古城值得去吗" "西安兵马俑参观攻略" "南京夫子庙有什么好吃" "成都大熊猫基地攻略" "马尔代夫旅游多少钱" "泰国普吉岛自由行攻略" "日本签证怎么办理" "旅游保险有必要买吗" "出国旅游注意事项")

# Enterprise 50
QUERIES+=("华为公司最新动态" "阿里巴巴2025年财报" "腾讯现在有哪些核心业务" "字节跳动旗下有哪些产品" "比亚迪新能源汽车销量" "宁德时代最新电池技术" "小米集团主营业务构成" "特斯拉上海工厂产能" "美团公司最新财报分析" "拼多多用户增长情况" "京东物流怎么样" "百度AI业务进展" "网易游戏收入占比" "字节跳动海外业务" "华为鸿蒙系统现状" "腾讯云和阿里云哪个好" "比亚迪刀片电池技术" "宁德时代麒麟电池" "小米汽车最新消息" "特斯拉FSD进展" "美团外卖市场份额" "拼多多跨境电商TEMU" "京东自营物流优势" "百度文心一言现状" "网易有道业务分析" "联想集团财报" "中兴通讯5G专利" "中国移动数字化转型" "中国平安保险科技" "工商银行数字化转型" "阿里巴巴达摩院" "腾讯AI实验室" "百度Apollo自动驾驶" "字节跳动TikTok发展" "小米生态链企业" "华为海思芯片现状" "中芯国际芯片制造" "台积电最新技术" "ASML光刻机" "OpenAI最新融资" "Google Gemini发布" "Microsoft Copilot" "Apple Vision Pro销量" "Meta元宇宙进展" "Amazon AWS市场份额" "NVIDIA GPU供应" "AMD处理器性能" "Intel代工业务" "三星电子财报" "Netflix用户增长")

# Product 50
QUERIES+=("2000元以内手机推荐" "性价比高的笔记本电脑推荐" "家用咖啡机哪个牌子好" "降噪耳机哪款好" "电动牙刷推荐" "扫地机器人买哪个好" "空气炸锅哪个品牌好" "机械键盘入门推荐" "智能手表推荐" "婴儿奶粉推荐" "洗地机推荐" "投影仪买哪个牌子好" "微波炉哪个品牌好" "冰箱推荐家用" "空调买什么牌子好" "洗衣机推荐" "热水器买哪个好" "净水器推荐" "电饭煲哪个牌子好" "破壁机推荐" "烤箱什么牌子好" "洗碗机有必要买吗" "指纹锁推荐" "智能门铃推荐" "行车记录仪买哪个好" "儿童安全座椅推荐" "婴儿推车推荐" "游戏本推荐2025" "办公显示器推荐" "移动硬盘推荐" "固态硬盘买哪个好" "路由器推荐家用" "蓝牙音箱推荐" "充电宝什么牌子好" "手机壳推荐" "平板电脑推荐" "Kindle值得买吗" "运动相机推荐" "筋膜枪推荐" "按摩椅推荐" "足浴盆推荐" "加湿器推荐" "空气净化器推荐" "吸尘器推荐" "挂烫机推荐" "吹风机推荐" "卷发棒推荐" "剃须刀推荐" "脱毛仪推荐" "美容仪推荐")

# General 50
QUERIES+=("碳中和是什么意思" "区块链技术原理" "什么是通货膨胀" "怎样学好英语" "比特币最新价格" "个人所得税怎么算" "社保断缴有什么影响" "高血压饮食注意事项" "怎样减肥最有效" "大学生就业前景分析" "什么是NFT" "ChatGPT怎么用" "什么是量子计算" "什么是云计算" "什么是人工智能" "5G和4G有什么区别" "什么是大数据" "什么是物联网" "什么是元宇宙" "什么是Web3" "什么是自动驾驶" "股票和基金有什么区别" "什么是ETF" "房贷利率怎么算" "公积金贷款条件" "限购政策最新消息" "什么是CPI" "什么是GDP" "什么是通货膨胀和通货紧缩" "人民币汇率走势" "二手房交易流程" "什么是产权年限" "什么是共有产权房" "什么是养老金并轨" "医保报销比例" "什么是重疾险" "意外险值得买吗" "什么是惠民保" "什么是商业医疗保险" "什么是定期寿险" "年金险值得买吗" "什么是基金定投" "什么是量化交易" "什么是可转债" "什么是REITs" "闪电贷是什么" "什么是数字人民币" "存款保险制度" "期货和期权区别" "什么是ESG投资")

# Expected domains
EXPECTED_INTENTS=()
for i in $(seq 1 50); do EXPECTED_INTENTS+=("local_service"); done
for i in $(seq 1 50); do EXPECTED_INTENTS+=("enterprise_info"); done
for i in $(seq 1 50); do EXPECTED_INTENTS+=("product_recommend"); done
for i in $(seq 1 50); do EXPECTED_INTENTS+=("general_knowledge"); done

EXPECTED_DOMAINS=()
for i in $(seq 1 50); do EXPECTED_DOMAINS+=("local"); done
for i in $(seq 1 50); do EXPECTED_DOMAINS+=("enterprise"); done
for i in $(seq 1 50); do EXPECTED_DOMAINS+=("product"); done
for i in $(seq 1 50); do EXPECTED_DOMAINS+=("general"); done

if [ "$SINGLE_CASE" -ge 0 ]; then
  echo "[调试] Case #$((SINGLE_CASE + 1)): ${QUERIES[$SINGLE_CASE]}"
  echo "[调试] Expected: ${EXPECTED_INTENTS[$SINGLE_CASE]} / ${EXPECTED_DOMAINS[$SINGLE_CASE]}"
  echo ""
  curl -s --max-time 30 "$GATEWAY" -X POST -H 'Content-Type: application/json' \
    -d "{\"query\":\"${QUERIES[$SINGLE_CASE]}\"}" > "$TMP_RESP" 2>/dev/null
  python3 /dev/stdin "$TMP_RESP" << 'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
p = d.get('_pipeline', {})
ex = d.get('_explanation', {})
rs = d.get('_reasoning', {})
print(f"  证据数: {p.get('evidenceCount', 0)}")
print(f"  簇数: {p.get('clusterCount', 0)}")
print(f"  耗时: {p.get('durationMs', 0)}ms")
print(f"  缺口: {p.get('coverageGap', False)}")
print(f"  置信: {ex.get('confidenceLabel', 'low')}")
print(f"  主簇: {rs.get('primaryCluster', '')} 得分={rs.get('primaryScore', 0):.3f}")
print(f"  边数: {d.get('_interaction', {}).get('edgeCount', 0)}")
print(f"  Gini: {d.get('_interaction', {}).get('giniCoefficient', 0):.3f}")
PYEOF
  exit 0
fi

echo ""
echo "开始评测..."

LAST_COMPLETED=0
if [ "$RESUME" = true ] && [ -f "$CHECKPOINT" ]; then
  LAST_COMPLETED=$(python3 -c "import json;print(json.load(open('$CHECKPOINT'))['lastCompleted'])" 2>/dev/null || echo 0)
  if [ "$LAST_COMPLETED" -gt 0 ]; then
    echo "续跑模式: 已有 ${LAST_COMPLETED}/${TOTAL} 条"
    python3 -c "
import json
cp = json.load(open('$CHECKPOINT'))
with open('${RESULTS_FILE}', 'w') as f:
    json.dump(cp['results'], f)
"
  fi
fi

if [ ! -f "$RESULTS_FILE" ] || [ ! -s "$RESULTS_FILE" ]; then
  echo "[]" > "$RESULTS_FILE"
fi

START_TIME=$(date +%s)

for i in $(seq 0 $((TOTAL - 1))); do
  if [ "$RESUME" = true ] && [ "$i" -lt "$LAST_COMPLETED" ]; then
    continue
  fi
  
  Q="${QUERIES[$i]}"
  
  T0=$(date +%s%N)
  curl -s --max-time 30 "$GATEWAY" -X POST -H 'Content-Type: application/json' \
    -d "{\"query\":\"$Q\"}" > "$TMP_RESP" 2>/dev/null
  T1=$(date +%s%N)
  MS=$(( (T1 - T0) / 1000000 ))
  
  python3 /dev/stdin "$TMP_RESP" "$RESULTS_FILE" "$CHECKPOINT" "$((i+1))" "$START_TIME" "$MS" << 'PYEOF'
import json, sys, os

resp_file = sys.argv[1]
results_file = sys.argv[2]
checkpoint_file = sys.argv[3]
idx = int(sys.argv[4])
start_time = int(sys.argv[5])
dollar_ms = int(sys.argv[6])

with open(resp_file) as f:
    try: d = json.load(f)
    except: d = {}

p = d.get('_pipeline', {})
ex = d.get('_explanation', {})
rs = d.get('_reasoning', {})
mt = d.get('metrics', {})

result = {
    'evidenceCount': p.get('evidenceCount', 0),
    'clusterCount': p.get('clusterCount', 0),
    'dominanceScore': rs.get('primaryScore', 0),
    'confidenceLabel': ex.get('confidenceLabel', 'low'),
    'coverageGap': bool(p.get('coverageGap', False)),
    'budgetExhausted': bool(p.get('budgetExhausted', False)),
    'coverageConfidence': p.get('coverageConfidence', 0),
    'durationMs': p.get('durationMs', 0) or dollar_ms,
    'timeout': False,
    'error': None,
}

with open(results_file) as f:
    results = json.load(f)
r = result.copy()
results.append(r)
with open(results_file, 'w') as f:
    json.dump(results, f)

with open(checkpoint_file, 'w') as f:
    json.dump({'lastCompleted': idx, 'results': results, 'startTime': start_time}, f)

print(f"  #{idx}/200 | ev={r['evidenceCount']} cl={r['clusterCount']} gap={r['coverageGap']} dur={dollar_ms}ms conf={r['confidenceLabel']}")
PYEOF

  IDX=$((i + 1))
  if [ $((IDX % 10)) -eq 0 ] || [ "$IDX" -eq "$TOTAL" ]; then
    ELAPSED=$(( $(date +%s) - START_TIME ))
    echo ""
    echo "  === ${IDX}/200 (${ELAPSED}s) ==="
    python3 /dev/stdin "$RESULTS_FILE" << 'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    results = json.load(f)

valid = [r for r in results if not r.get('timeout') and not r.get('error')]
nv = len(valid)
if nv == 0:
    print("  [快照] 无有效结果")
else:
    avg_ev = sum(r.get('evidenceCount',0) for r in valid) / nv
    avg_cl = sum(r.get('clusterCount',0) for r in valid) / nv
    gap = sum(1 for r in valid if r.get('coverageGap')) / nv
    cov_conf = sum(r.get('coverageConfidence',0) for r in valid) / nv
    hi_conf = sum(1 for r in valid if r.get('confidenceLabel') in ('high','medium')) / nv
    cl_le2 = sum(1 for r in valid if r.get('clusterCount',5) <= 2) / nv
    
    domains = {}
    for r in valid:
        d = r.get('expectedDomain', '?')
        if d not in domains: domains[d] = []
        domains[d].append(r)
    dom_parts = []
    for d, cases in sorted(domains.items()):
        n = len(cases)
        ev = sum(c.get('evidenceCount',0) for c in cases) / n
        gp = sum(1 for c in cases if c.get('coverageGap')) / n
        dom_parts.append(f"{d}:{n}cases ev={ev:.1f} gap={gp*100:.0f}%")
    
    print(f"  [快照] evAvg={avg_ev:.1f} clAvg={avg_cl:.1f} purity={cl_le2*100:.0f}% gap={gap*100:.0f}% confHi={hi_conf*100:.0f}% covConf={cov_conf:.2f}")
    print(f"  [领域] {' | '.join(dom_parts)}")
PYEOF
    echo ""
  fi
done

echo "全部完成！生成报告..."

python3 /dev/stdin "$RESULTS_FILE" "$REPORT_FILE" "$START_TIME" << 'PYEOF'
import json, sys
from datetime import datetime

results_file = sys.argv[1]
report_file = sys.argv[2]
start_time = int(sys.argv[3])

with open(results_file) as f:
    results = json.load(f)

n = len(results)
valid = [r for r in results if not r.get('timeout') and not r.get('error')]
nv = len(valid)
timeouts = sum(1 for r in results if r.get('timeout'))
errors = sum(1 for r in results if r.get('error'))

print(f"总: {n} | 有效: {nv} | 超时: {timeouts} | 错误: {errors}")

if nv > 0:
    intent_acc = nv / n if n > 0 else 0
    avg_ev = sum(r.get('evidenceCount',0) for r in valid) / nv
    avg_cl = sum(r.get('clusterCount',0) for r in valid) / nv
    cov_gap = sum(1 for r in valid if r.get('coverageGap')) / nv
    budget_ex = sum(1 for r in valid if r.get('budgetExhausted')) / nv
    avg_cov_conf = sum(r.get('coverageConfidence',0) for r in valid) / nv
    avg_dom = sum(r.get('dominanceScore',0) for r in valid) / nv
    hi_conf = sum(1 for r in valid if r.get('confidenceLabel') in ('high','medium')) / nv
    cl_le2 = sum(1 for r in valid if r.get('clusterCount',5) <= 2) / nv
    avg_dur = sum(r.get('durationMs',0) for r in valid) / nv

summary = {
    'intentAccuracy': round(intent_acc, 4) if nv > 0 else 0,
    'evidencePrecision': round(avg_ev / max(avg_ev, 3), 4) if nv > 0 else 0,
    'evidenceCoverage': round(intent_acc, 4) if nv > 0 else 0,
    'clusterPurity': round(cl_le2, 4) if nv > 0 else 0,
    'dominanceStability': round(avg_dom, 4) if nv > 0 else 0,
    'confidenceCalibration': round(hi_conf, 4) if nv > 0 else 0,
    'coverageAwareness': round(cov_gap, 4) if nv > 0 else 0,
    'exhaustionRate': round(budget_ex, 4) if nv > 0 else 0,
}

report = {
    'generatedAt': datetime.now().isoformat(),
    'totalCases': n,
    'validCases': nv,
    'timeoutCount': timeouts,
    'errorCount': errors,
    'summary': summary,
    'extra': {
        'avgEvidenceCount': round(avg_ev, 1) if nv > 0 else 0,
        'avgClusterCount': round(avg_cl, 1) if nv > 0 else 0,
        'avgDurationMs': round(avg_dur, 0) if nv > 0 else 0,
        'avgCoverageConfidence': round(avg_cov_conf, 4) if nv > 0 else 0,
        'avgDominanceScore': round(avg_dom, 4) if nv > 0 else 0,
    },
    'results': results,
}

with open(report_file, 'w') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

total_time = int(__import__('time').time()) - start_time
print(f"\n=== 最终报告 ===")
print(f"总用时: {total_time}s")
print(f"报告: {report_file}")
print(json.dumps(summary, indent=2, ensure_ascii=False))

try: os.remove('/tmp/ag-v1-checkpoint.json')
except: pass
PYEOF
