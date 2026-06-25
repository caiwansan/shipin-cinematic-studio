#!/bin/bash
# ⭐ 下载各类音色 demo 到临时目录，然后上传到系统 COS
# 使用阿里百炼 CosyVoice 预置音色的 TTS demo

set -e

BASE_DIR="/tmp/voice-samples"
mkdir -p "$BASE_DIR"

declare -A VOICES
# 阿里百炼 CosyVoice 预置音色（完整的 voiceId 列表）
VOICES["longwan"]="龙婉:温柔女声:女"
VOICES["longfei"]="龙飞:沉稳男声:男"
VOICES["longgang"]="龙刚:厚重男声:男"
VOICES["longfeifei"]="龙飞飞:活泼女声:女"
VOICES["longdali"]="龙大力:豪爽男声:男"
VOICES["huaner"]="环儿:可爱童声:童"
VOICES["lingxi"]="灵希:知性女声:女"
VOICES["longyue"]="龙悦:温暖女声:女"
VOICES["longxia"]="龙侠:侠客男声:男"
VOICES["longying"]="龙莹:清亮女声:女"
VOICES["longchu"]="龙楚:古风女声:女"
VOICES["longlan"]="龙岚:仙侠女声:女"

# 额外角色音色（可以根据需要扩充）
VOICES["longchen"]="龙辰:沉稳老者:男"
VOICES["longyao"]="龙瑶:妖媚女声:女"
VOICES["longhun"]="龙魂:阴森鬼声:男"
VOICES["longtong"]="龙童:顽皮童声:童"
VOICES["longmo"]="龙魔:邪恶反派:男"
VOICES["longxian"]="龙仙:缥缈仙音:女"
VOICES["longku"]="龙哭:悲伤哭腔:女"
VOICES["longxiao"]="龙笑:狂笑反派:男"
VOICES["longsheng"]="龙圣:庄严圣音:男"
VOICES["longyao2"]="龙妖:妖异男声:男"

echo "✅ 共 ${#VOICES[@]} 个音色待下载"
echo "---"
for vid in "${!VOICES[@]}"; do
    IFS=':' read -r name desc gender <<< "${VOICES[$vid]}"
    echo "  $vid ($name) - $desc [$gender]"
done
echo ""

# 测试文本（不同情感）
TEXTS_NEUTRAL=(
    "你好，很高兴认识你。"
    "这是一个阳光明媚的早晨。"
    "我来自一个遥远的地方。"
)
TEXTS_HAPPY=(
    "太棒了！我们成功了！"
    "今天真是个开心的日子。"
)
TEXTS_SAD=(
    "再见了，我的朋友。"
    "为什么一切都会结束呢。"
)
TEXTS_ANGRY=(
    "给我滚出去！"
    "你太过分了！"
)
TEXTS_LAUGH=(
    "哈哈哈，这太好笑了。"
    "呵呵呵，你真有意思。"
)
TEXTS_WHISPER=(
    "嘘，这是个秘密。"
    "小声点，别让人听见。"
)
TEXTS_EVIL=(
    "哼哼哼，你逃不掉的。"
    "桀桀桀，这个世界终将属于我。"
)
TEXTS_CRY=(
    "呜呜呜...为什么会这样..."
    "我好难过，真的。"
)

# 按角色类型分配文本
get_texts_for_voice() {
    local vid=$1
    local gender=$2
    case "$vid" in
        *mo|*hun|*xiao|*yao2)  # 反派/妖异
            echo "${TEXTS_EVIL[0]}" 
            echo "${TEXTS_EVIL[1]}"
            echo "${TEXTS_ANGRY[0]}"
            ;;
        *ku|*cry)  # 哭腔
            echo "${TEXTS_CRY[0]}"
            echo "${TEXTS_SAD[0]}"
            echo "${TEXTS_SAD[1]}"
            ;;
        *tong|*huan*)  # 童声
            echo "${TEXTS_NEUTRAL[0]}"
            echo "${TEXTS_HAPPY[0]}"
            echo "${TEXTS_LAUGH[0]}"
            ;;
        *sheng|*xian)  # 神圣/仙音
            echo "${TEXTS_NEUTRAL[2]}"
            echo "${TEXTS_WHISPER[0]}"
            ;;
        *xiao|*fei*|*ying)  # 开心角色
            echo "${TEXTS_HAPPY[0]}"
            echo "${TEXTS_LAUGH[0]}"
            echo "${TEXTS_NEUTRAL[0]}"
            ;;
        *yao|*lan)  # 妖媚/冷艳
            echo "${TEXTS_WHISPER[0]}"
            echo "${TEXTS_NEUTRAL[1]}"
            echo "${TEXTS_EVIL[0]}"
            ;;
        *)
            echo "${TEXTS_NEUTRAL[0]}"
            echo "${TEXTS_NEUTRAL[1]}"
            echo "${TEXTS_HAPPY[0]}"
            ;;
    esac
}

# 种子音频文件列表（使用系统已有的音频文件作为种子，如果没有则用内置音色的 demo 链接）
# 查找系统中已有的音色 demo
echo "🔍 检查系统已有音频资源..."

# 生成一份配置文件（JSON），方便后续导入
cat > "$BASE_DIR/voice-manifest.json" << 'JSONEOF'
{
  "version": "1.0",
  "source": "alibaba-cosyvoice",
  "voices": [
JSONEOF

first=true
for vid in "${!VOICES[@]}"; do
    IFS=':' read -r name desc gender <<< "${VOICES[$vid]}"
    
    # 生成试听音频 URL（占位，后续上传后替换为实际 COS URL）
    sample_audio="https://voice-samples.oss-cn-hangzhou.aliyuncs.com/cosyvoice/${vid}.mp3"
    
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> "$BASE_DIR/voice-manifest.json"
    fi
    
    cat >> "$BASE_DIR/voice-manifest.json" << JSONEOF
    {
      "voiceId": "${vid}",
      "name": "${name}",
      "gender": "${gender}",
      "description": "${desc}",
      "type": "builtin",
      "targetModel": "cosyvoice-v3.5-plus",
      "sampleUrl": "${sample_audio}"
    }
JSONEOF
done

echo "" >> "$BASE_DIR/voice-manifest.json"
echo "  ]" >> "$BASE_DIR/voice-manifest.json"
echo "}" >> "$BASE_DIR/voice-manifest.json"

echo ""
echo "✅ 音色清单已生成: $BASE_DIR/voice-manifest.json"
echo ""
echo "⚠️ 注意：以上 sampleUrl 为占位 URL。"
echo "   下一步需要："
echo "   1. 调用阿里百炼 CosyVoice API 为每个音色生成试听音频"
echo "   2. 上传到 COS"
echo "   3. 更新 manifest 中的 sampleUrl 为实际 COS URL"
echo "   4. 将 manifest 导入到系统的 VoicePreset 表"
echo ""
echo "📋 音色汇总："
for vid in "${!VOICES[@]}"; do
    IFS=':' read -r name desc gender <<< "${VOICES[$vid]}"
    gender_icon=""
    case "$gender" in
        女) gender_icon="👩";;
        男) gender_icon="👨";;
        童) gender_icon="👶";;
    esac
    echo "  ${gender_icon} ${name} (${vid}) - ${desc}"
done
