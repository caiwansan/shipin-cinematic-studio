#!/bin/bash
# ⭐ 音色 Demo 扩充工具
# 用 edge-tts 生成新音色的 demo 音频并部署到后端静态目录
# 用法: ./add-voice-samples.sh <voiceId> <名称> <语音名称> <文本>
# 例: ./add-voice-samples.sh longtest 龙测试 zh-CN-XiaoxiaoNeural "你好，我是测试音色。"

VOICE_ID=$1
NAME=$2
EDGE_VOICE=$3
TEXT=$4

if [ -z "$VOICE_ID" ] || [ -z "$NAME" ] || [ -z "$EDGE_VOICE" ] || [ -z "$TEXT" ]; then
    echo "用法: $0 <voiceId> <名称> <edge语音名> <文本>"
    echo "可用语音:"
    edge-tts --list-voices 2>/dev/null | grep -iE "zh-|ja-|ko-|en-|yue|hk" | head -20
    exit 1
fi

DST="/root/shipin-cinematic-studio/backend/public/uploads/voice/$VOICE_ID.mp3"
echo "🎵 生成音色: $NAME ($VOICE_ID)"
echo "   语音: $EDGE_VOICE"
echo "   文本: $TEXT"
echo "   目标: $DST"
echo ""

edge-tts --voice "$EDGE_VOICE" --text "$TEXT" --write-media "$DST" 2>&1
if [ -f "$DST" ] && [ -s "$DST" ]; then
    echo ""
    echo "✅ 生成成功! $(du -h "$DST" | awk '{print $1}')"
    echo "   URL: /uploads/voice/$VOICE_ID.mp3"
    echo ""
    echo "✏️ 接下来请手动更新 backend/src/routes/voice.ts 的 BUILTIN_VOICE_PRESETS 数组"
else
    echo "❌ 生成失败"
    exit 1
fi
