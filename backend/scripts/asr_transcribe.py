#!/usr/bin/env python3
# asr_transcribe.py — 昆仑茶馆语音转文字常驻 worker（IM-CHA-M10）
# 用法：stdin 逐行读 JSON 任务 {"id": "...", "wav_path": "..."} → stdout 逐行输出 JSON 结果 {"id": "...", "text": "..."}
# 模型启动时加载一次（small, CPU int8, 8 线程），后续任务秒级返回；行协议天然支持多请求排队
# ⚠️ 所有输出必须回显任务 id（Node 端靠 id 匹配 pending 任务，缺 id 会导致请求永不返回）
import json
import os
import sys

MODEL_NAME = os.environ.get("ASR_MODEL", "small")


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    from faster_whisper import WhisperModel
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8", cpu_threads=8)
    sys.stderr.write(f"[asr] model {MODEL_NAME} loaded\n")
    sys.stderr.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            task = json.loads(line)
            task_id = task.get("id", "")
            wav_path = task.get("wav_path", "")
            if not wav_path or not os.path.exists(wav_path):
                emit({"id": task_id, "error": "wav not found"})
                continue
            segments, _info = model.transcribe(
                wav_path,
                language="zh",
                vad_filter=True,
                beam_size=5,
                condition_on_previous_text=False,
            )
            text = "".join(seg.text for seg in segments).strip()
            emit({"id": task_id, "text": text})
        except Exception as e:  # noqa: BLE001
            emit({"id": task.get("id", ""), "error": str(e)})


if __name__ == "__main__":
    main()
