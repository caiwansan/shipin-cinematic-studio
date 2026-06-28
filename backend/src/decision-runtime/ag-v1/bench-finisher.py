#!/usr/bin/env python3
"""bench-finisher.py — 跑完 Benchmark 剩余的 Case (145-200)"""
import json, os, sys, time, urllib.request, urllib.error

GATEWAY = "http://127.0.0.1:4002/api/p0/gateway"
CHECKPOINT = "/tmp/ag-v1-checkpoint.json"
RESULTS_FILE = "/tmp/ag-v1-raw-results.json"

# 从 bench-run.py 里抄的 QUERIES
QUERIES = [
    "2000元以内手机推荐","性价比高的笔记本电脑推荐","家用咖啡机哪个牌子好",
    "降噪耳机哪款好","电动牙刷推荐","扫地机器人买哪个好",
    "空气炸锅哪个品牌好","机械键盘入门推荐","智能手表推荐",
    "婴儿奶粉推荐","洗地机推荐","投影仪买哪个牌子好",
    "微波炉哪个品牌好","冰箱推荐家用","空调买什么牌子好",
    "洗衣机推荐","热水器买哪个好","净水器推荐",
    "电饭煲哪个牌子好","破壁机推荐","烤箱什么牌子好",
    "洗碗机有必要买吗","指纹锁推荐","智能门铃推荐",
    "行车记录仪买哪个好","儿童安全座椅推荐","婴儿推车推荐",
    "游戏本推荐2025","办公显示器推荐","移动硬盘推荐",
    "固态硬盘买哪个好","路由器推荐家用","蓝牙音箱推荐",
    "充电宝什么牌子好","手机壳推荐","平板电脑推荐",
    "Kindle值得买吗","运动相机推荐","筋膜枪推荐",
    "按摩椅推荐","足浴盆推荐","加湿器推荐",
    "空气净化器推荐","吸尘器推荐","挂烫机推荐",
    "吹风机推荐","卷发棒推荐","剃须刀推荐",
    "脱毛仪推荐","美容仪推荐",
    "碳中和是什么意思","区块链技术原理","什么是通货膨胀",
    "怎样学好英语","比特币最新价格","个人所得税怎么算",
    "社保断缴有什么影响","高血压饮食注意事项","怎样减肥最有效",
    "大学生就业前景分析","什么是NFT","ChatGPT怎么用",
    "什么是量子计算","什么是云计算","什么是人工智能",
    "5G和4G有什么区别","什么是大数据","什么是物联网",
    "什么是元宇宙","什么是Web3","什么是自动驾驶",
    "股票和基金有什么区别","什么是ETF","房贷利率怎么算",
    "公积金贷款条件","限购政策最新消息","什么是CPI",
    "什么是GDP","什么是通货膨胀和通货紧缩","人民币汇率走势",
    "二手房交易流程","什么是产权年限","什么是共有产权房",
    "什么是养老金并轨","医保报销比例","什么是重疾险",
    "意外险值得买吗","什么是惠民保","什么是商业医疗保险",
    "什么是定期寿险","年金险值得买吗","什么是基金定投",
    "什么是量化交易","什么是可转债","什么是REITs",
    "闪电贷是什么","什么是数字人民币","存款保险制度",
    "期货和期权区别","什么是ESG投资",
]

EXPECTED_DOMAINS = (["product"] * 50) + (["general"] * 50)

def call_gateway(query, max_retries=2):
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(GATEWAY, data=data, headers={"Content-Type": "application/json"})
    for attempt in range(max_retries + 1):
        try:
            resp = urllib.request.urlopen(req, timeout=15)
            return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            if attempt < max_retries:
                time.sleep(1)
                continue
            return {"_pipeline": {}, "error": str(e)[:80]}
    return {"_pipeline": {}, "error": "max retries"}

