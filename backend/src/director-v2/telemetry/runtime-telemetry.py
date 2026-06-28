# ============================================================
# runtime-telemetry.py — Cinematic Runtime Observatory
# Phase 5.5: 运行时观测系统
#
# 不改变任何生成逻辑，只观测。
# 记录每次请求的分布、fallback 频率、情绪方差等基线数据。
#
# 铁律：
# 1. 不修改 IR / ShotGraph / Timeline / Emotion 结构
# 2. 不拦截任何请求
# 3. 观测数据默认保留最近 1000 次
# ============================================================

import os, sys, json, time, datetime
from collections import defaultdict, deque

STORE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "data", "runtime-telemetry")
os.makedirs(STORE_PATH, exist_ok=True)

MAX_OBSERVATIONS = 1000

class RingBuffer:
    def __init__(self, maxlen):
        self._data = deque(maxlen=maxlen)
    def push(self, item):
        self._data.append(item)
    def all(self):
        return list(self._data)
    def latest(self, n=10):
        return list(self._data)[-n:]

class Aggregator:
    def __init__(self):
        self._counts = defaultdict(int)
        self._total = 0
    def record(self, key):
        self._counts[key] += 1
        self._total += 1
    def distribution(self):
        if self._total == 0: return {}
        return {k: round(v / self._total * 100, 1) for k, v in sorted(self._counts.items(), key=lambda x: -x[1])}
    def summary(self):
        if self._total == 0: return {"total": 0, "top_key": None, "top_pct": 0}
        top = max(self._counts, key=self._counts.get)
        return {"total": self._total, "top_key": top, "top_pct": round(self._counts[top] / self._total * 100, 1)}

class CinematicTelemetry:
    """运行时观测内核——单例"""
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self):
        self.requests = RingBuffer(MAX_OBSERVATIONS)
        self.ir_beat_count = Aggregator()
        self.shotgraph_shot_count = Aggregator()
        self.timeline_sequence_count = Aggregator()
        self.timeline_rhythm_type = Aggregator()
        self.emotion_color_dist = Aggregator()
        self.emotion_global_tone = Aggregator()
        self.fallback_camera_intent = Aggregator()
        self.camera_movement_dist = Aggregator()
        self.cut_type_dist = Aggregator()
        self._baseline = None
        self._start_time = time.time()
        self._request_count = 0
        self._error_count = 0

    def record_request(self, request_type: str, success: bool, trace: dict, duration_ms: float):
        self._request_count += 1
        if not success: self._error_count += 1
        obs = {"ts": datetime.datetime.now().isoformat(), "type": request_type, "success": success, "trace": trace or {}, "duration_ms": round(duration_ms, 1)}
        self.requests.push(obs)
        if trace:
            if "beatCount" in trace:
                self.ir_beat_count.record(str(trace["beatCount"]))
            if "shots" in trace:
                self.shotgraph_shot_count.record(str(trace["shots"]))
            if "sequences" in trace:
                self.timeline_sequence_count.record(str(trace["sequences"]))
            if trace.get("cutTypes"):
                for ct, cnt in trace["cutTypes"].items():
                    self.cut_type_dist.record(f"{ct}:{cnt}")
            if "globalTone" in trace:
                t = trace["globalTone"]
                self.emotion_global_tone.record("dark" if t < 0.35 else "bright" if t > 0.65 else "neutral")

    def record_camera_intent(self, intent: str):
        self.fallback_camera_intent.record(intent)

    def snapshot(self) -> dict:
        uptime_h = round((time.time() - self._start_time) / 3600, 1)
        r = self.requests.all()
        sc = sum(1 for x in r if x.get("success"))
        return {
            "ts": datetime.datetime.now().isoformat(), "uptime_h": uptime_h,
            "requests": {"total": self._request_count, "observed": len(r), "success": sc, "errors": self._error_count, "success_rate": round(sc / max(len(r), 1) * 100, 1)},
            "ir": {"beat_distribution": self.ir_beat_count.distribution(), "fallback_camera_intent": self.fallback_camera_intent.distribution()},
            "shotgraph": {"shot_count_dist": self.shotgraph_shot_count.distribution(), "camera_movement_dist": self.camera_movement_dist.distribution()},
            "timeline": {"sequence_count_dist": self.timeline_sequence_count.distribution(), "rhythm_type_dist": self.timeline_rhythm_type.distribution(), "cut_type_dist": self.cut_type_dist.distribution()},
            "emotion": {"global_tone_dist": self.emotion_global_tone.distribution()},
            "latest_10_requests": self.requests.latest(10),
        }

    def save_snapshot(self) -> str:
        snap = self.snapshot()
        fn = os.path.join(STORE_PATH, f"telemetry-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.json")
        with open(fn, "w") as f:
            json.dump(snap, f, indent=2, ensure_ascii=False)
        print(f"  Snapshot saved: {fn}")
        return fn

    def compute_baseline(self) -> dict:
        snap = self.snapshot()
        self._baseline = {
            "ir_beat_top": self.ir_beat_count.summary(),
            "shotgraph_shot_top": self.shotgraph_shot_count.summary(),
            "timeline_seq_top": self.timeline_sequence_count.summary(),
            "fallback_top": self.fallback_camera_intent.summary(),
            "emotion_tone_dist": self.emotion_global_tone.distribution(),
            "cut_type_dist": self.cut_type_dist.distribution(),
            "success_rate": snap["requests"]["success_rate"],
        }
        return self._baseline

    def drift_report(self) -> dict:
        if not self._baseline: return {"error": "Baseline not computed yet"}
        snap = self.snapshot()
        return {
            "ts": snap["ts"],
            "requests": snap["requests"],
            "drift": {
                "success_rate_diff": round(snap["requests"]["success_rate"] - self._baseline.get("success_rate", 0), 1),
                "fallback_shift": self.fallback_camera_intent.summary(),
                "emotion_tone_drift": self.emotion_global_tone.distribution(),
            },
        }


telemetry = CinematicTelemetry()


def pprint_telemetry():
    s = telemetry.snapshot()
    print("=== Cinematic Runtime Observatory ===")
    print(f"Uptime: {s['uptime_h']}h | Requests: {s['requests']['total']} (success: {s['requests']['success_rate']}%)")
    print()
    print("IR:")
    print(f"  Beat distribution: {s['ir']['beat_distribution']}")
    print(f"  Fallback cameraIntent: {s['ir']['fallback_camera_intent']}")
    print()
    print("ShotGraph:")
    print(f"  Shot count: {s['shotgraph']['shot_count_dist']}")
    print(f"  Camera movement: {s['shotgraph']['camera_movement_dist']}")
    print()
    print("Timeline:")
    print(f"  Sequences: {s['timeline']['sequence_count_dist']}")
    print(f"  Rhythm types: {s['timeline']['rhythm_type_dist']}")
    print(f"  Cut types: {s['timeline']['cut_type_dist']}")
    print()
    print("Emotion:")
    print(f"  Global tone: {s['emotion']['global_tone_dist']}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "snapshot":
        telemetry.save_snapshot()
    elif len(sys.argv) > 1 and sys.argv[1] == "baseline":
        bl = telemetry.compute_baseline()
        print(json.dumps(bl, indent=2, ensure_ascii=False))
    elif len(sys.argv) > 1 and sys.argv[1] == "drift":
        dr = telemetry.drift_report()
        print(json.dumps(dr, indent=2, ensure_ascii=False))
    else:
        pprint_telemetry()
