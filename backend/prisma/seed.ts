import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@scs.com' },
    update: {},
    create: {
      email: 'admin@scs.com',
      username: 'admin',
      passwordHash,
      coins: 1000,
      memberTier: 'premium',
    },
  })
  console.log(`✅ Created admin user: ${admin.email}`)

  // Create demo user
  const demoHash = await bcrypt.hash('demo123', 10)
  const demo = await prisma.user.upsert({
    where: { email: 'demo@scs.com' },
    update: {},
    create: {
      email: 'demo@scs.com',
      username: 'demo',
      passwordHash: demoHash,
      coins: 100,
      memberTier: 'free',
    },
  })
  console.log(`✅ Created demo user: ${demo.email}`)

  // Create prompt templates
  const templates = [
    {
      name: 'Cinematic Wide Shot',
      description: 'Standard cinematic wide shot for establishing scenes',
      category: 'shot-type',
      content: {
        prompt: 'Cinematic wide shot of {subject}, {environment}, dramatic lighting, 4K',
        negativePrompt: 'blurry, low quality, distortion',
      },
      variables: { subject: 'string', environment: 'string' },
    },
    {
      name: 'Character Close-up',
      description: 'Emotional close-up shot for character moments',
      category: 'shot-type',
      content: {
        prompt: 'Close-up shot of {character}, {expression}, shallow depth of field, cinematic lighting',
        negativePrompt: 'blurry, double face, deformed',
      },
      variables: { character: 'string', expression: 'string' },
    },
    {
      name: 'Action Sequence',
      description: 'Dynamic action shot with motion blur',
      category: 'action',
      content: {
        prompt: 'Dynamic action shot, {subject} {action}, fast camera movement, motion blur, cinematic',
        negativePrompt: 'static, blurry subject',
      },
      variables: { subject: 'string', action: 'string' },
    },
    {
      name: 'Atmospheric Scene',
      description: 'Scene focused on mood and atmosphere',
      category: 'environment',
      content: {
        prompt: '{environment}, {atmosphere}, volumetric lighting, cinematic color grading, 8K',
        negativePrompt: 'flat lighting, dull colors',
      },
      variables: { environment: 'string', atmosphere: 'string' },
    },
  ]

  for (const template of templates) {
    await prisma.promptTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    })
  }
  console.log(`✅ Created ${templates.length} prompt templates`)

  // Create a sample project for demo user
  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Project',
      description: 'A sample cinematic project to get started',
      status: 'draft',
      userId: demo.id,
    },
  })
  console.log(`✅ Created demo project: ${project.name}`)

  // Create sample storyboards
  const storyboards = [
    {
      projectId: project.id,
      shotIndex: 1,
      duration: 5.0,
      shotType: 'wide',
      subject: 'A mysterious forest',
      action: 'Camera slowly pans through foggy trees',
      expression: 'mysterious',
      cameraMovement: 'slow pan',
      lens: '24mm',
      lighting: 'volumetric fog light',
      emotion: 'mysterious',
      environment: 'dense forest with tall pine trees',
      cinematicStyle: 'dark fantasy',
      colorStyle: 'cool tones',
      realism: true,
      motionBlur: false,
      startFrame: 0,
      endFrame: 150,
    },
    {
      projectId: project.id,
      shotIndex: 2,
      duration: 4.0,
      shotType: 'close-up',
      subject: 'A warrior drawing their sword',
      action: 'Slowly unsheathing a glowing blade',
      expression: 'determined',
      cameraMovement: 'static',
      lens: '85mm',
      lighting: 'rim light from blade glow',
      emotion: 'determined',
      environment: 'forest clearing',
      cinematicStyle: 'epic fantasy',
      colorStyle: 'warm highlights, cool shadows',
      realism: true,
      motionBlur: false,
      startFrame: 151,
      endFrame: 270,
    },
  ]

  for (const sb of storyboards) {
    await prisma.storyboard.create({ data: sb })
  }
  console.log(`✅ Created ${storyboards.length} storyboards`)

  // Seed agent level configs
  const agentLevels = [
    { level: 'mid', name: '中级代理', priceCoins: 290000, discount: 0.85 },
    { level: 'senior', name: '高级代理', priceCoins: 590000, discount: 0.80 },
    { level: 'super', name: '超级代理', priceCoins: 990000, discount: 0.75 },
  ]
  for (const al of agentLevels) {
    await prisma.agentLevelConfig.upsert({
      where: { level: al.level },
      update: {},
      create: al,
    })
  }
  console.log(`✅ Created ${agentLevels.length} agent level configs`)

  // Seed AI models (only if table is empty)
  const existingModelCount = await prisma.aiModel.count()
  if (existingModelCount === 0) {
    const imageModels = [
      { name: 'doubao-seedream-5-0-260128', provider: 'volcengine', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.85, costPerRequest: 0.01 },
      { name: 'doubao-seedream-4-5-251128', provider: 'volcengine', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.80, costPerRequest: 0.008 },
      { name: 'flux-schnell', provider: 'replicate', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.78, costPerRequest: 0.003 },
      { name: 'flux-pro', provider: 'replicate', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.90, costPerRequest: 0.01 },
      { name: 'sdxl', provider: 'replicate', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.82, costPerRequest: 0.004 },
      { name: 'jimeng-midjourney', provider: 'jimeng', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.92, costPerRequest: 0.05 },
      { name: 'tongyi-wanxiang', provider: 'aliyun', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.80, costPerRequest: 0.02 },
      { name: 'wujing-dall-e-4', provider: 'openai', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.88, costPerRequest: 0.04 },
      { name: 'stable-diffusion-3-5', provider: 'replicate', modelType: 'image', taskTypes: ['text_script', 'character_gen', 'storyboard'], status: 'active', qualityScore: 0.82, costPerRequest: 0.005 },
    ]

    const videoModels = [
      { name: 'doubao-seedance-2-0-260128', provider: 'volcengine', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.88, costPerRequest: 0.05 },
      { name: 'doubao-seedance-1-5-pro-251215', provider: 'volcengine', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.82, costPerRequest: 0.03 },
      { name: 'kling-2-0', provider: 'kling', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.90, costPerRequest: 0.08 },
      { name: 'kling-1-6', provider: 'kling', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.85, costPerRequest: 0.05 },
      { name: 'sora', provider: 'openai', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.95, costPerRequest: 0.10 },
      { name: 'minimax-video', provider: 'minimax', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.80, costPerRequest: 0.04 },
      { name: 'runway-gen-4', provider: 'runway', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.87, costPerRequest: 0.06 },
      { name: 'pixverse', provider: 'pixverse', modelType: 'video', taskTypes: ['video_gen'], status: 'active', qualityScore: 0.75, costPerRequest: 0.02 },
    ]

    const llmModels = [
      { name: 'doubao-seed-2-0-mini-260428', provider: 'volcengine', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.85, costPerRequest: 0.002 },
      { name: 'gpt-4o', provider: 'openai', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.95, costPerRequest: 0.01 },
      { name: 'gpt-4o-mini', provider: 'openai', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.88, costPerRequest: 0.003 },
      { name: 'deepseek-chat', provider: 'deepseek', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.85, costPerRequest: 0.002 },
      { name: 'deepseek-reasoner', provider: 'deepseek', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.90, costPerRequest: 0.004 },
      { name: 'gemini-2-5-pro', provider: 'google', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.92, costPerRequest: 0.008 },
      { name: 'gemini-2-0-flash', provider: 'google', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.85, costPerRequest: 0.002 },
      { name: 'claude-3-5-sonnet', provider: 'anthropic', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.93, costPerRequest: 0.015 },
      { name: 'claude-3-haiku', provider: 'anthropic', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.85, costPerRequest: 0.003 },
      { name: 'qwen-max', provider: 'aliyun', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.82, costPerRequest: 0.003 },
      { name: 'ernie-4-5', provider: 'baidu', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.80, costPerRequest: 0.003 },
      { name: 'moonshot-kimi', provider: 'moonshot', modelType: 'llm', taskTypes: ['text_script'], status: 'active', qualityScore: 0.78, costPerRequest: 0.002 },
    ]

    const allModels = [...imageModels, ...videoModels, ...llmModels]

    for (const model of allModels) {
      // upsert by name to allow re-running seed
      const existing = await prisma.aiModel.findUnique({ where: { name: model.name } })
      if (!existing) {
        await prisma.aiModel.create({ data: model })
      }
    }
    console.log(`✅ Created ${allModels.length} AI model entries`)
  } else {
    console.log(`ℹ️  Skipping AI model seed — ${existingModelCount} models already exist`)
  }

  // ============================================================
  // Route Config seed — 将路由硬编码配置迁移到 RouteConfig 表
  // ============================================================
  console.log('🌱 Seeding RouteConfig...')

  const routeConfigs = [
    // ========== scope: route:admin-global-config ==========
    // MODEL_TYPES_META
    {
      scope: 'route:admin-global-config',
      key: 'model_types_meta',
      value: [
        { type: 'llm', label: '语言模型' },
        { type: 'image', label: '图片模型' },
        { type: 'video', label: '视频模型' },
        { type: 'tts', label: '语音模型' },
      ],
      label: '模型类型统一映射',
      sortOrder: 1,
    },
    // PROVIDERS 数组 — 所有供应商定义
    {
      scope: 'route:admin-global-config',
      key: 'providers',
      value: [
        {
          id: 'volcengine',
          name: '火山引擎',
          envKeyPrefix: 'VOLCENGINE',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'doubao-seed-2-0-mini-260428' },
            { type: 'image', label: '图片模型', defaultModel: 'doubao-seedream-4-0-250828' },
            { type: 'video', label: '视频模型', defaultModel: 'doubao-seedance-1-5-pro-251215' },
            { type: 'tts', label: '语音模型', defaultModel: 'doubao-tts-1' },
          ],
          modelSource: 'volcengine-api',
        },
        {
          id: 'aliyun',
          name: '阿里百炼',
          envKeyPrefix: 'ALIYUN',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'qwen-plus' },
            { type: 'image', label: '图片模型', defaultModel: 'wanx2.1-t2i-turbo' },
            { type: 'video', label: '视频模型', defaultModel: 'wan2.7-t2v' },
            { type: 'tts', label: '语音模型', defaultModel: 'cosyvoice-v1' },
          ],
          modelSource: 'aliyun-api',
        },
        {
          id: 'siliconflow',
          name: '硅基流动',
          envKeyPrefix: 'SILICONFLOW',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'Qwen/Qwen2.5-72B-Instruct' },
            { type: 'image', label: '图片模型', defaultModel: 'black-forest-labs/FLUX.1-dev' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-32B-Instruct', 'Qwen/Qwen2.5-14B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Pro/Qwen2.5-72B-Instruct'],
            image: ['black-forest-labs/FLUX.1-dev', 'stabilityai/stable-diffusion-3.5-large'],
            video: [],
            tts: ['FunAudioLLM/CosyVoice2-0.5B', 'fishaudio/fish-speech-1.5'],
            voiceList: ['benjamin', 'charles', 'alex', 'david', 'anna', 'bella', 'claire', 'diana'],
          },
        },
        {
          id: 'deepseek',
          name: 'DeepSeek',
          envKeyPrefix: 'DEEPSEEK',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'deepseek-chat' },
            { type: 'image', label: '图片模型', defaultModel: '' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['deepseek-chat', 'deepseek-reasoner'],
            image: [],
            video: [],
            tts: [],
          },
        },
        {
          id: 'google',
          name: 'Google Gemini',
          envKeyPrefix: 'GOOGLE',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'gemini-2.5-pro' },
            { type: 'image', label: '图片模型', defaultModel: 'gemini-2.5-pro' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-thinking-exp'],
            image: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
            video: [],
            tts: [],
          },
        },
        {
          id: 'anthropic',
          name: 'Anthropic Claude',
          envKeyPrefix: 'ANTHROPIC',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'claude-sonnet-4-20250514' },
            { type: 'image', label: '图片模型', defaultModel: '' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['claude-sonnet-4-20250514', 'claude-sonnet-4', 'claude-3.7-sonnet', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus', 'claude-3-haiku'],
            image: [],
            video: [],
            tts: [],
          },
        },
        {
          id: 'xai',
          name: 'xAI Grok',
          envKeyPrefix: 'XAI',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'grok-3' },
            { type: 'image', label: '图片模型', defaultModel: '' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['grok-3', 'grok-3-mini', 'grok-3-vision', 'grok-3-mini-vision', 'grok-2', 'grok-2-vision'],
            image: [],
            video: [],
            tts: [],
          },
        },
        {
          id: 'moonshot',
          name: '月之暗面 Moonshot',
          envKeyPrefix: 'MOONSHOT',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'kimi-k2' },
            { type: 'image', label: '图片模型', defaultModel: '' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['kimi-k2', 'kimi-k2-thinking', 'kimi-k2.5', 'kimi-k2.6', 'Moonshot-Kimi-K2-Instruct', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
            image: [],
            video: [],
            tts: [],
          },
        },
        {
          id: 'zhipu',
          name: '智谱 GLM',
          envKeyPrefix: 'ZHIPU',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'glm-5' },
            { type: 'image', label: '图片模型', defaultModel: 'cogview-4' },
            { type: 'video', label: '视频模型', defaultModel: 'cogvideo' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['glm-5', 'glm-5.1', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4v-plus', 'glm-4v-flash'],
            image: ['cogview-4', 'cogview-3'],
            video: ['cogvideo'],
            tts: [],
          },
        },
        {
          id: 'openai',
          name: 'OpenAI ChatGPT',
          envKeyPrefix: 'OPENAI',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: 'gpt-4o' },
            { type: 'image', label: '图片模型', defaultModel: 'dall-e-3' },
            { type: 'video', label: '视频模型', defaultModel: 'sora' },
            { type: 'tts', label: '语音模型', defaultModel: 'tts-1' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4-turbo', 'gpt-4', 'o4-mini', 'o3-mini', 'o1', 'o1-mini', 'gpt-4o-realtime', 'gpt-4o-mini-realtime'],
            image: ['dall-e-3', 'dall-e-2'],
            video: ['sora'],
            tts: ['tts-1', 'tts-1-hd'],
          },
        },
        {
          id: 'custom',
          name: '本地大模型 (OpenAI 兼容)',
          envKeyPrefix: 'CUSTOM',
          types: [
            { type: 'llm', label: '语言模型', defaultModel: '' },
            { type: 'image', label: '图片模型', defaultModel: '' },
            { type: 'video', label: '视频模型', defaultModel: '' },
            { type: 'tts', label: '语音模型', defaultModel: '' },
          ],
          modelSource: 'preset',
          presetModels: {
            llm: [],
            image: [],
            video: [],
            tts: [],
          },
        },
      ],
      label: '所有供应商定义（ProviderConfig[]）',
      sortOrder: 2,
    },
    // ALIYUN_PRESET_MODELS — 阿里百炼已知活跃模型列表
    {
      scope: 'route:admin-global-config',
      key: 'aliyun_preset_models',
      value: [
        // LLM - 通义千问系列
        { type: 'llm', id: 'qwen-turbo' },
        { type: 'llm', id: 'qwen-plus' },
        { type: 'llm', id: 'qwen-max' },
        { type: 'llm', id: 'qwen-flash' },
        { type: 'llm', id: 'qwen3-max' },
        { type: 'llm', id: 'qwen3-coder-plus' },
        { type: 'llm', id: 'qwen3-coder-flash' },
        { type: 'llm', id: 'qwen3.5-plus' },
        { type: 'llm', id: 'qwen3.5-flash' },
        { type: 'llm', id: 'qwen3.6-plus' },
        { type: 'llm', id: 'qwen3.6-flash' },
        { type: 'llm', id: 'qwen3.6-max-preview' },
        { type: 'llm', id: 'qwen3-30b-a3b' },
        { type: 'llm', id: 'qwen3-32b' },
        { type: 'llm', id: 'qwen3-14b' },
        { type: 'llm', id: 'qwen3-8b' },
        { type: 'llm', id: 'qwen3-235b-a22b' },
        { type: 'llm', id: 'qwen3-vl-plus' },
        { type: 'llm', id: 'qwen3-vl-flash' },
        { type: 'llm', id: 'qwen3-vl-32b-instruct' },
        { type: 'llm', id: 'qwen3-vl-32b-thinking' },
        { type: 'llm', id: 'qwen3-vl-30b-a3b-instruct' },
        { type: 'llm', id: 'qwen3-vl-30b-a3b-thinking' },
        { type: 'llm', id: 'qwen3-vl-235b-a22b-instruct' },
        { type: 'llm', id: 'qwen3-vl-235b-a22b-thinking' },
        { type: 'llm', id: 'qwen3-omni-30b-a3b-captioner' },
        { type: 'llm', id: 'qwen-vl-max' },
        { type: 'llm', id: 'qwen-vl-plus' },
        { type: 'llm', id: 'qwen-omni-turbo' },
        { type: 'llm', id: 'deepseek-v3.2' },
        { type: 'llm', id: 'deepseek-v4-flash' },
        { type: 'llm', id: 'deepseek-v4-pro' },
        // 图片 - 通义万相 + qwen-image
        { type: 'image', id: 'wanx2.1-t2i-turbo' },
        { type: 'image', id: 'wanx2.1-t2i-plus' },
        { type: 'image', id: 'wanx2.0-t2i-turbo' },
        { type: 'image', id: 'wan2.6-t2i' },
        { type: 'image', id: 'wan2.2-t2i-plus' },
        { type: 'image', id: 'wan2.2-t2i-flash' },
        { type: 'image', id: 'qwen-image' },
        { type: 'image', id: 'qwen-image-plus' },
        { type: 'image', id: 'qwen-image-max' },
        { type: 'image', id: 'qwen-image-2.0' },
        { type: 'image', id: 'qwen-image-2.0-pro' },
        // 视频 - 万相系列
        { type: 'video', id: 'wan2.7-t2v' },
        { type: 'video', id: 'wan2.7-videoedit' },
        { type: 'video', id: 'wan2.6-t2v' },
        { type: 'video', id: 'wan2.5-t2v-preview' },
        { type: 'video', id: 'wan2.1-t2v-turbo' },
        { type: 'video', id: 'wan2.1-i2v-turbo' },
        { type: 'video', id: 'happyhorse-1.0-t2v' },
        // TTS
        { type: 'tts', id: 'cosyvoice-v3.5-plus' },
        { type: 'tts', id: 'cosyvoice-v3.5-flash' },
        { type: 'tts', id: 'cosyvoice-v3-plus' },
        { type: 'tts', id: 'cosyvoice-v3-flash' },
        { type: 'tts', id: 'cosyvoice-v2' },
        { type: 'tts', id: 'cosyvoice-v1' },
        { type: 'tts', id: 'cosyvoice-clone-v1' },
        { type: 'tts', id: 'qwen3-tts-flash' },
        { type: 'tts', id: 'qwen3-tts-instruct-flash' },
        { type: 'tts', id: 'qwen-tts' },
        { type: 'tts', id: 'qwen-tts-realtime' },
      ],
      label: '阿里百炼预设模型列表（ALIYUN_PRESET_MODELS）',
      sortOrder: 3,
    },
    // assignModelIcon 硬编码图标映射规则
    {
      scope: 'route:admin-global-config',
      key: 'model_icon_rules',
      value: {
        video: {
          'doubao-seedance': '🎬',
          'kling': '🐉',
          'sora': '🌊',
          'minimax': '🤖',
          'runway': '🛤️',
          'pixverse': '✨',
          'default': '🎥',
        },
        image: {
          'doubao-seedream': '🌱',
          'flux': '⚡',
          'sdxl': '🎨',
          'jimeng': '🎭',
          'tongyi-wanxiang': '🌌',
          'wujing': '🎯',
          'stable-diffusion': '🖌️',
          'wan': '🖼️',
          'default': '🖼️',
        },
        default: { 'tts': '🔊', 'default': '🧠' },
      },
      label: '模型图标分配规则（assignModelIcon）',
      sortOrder: 4,
    },
    // 火山引擎 fallback 模型列表（fetchVolcengineModels 回退）
    {
      scope: 'route:admin-global-config',
      key: 'volcengine_fallback_models',
      value: [
        { type: 'llm', id: 'doubao-seed-2-0-mini-260428', name: 'Doubao Seed 2.0 Mini' },
        { type: 'llm', id: 'doubao-seed-2-0-plus-260428', name: 'Doubao Seed 2.0 Plus' },
        { type: 'llm', id: 'doubao-1-5-pro-256k-250115', name: 'Doubao 1.5 Pro 256K' },
        { type: 'llm', id: 'doubao-1-5-lite-32k-250115', name: 'Doubao 1.5 Lite 32K' },
        { type: 'llm', id: 'doubao-vl-pro-256k-250115', name: 'Doubao VL Pro 256K' },
        { type: 'llm', id: 'doubao-vl-lite-32k-250115', name: 'Doubao VL Lite 32K' },
        { type: 'llm', id: 'deepseek-r1-250120', name: 'DeepSeek R1' },
        { type: 'llm', id: 'deepseek-v3-241226', name: 'DeepSeek V3' },
        { type: 'llm', id: 'o1-mini-250120', name: 'O1 Mini' },
        { type: 'image', id: 'doubao-seedream-5-0-260128', name: 'Doubao Seedream 5.0' },
        { type: 'image', id: 'doubao-seedream-4-5-251128', name: 'Doubao Seedream 4.5' },
        { type: 'image', id: 'doubao-seedream-4-0-250828', name: 'Doubao Seedream 4.0' },
        { type: 'image', id: 'doubao-seedream-2-0-250217', name: 'Doubao Seedream 2.0' },
        { type: 'video', id: 'doubao-seedance-2-0-pro-260510', name: 'Doubao Seedance 2.0 Pro' },
        { type: 'video', id: 'doubao-seedance-1-5-pro-251215', name: 'Doubao Seedance 1.5 Pro' },
        { type: 'video', id: 'doubao-seedance-1-0-pro-fast-251015', name: 'Doubao Seedance 1.0 Pro Fast' },
        { type: 'tts', id: 'doubao-tts-1', name: 'Doubao TTS' },
      ],
      label: '火山引擎 API 回退模型列表',
      sortOrder: 5,
    },
    // DOMAIN_MAP — 火山引擎 domain → 模型类型映射
    {
      scope: 'route:admin-global-config',
      key: 'volcengine_domain_map',
      value: {
        'LLM': 'llm',
        'VLM': 'llm',
        'ImageGeneration': 'image',
        'VideoGeneration': 'video',
        'TTS': 'tts',
        'AudioGeneration': 'tts',
        'Embedding': 'llm',
        'Router': 'llm',
        '3DGeneration': 'llm',
      },
      label: '火山引擎 API domain → type 映射',
      sortOrder: 6,
    },
    // 默认启用的供应商
    {
      scope: 'route:admin-global-config',
      key: 'default_enabled_providers',
      value: 'volcengine',
      label: '默认启用的供应商 ID（逗号分隔）',
      sortOrder: 7,
    },

    // ========== scope: route:api-keys ==========
    {
      scope: 'route:api-keys',
      key: 'valid_providers',
      value: ['volcengine', 'siliconflow', 'deepseek', 'openai', 'kling', 'replicate', 'aliyun'],
      label: '有效的 provider 列表',
      sortOrder: 1,
    },
    {
      scope: 'route:api-keys',
      key: 'valid_model_types',
      value: ['llm', 'image', 'video', 'tts', 'audio'],
      label: '有效的 modelType 列表',
      sortOrder: 2,
    },
    {
      scope: 'route:api-keys',
      key: 'detect_model_type_map',
      value: {
        siliconflow: 'llm',
        deepseek: 'llm',
        openai: 'llm',
        volcengine: 'image',
        kling: 'video',
        replicate: 'image',
        aliyun: 'tts',
      },
      label: 'provider → 默认 modelType 映射（detectModelType）',
      sortOrder: 3,
    },
    {
      scope: 'route:api-keys',
      key: 'needs_config_tiers',
      value: {
        exemptTiers: ['free', 'basic'],
        checkKey: 'needsConfig',
      },
      label: '需要配置 API Key 的用户等级排除列表',
      sortOrder: 4,
    },

    // ========== scope: route:user-api-keys ==========
    {
      scope: 'route:user-api-keys',
      key: 'standard_providers',
      value: [
        { value: 'openai', label: 'OpenAI', types: ['llm', 'image'], models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', '自定义'] },
        { value: 'deepseek', label: 'DeepSeek', types: ['llm'], models: ['deepseek-chat', 'deepseek-reasoner', '自定义'] },
        { value: 'siliconflow', label: '硅基流动', types: ['llm', 'image', 'tts'], models: ['自定义'] },
        { value: 'volcengine', label: '火山引擎', types: ['llm', 'image', 'video', 'tts'], models: ['doubao-seed-2-0-mini', 'doubao-seedream-4-5', '自定义'] },
        { value: 'anthropic', label: 'Anthropic Claude', types: ['llm'], models: ['claude-3-5-sonnet', 'claude-3-haiku', '自定义'] },
        { value: 'google', label: 'Google Gemini', types: ['llm'], models: ['gemini-2-5-pro', 'gemini-2-0-flash', '自定义'] },
        { value: 'moonshot', label: '月之暗面 Kimi', types: ['llm'], models: ['moonshot-v1', '自定义'] },
        { value: 'aliyun', label: '阿里通义千问', types: ['llm', 'image', 'video', 'tts'], models: ['qwen-max', 'qwen-plus', '自定义'] },
        { value: 'baidu', label: '百度文心一言', types: ['llm', 'image'], models: ['ernie-4-5', '自定义'] },
      ],
      label: '标准 provider 选项（免费 & VIP 可用）',
      sortOrder: 1,
    },
    {
      scope: 'route:user-api-keys',
      key: 'local_providers',
      value: [
        { value: 'local', label: '本地大模型（VIP 专属）', types: ['llm', 'image'], models: ['Ollama', 'vLLM', '自定义'], vipOnly: true },
      ],
      label: '本地大模型 provider 选项（仅 VIP）',
      sortOrder: 2,
    },
    {
      scope: 'route:user-api-keys',
      key: 'model_type_options',
      value: [
        { value: 'llm', label: '语言大模型' },
        { value: 'image', label: '图片大模型' },
        { value: 'video', label: '视频大模型' },
        { value: 'tts', label: '语音大模型' },
        { value: 'audio', label: '音频大模型' },
      ],
      label: 'modelType 选项列表',
      sortOrder: 3,
    },
    {
      scope: 'route:user-api-keys',
      key: 'vip_exempt_tiers',
      value: ['free', 'basic'],
      label: 'VIP 豁免等级（isVip 判断用）',
      sortOrder: 4,
    },

    // ========== scope: route:system-health ==========
    {
      scope: 'route:system-health',
      key: 'provider_test_configs',
      value: [
        {
          name: 'deepseek',
          displayName: 'DeepSeek',
          envKey: 'DEEPSEEK_API_KEY',
          endpoint: 'https://api.deepseek.com/v1/chat/completions',
          model: 'deepseek-chat',
        },
        {
          name: 'siliconflow',
          displayName: '硅基流动',
          envKey: 'SILICONFLOW_API_KEY',
          endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
          model: 'Qwen/Qwen2.5-7B-Instruct',
        },
        {
          name: 'bailian',
          displayName: '阿里百炼 Qwen',
          envKey: 'ALIYUN_API_KEY',
          envKeyFallback: 'BAILIAN_API_KEY',
          endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          model: 'qwen-plus',
        },
        {
          name: 'kimi',
          displayName: 'Kimi 月之暗面',
          envKey: 'KIMI_API_KEY',
          endpoint: 'https://api.moonshot.cn/v1/chat/completions',
          model: 'moonshot-v1-8k',
          baseUrlEnv: 'KIMI_BASE_URL',
          baseUrlDefault: 'https://api.moonshot.cn/v1',
        },
        {
          name: 'openai',
          displayName: 'OpenAI',
          envKey: 'OPENAI_API_KEY',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o-mini',
        },
      ],
      label: 'Provider 测试端点配置（testProvider 调用）',
      sortOrder: 1,
    },
    {
      scope: 'route:system-health',
      key: 'volcengine_test_config',
      value: {
        name: 'volcengine',
        displayName: '火山豆包',
        envKey: 'VOLCENGINE_API_KEY',
        modelEnv: 'VOLCENGINE_LLM_MODEL',
        defaultModel: 'doubao-seed-2-0-mini-260428',
        baseUrlEnv: 'VOLCENGINE_BASE_URL',
        baseUrlDefault: 'https://ark.cn-beijing.volces.com/api/v3',
      },
      label: '火山引擎测试端点配置',
      sortOrder: 2,
    },
    {
      scope: 'route:system-health',
      key: 'system_health_thresholds',
      value: {
        cpuLoadDegraded: 0.8,
        llmLoadDegraded: 0.8,
        queueSizeBusy: 10,
      },
      label: '系统健康状态阈值',
      sortOrder: 3,
    },
    {
      scope: 'route:system-health',
      key: 'env_keys_to_mask',
      value: [
        'DEEPSEEK_API_KEY',
        'SILICONFLOW_API_KEY',
        'ALIYUN_API_KEY',
        'BAILIAN_API_KEY',
        'KIMI_API_KEY',
        'OPENAI_API_KEY',
        'VOLCENGINE_API_KEY',
      ],
      label: '脱敏显示的环境变量列表',
      sortOrder: 4,
    },
    {
      scope: 'route:system-health',
      key: 'env_volcengine_model_keys',
      value: {
        volcengineLlmModel: 'VOLCENGINE_LLM_MODEL',
        volcengineImageModel: 'VOLCENGINE_IMAGE_MODEL',
        volcengineVideoModel: 'VOLCENGINE_VIDEO_MODEL',
      },
      label: '火山引擎模型环境变量映射',
      sortOrder: 5,
    },

    // ========== scope: route:ai-router-service ==========
    {
      scope: 'route:ai-router-service',
      key: 'magic_numbers',
      value: {
        initialConfidence: 0.95,
        defaultLatencyScore: 0.9,
        defaultCostScore: 0.9,
        loadRatioThreshold: 0.8,
        loadPenaltyMultiplier: 0.5,
      },
      label: 'AI Router 评分引擎魔数',
      sortOrder: 1,
    },
    {
      scope: 'route:ai-router-service',
      key: 'latency_thresholds',
      value: {
        video: 120,
        image: 20,
        tts: 5,
        default: 10,
      },
      label: '模型类型延迟阈值（秒）',
      sortOrder: 2,
    },
  ]

  for (const cfg of routeConfigs) {
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: cfg.scope, key: cfg.key } },
      update: { value: cfg.value, label: cfg.label, sortOrder: cfg.sortOrder, isActive: true },
      create: {
        scope: cfg.scope,
        key: cfg.key,
        value: cfg.value,
        label: cfg.label,
        sortOrder: cfg.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`✅ Seeded ${routeConfigs.length} route config entries`)

  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