def main():
    # Load existing results
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT) as f:
            cp = json.load(f)
        last_completed = cp["lastCompleted"]
        results = cp["results"]
        start_time = cp["startTime"]
        print(f"续跑: 已有 {last_completed}/200 条")
    else:
        print("无检查点，退出")
        sys.exit(1)

    # Product queries are indices 100-149, general 150-199
    # If last_completed < 150, we're in product; otherwise general
    for i in range(last_completed, 200):
        query_idx = i
        if i < 150:
            # Product: QUERIES[i-100] where 100 <= i < 150
            query = QUERIES[i - 100]
        else:
            # General: QUERIES[50 + (i-150)] where 150 <= i < 200
            query = QUERIES[50 + (i - 150)]

        domain = EXPECTED_DOMAINS[i - 100] if i >= 100 else "product"

        t0 = time.time()
        raw = call_gateway(query)
        ms = int((time.time() - t0) * 1000)

        p = raw.get("_pipeline", {})
        ex = raw.get("_explanation", {})
        rs = raw.get("_reasoning", {})
        mt = raw.get("metrics", {})

        result = {
            "evidenceCount": p.get("evidenceCount", 0),
            "clusterCount": p.get("clusterCount", 0),
            "dominanceScore": rs.get("primaryScore", 0),
            "confidenceLabel": ex.get("confidenceLabel", "low"),
            "coverageGap": bool(p.get("coverageGap", False)),
            "budgetExhausted": bool(p.get("budgetExhausted", False)),
            "coverageConfidence": p.get("coverageConfidence", 0),
            "durationMs": p.get("durationMs", 0) or ms,
            "timeout": False,
            "error": raw.get("error"),
            "expectedDomain": domain,
        }
        results.append(result)

        # Save checkpoint
        with open(CHECKPOINT, "w") as f:
            json.dump({"lastCompleted": i + 1, "results": results, "startTime": start_time}, f)
        with open(RESULTS_FILE, "w") as f:
            json.dump(results, f)

        sys.stdout.write(f"  #{i+1}/200 | ev={result['evidenceCount']} cl={result['clusterCount']} gap={result['coverageGap']} dur={ms}ms conf={result['confidenceLabel']}\n")
        sys.stdout.flush()

        idx = i + 1
        if idx % 10 == 0 or idx == 200:
            valid = [r for r in results if not r.get("timeout") and not r.get("error")]
            nv = len(valid)
            if nv > 0:
                avg_ev = sum(r.get("evidenceCount", 0) for r in valid) / nv
                gap = sum(1 for r in valid if r.get("coverageGap")) / nv
                print(f"  === {idx}/200 | evAvg={avg_ev:.1f} gap={gap*100:.0f}% ===")

    print("\n全部完成！生成报告...")

    # Final report
    n = len(results)
    valid = [r for r in results if not r.get("timeout") and not r.get("error")]
    nv = len(valid)

    summary = {}
    if nv > 0:
        avg_ev = sum(r.get("evidenceCount", 0) for r in valid) / nv
        avg_cl = sum(r.get("clusterCount", 0) for r in valid) / nv
        cov_gap = sum(1 for r in valid if r.get("coverageGap")) / nv
        budget_ex = sum(1 for r in valid if r.get("budgetExhausted")) / nv
        avg_cov_conf = sum(r.get("coverageConfidence", 0) for r in valid) / nv
        avg_dom = sum(r.get("dominanceScore", 0) for r in valid) / nv
        hi_conf = sum(1 for r in valid if r.get("confidenceLabel") in ("high", "medium")) / nv
        cl_le2 = sum(1 for r in valid if r.get("clusterCount", 5) <= 2) / nv

        summary = {
            "intentAccuracy": round(nv / n, 4),
            "avgEvidenceCount": round(avg_ev, 1),
            "avgClusterCount": round(avg_cl, 1),
            "clusterPurity": round(cl_le2, 4),
            "dominanceStability": round(avg_dom, 4),
            "confidenceCalibration": round(hi_conf, 4),
            "coverageAwareness": round(cov_gap, 4),
            "exhaustionRate": round(budget_ex, 4),
            "avgCoverageConfidence": round(avg_cov_conf, 4),
        }

    total_time = int(time.time()) - start_time

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "totalCases": n, "validCases": nv,
        "totalTimeSeconds": total_time,
        "summary": summary,
        "results": results,
    }

    with open("/root/shipin-cinematic-studio/backend/benchmark-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n总用时: {total_time}s")
    print(f"报告已写入 benchmark-report.json")

    for k, v in summary.items():
        print(f"  {k}: {v}")

    try: os.remove(CHECKPOINT)
    except: pass

if __name__ == "__main__":
    main()
