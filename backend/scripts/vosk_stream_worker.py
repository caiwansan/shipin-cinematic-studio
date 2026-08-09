#!/usr/bin/env python3
# vosk_stream_worker.py — 昆仑茶馆 实时同声传译 流式 ASR 常驻 worker（RTC-INTERPRETER-02/03）
# 协议（stdin JSON 行 → stdout JSON 行）：
#   in:  {"type":"init",  "session": "...", "lang": "..."}     创建会话识别器（模型按语言加载一次）
#   in:  {"type":"audio", "session": "...", "data": "<base64 PCM s16le 16k mono>"}  增量识别 → out partial
#   in:  {"type":"final", "session": "..."}     强制结束当前句 → out final（整句）
#   in:  {"type":"close"}                       退出
#   out: {"type":"ready", "lang": "...", "session": "..."}
#   out: {"type":"partial", "session": "...", "text": "..."}   累积文本（Vosk 增量，可能修正）
#   out: {"type":"final",   "session": "...", "text": "..."}   整句定稿
#   out: {"type":"error",   "session": "...", "text": "..."}
# ⚠️ 所有输出必须回显 session（Node 端靠它路由）；模型常驻，识别器按会话隔离
# ⚠️ 单线程顺序处理，不要加 threading.Lock 包裹模型加载（vosk C++ 扩展在锁内加载会死锁）
# ⚠️ 模型文件由 Node 侧下载器保障（worker 启动前已就位），worker 只负责加载
import sys, json, base64, os
import vosk

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "models", "vosk")
# 世界语言池：Vosk small 模型（按需懒下载，Node 侧 vosk-model.service.ts 保障文件就位）
MODEL_MAP = {
    "zh": "vosk-model-small-cn-0.22",
    "en": "vosk-model-small-en-us-0.15",
    "es": "vosk-model-small-es-0.42",
    "ru": "vosk-model-small-ru-0.22",
    "fr": "vosk-model-small-fr-0.22",
    "de": "vosk-model-small-de-0.15",
    "ja": "vosk-model-small-ja-0.22",
    "ko": "vosk-model-small-ko-0.22",
    "pt": "vosk-model-small-pt-0.3",
    "it": "vosk-model-small-it-0.22",
    "ar": "vosk-model-small-ar-0.3",
    "vi": "vosk-model-small-vi-0.3",
    "tr": "vosk-model-small-tr-0.3",
    "nl": "vosk-model-small-nl-0.22",
    "pl": "vosk-model-small-pl-0.22",
    "hi": "vosk-model-small-hi-0.22",
    "uk": "vosk-model-small-uk-v3-small",
    "fa": "vosk-model-small-fa-0.5",
}

_models = {}   # lang -> Model
_recs = {}     # session -> KaldiRecognizer

def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def get_model(lang):
    if lang not in _models:
        path = os.path.join(MODELS_DIR, MODEL_MAP.get(lang, ""))
        if not os.path.isdir(path):
            out({"type": "error", "session": "*", "text": "model not ready: %s" % lang})
            raise RuntimeError("model not ready: %s" % lang)
        _models[lang] = vosk.Model(path)
    return _models[lang]

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
            lang = msg.get("lang", "zh")
            sid = msg["session"]
            get_model(lang)
            _recs[sid] = vosk.KaldiRecognizer(get_model(lang), 16000)
            out({"type": "ready", "lang": lang, "session": sid})
        elif t == "audio":
            sid = msg["session"]
            rec = _recs.get(sid)
            if rec is None:
                continue
            raw = base64.b64decode(msg["data"])
            if rec.AcceptWaveform(raw):
                res = json.loads(rec.Result())
                txt = res.get("text", "").strip()
                if txt:
                    out({"type": "final", "session": sid, "text": txt})
            else:
                res = json.loads(rec.PartialResult())
                txt = res.get("partial", "").strip()
                if txt:
                    out({"type": "partial", "session": sid, "text": txt})
        elif t == "final":
            sid = msg["session"]
            rec = _recs.get(sid)
            if rec is None:
                continue
            res = json.loads(rec.FinalResult())
            txt = res.get("text", "").strip()
            if txt:
                out({"type": "final", "session": sid, "text": txt})
        elif t == "reset":
            sid = msg["session"]
            rec = _recs.get(sid)
            if rec is not None:
                rec.Reset()
        elif t == "close":
            break
    except Exception as e:
        out({"type": "error", "session": msg.get("session", "*"), "text": str(e)})
