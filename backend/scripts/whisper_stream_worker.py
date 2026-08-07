#!/usr/bin/env python3
# whisper_stream_worker.py — 昆仑茶馆 实时同声传译 长尾语种流式 ASR 常驻 worker（RTC-INTERPRETER-04）
# 世界语言池 100 语种：Vosk 只覆盖 18 常用语种；其余 83 语种（含方言 粤语 yue / 闽南语 nan）走本 worker
# 单个多语言 whisper 模型（faster-whisper, CPU int8）覆盖全部语种；会话按 {session → 累积 PCM} 隔离
# 协议（stdin JSON 行 → stdout JSON 行，与 vosk_stream_worker.py 一致）：
#   in:  {"type":"init",  "session":"...", "lang":"yue"}    创建会话（模型全局加载一次）→ out ready
#   in:  {"type":"audio", "session":"...", "data":"<b64 PCM s16le 16k mono>"}  累积 + 节流增量转写 → out partial（全量累积文本）
#   in:  {"type":"final", "session":"..."}    整句定稿 → out final；清空会话缓冲
#   in:  {"type":"reset", "session":"..."}    丢弃会话（通话结束）
#   in:  {"type":"close"}                     退出
#   out: {"type":"ready", "session":"...", "lang":"..."}
#   out: {"type":"partial", "session":"...", "text":"..."}
#   out: {"type":"final",   "session":"...", "text":"..."}
#   out: {"type":"error",   "session":"...", "text":"..."}
# ⚠️ 所有输出必须回显 session（Node 端靠它路由）
# ⚠️ 单线程顺序处理：模型加载/转写都是阻塞调用，Node 端帧自然排队（stdin 管道缓冲，无丢帧）
# ⚠️ 冷启动 10-60s（模型加载）；Node 端可 warmup 预热
import sys, json, base64, os, time

import numpy as np

# 闽南语无原生 whisper 语言码 → zh 兜底（best-effort，输出汉字近似）
WHISPER_FALLBACK = {"nan": "zh"}
MODEL_NAME = os.environ.get("ASR_MODEL", "small")
# 长尾语种路径 = 句末整句转写（final）：机器负载高时一次转写耗时较长（CPU int8），
# 增量 partial 会阻塞单 worker 且无意义 → 只保留 20s 硬上限分片（防无限累积），其余等 final
MAX_BUFFER_S = 20.0

_model = None
_bufs = {}      # session -> bytearray（累积 PCM）
_dur_s = {}     # session -> 已累积秒数
_ready_sent = set()


def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8", cpu_threads=8)
        sys.stderr.write(f"[whisper-stream] model {MODEL_NAME} loaded\n")
        sys.stderr.flush()
    return _model


def transcribe(session, lang):
    """转写整段累积缓冲 → 返回文本（失败返回 ''）"""
    data = _bufs.get(session)
    if data is None or len(data) < 16000 * 0.5:  # <0.5s 音频不转
        return ""
    try:
        wcode = WHISPER_FALLBACK.get(lang, lang)
        # ⚠️ faster-whisper 不接受 raw bytes（当文件对象处理会失败）→ 必须转 numpy float32（16k mono）
        arr = np.frombuffer(bytes(data), dtype=np.int16).astype(np.float32) / 32768.0
        segments, _info = get_model().transcribe(
            arr,
            language=wcode,
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return "".join(s.text for s in segments).strip()
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"[whisper-stream] transcribe err {session}: {e}\n")
        sys.stderr.flush()
        return ""


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        msg = json.loads(line)
    except Exception:
        continue
    t = msg.get("type")
    try:
        if t == "init":
            sid = msg["session"]
            lang = msg.get("lang", "zh")
            get_model()  # 确保模型就位（首个 init 阻塞加载）
            _bufs[sid] = bytearray()
            _dur_s[sid] = 0.0
            if sid not in _ready_sent:
                _ready_sent.add(sid)
            out({"type": "ready", "session": sid, "lang": lang})
        elif t == "audio":
            sid = msg["session"]
            buf = _bufs.get(sid)
            if buf is None:
                continue
            raw = base64.b64decode(msg["data"])
            buf.extend(raw)
            _dur_s[sid] = _dur_s.get(sid, 0.0) + len(raw) / 32000.0  # 16k s16le mono = 32000 B/s
            # 硬上限分片：超长句防无限累积（转写一次并清空，作为 partial 供网关增量翻译）
            if _dur_s[sid] >= MAX_BUFFER_S:
                text = transcribe(sid, msg.get("lang", "zh"))
                _bufs[sid] = bytearray()
                _dur_s[sid] = 0.0
                if text:
                    out({"type": "partial", "session": sid, "text": text})
        elif t == "final":
            sid = msg["session"]
            if sid not in _bufs:
                continue
            text = transcribe(sid, msg.get("lang", "zh"))
            _bufs[sid] = bytearray()
            _dur_s[sid] = 0.0
            if text:
                out({"type": "final", "session": sid, "text": text})
        elif t == "reset":
            sid = msg["session"]
            _bufs.pop(sid, None)
            _dur_s.pop(sid, None)
        elif t == "close":
            break
    except Exception as e:  # noqa: BLE001
        out({"type": "error", "session": msg.get("session", "*"), "text": str(e)})
