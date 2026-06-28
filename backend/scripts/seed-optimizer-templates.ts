const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();

  const sceneOptimizePrompt = {
    prompt: '你是一个专业的AI场景图提示词优化专家。根据提供的场景视觉描述，生成优化后的文生图提示词。',
    rules: [
      '输入来源：你收到的【场景视觉描述文本】是本次优化的唯一输入源，禁止自行添加剧本中不存在的元素',
      '输出质量标准：imagePrompt 字段必须为完整的 Stable Diffusion / Midjourney / Flux 级文生图提示词',
      '内容要素（必须全部包含）：场景主体与建筑、环境氛围、光线照明、天气条件、时间/时段、色调/配色、镜头/构图、景深、材质纹理',
      '格式：中文描述为主，关键视觉词可用英文补充',
      '长度要求：imagePrompt 不少于 120 中文字符（或等长英文）',
      '禁止：禁止出现任何人物、角色、人影、剪影；禁止添加剧本中未指定的元素',
      '输出：JSON 格式 sceneSpecs 数组，imagePrompt = 优化后的提示词，description = 原场景描述不变',
      '负面词 negativePrompt 包含：people, character, person, text, watermark, signature',
    ],
  };

  const storyboardOptimizePrompt = {
    prompt: '你是一个 AI 分镜提示词优化专家。根据提供的完整上下文（场景、角色、运镜、动作、对白、情绪），为【每个分镜段落】分别生成独立的文生图提示词。',
    outputFormat: '严格 JSON 数组格式，数组长度必须等于分镜段落数量。每个元素包含：\n- imagePrompt：该分镜的优化后正向提示词，不少于 60 中文字符\n- negativePrompt：该分镜的负向提示词',
    rules: [
      '每个分镜的 imagePrompt 必须不同，紧扣该段落的运镜、动作、情绪、对白来定制',
      '禁止重复角色外貌描述（如身高、体型、五官等详细特征）——角色已有独立角色参考图，无需在分镜中赘述',
      '禁止重复场景环境描述（如老槐树、青石板路等静态细节）——场景已有独立场景参考图',
      '聚焦于：该分镜中角色的动态、表情、动作交互、镜头构图、光线气氛、色彩基调',
      '输出纯 JSON 数组，不要任何其他文字',
    ],
  };

  // 写入 scene-optimizer
  await p.$executeRawUnsafe(
    'INSERT INTO "PromptTemplate" (id, name, content) VALUES (gen_random_uuid(), $1, $2::jsonb) ON CONFLICT (name) DO UPDATE SET content = $2::jsonb',
    'scene-optimizer',
    JSON.stringify(sceneOptimizePrompt)
  );

  // 写入 storyboard-optimizer
  await p.$executeRawUnsafe(
    'INSERT INTO "PromptTemplate" (id, name, content) VALUES (gen_random_uuid(), $1, $2::jsonb) ON CONFLICT (name) DO UPDATE SET content = $2::jsonb',
    'storyboard-optimizer',
    JSON.stringify(storyboardOptimizePrompt)
  );

  console.log('Done');
  await p.$disconnect();
}

main().catch(console.error);
