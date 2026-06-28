// ─── Bootstrap Engine — 火麒麟 AI Production Studio 项目初始化引擎 ───
// 初始化：项目数据、角色系统、剧情树、服装系统、导演决策、工作流引擎、Agent系统

import { useProjectStore, type ProjectInfo, type ProjectType, type ProjectCharacter, type EpisodeData, type SceneData, type ShotData, type CostumeConfig, type DirectorDecision } from '~/stores/projectStore'
import { usePipelineStore } from '~/stores/pipelineStore'

export interface BootstrapConfig {
  name: string
  description: string
  type: ProjectType
  style: string
  targetPlatform: string
  aspectRatio: string
  duration: number
  outputQuality: string
  mode: 'auto' | 'semi-auto' | 'professional'
  models: {
    image: string
    video: string
    llm: string
  }
}

export interface BootstrapResult {
  project: ProjectInfo
  defaultCharacter: ProjectCharacter
  defaultEpisode: EpisodeData
}

// ─── Default DNA profiles per project type ────────
const TYPE_DNA: Record<ProjectType, { charName: string; charGender: 'male' | 'female' | 'other'; dna: Record<string, any>; storyTheme: string }> = {
  drama: {
    charName: '主角',
    charGender: 'male',
    dna: { archetype: 'hero', temperament: 'determined', backstory: '平凡中崛起', speakingStyle: '简洁有力' },
    storyTheme: '热血成长',
  },
  portrait: {
    charName: '模特',
    charGender: 'female',
    dna: { archetype: 'model', temperament: 'elegant', style: '时尚大片', lighting: '自然光' },
    storyTheme: '写真集',
  },
  anime: {
    charName: '主角',
    charGender: 'male',
    dna: { archetype: 'protagonist', temperament: 'passionate', animeStyle: '日式热血', colorPalette: '高饱和' },
    storyTheme: '奇幻冒险',
  },
  cinematic: {
    charName: '演员',
    charGender: 'male',
    dna: { archetype: 'dramatic', temperament: 'intense', filmStyle: '电影感', aspectInfluence: '宽银幕' },
    storyTheme: '电影叙事',
  },
  ad: {
    charName: '品牌代言',
    charGender: 'female',
    dna: { archetype: 'spokesperson', temperament: 'professional', brandStyle: '高端简约', focalPoint: '产品' },
    storyTheme: '品牌故事',
  },
  shopping: {
    charName: '主播',
    charGender: 'female',
    dna: { archetype: 'host', temperament: 'energetic', salesStyle: '信任感', interactionType: '直面镜头' },
    storyTheme: '产品种草',
  },
}

// ─── Default model configurations (从后端推荐模型动态获取) ────────
let defaultModelsCache: { image: string; video: string; llm: string } | null = null

async function getDefaultModels(): Promise<{ image: string; video: string; llm: string }> {
  if (defaultModelsCache) return defaultModelsCache
  const res = await fetch('/api/v1/models/available')
  if (!res.ok) throw new Error(`获取模型列表失败: HTTP ${res.status}`)
  const data = await res.json()
  const models = data.models || []
  const llm = models.find((m: any) => m.type === 'llm' && m.recommended) || models.find((m: any) => m.type === 'llm')
  const image = models.find((m: any) => m.type === 'image' && m.recommended) || models.find((m: any) => m.type === 'image')
  const video = models.find((m: any) => m.type === 'video' && m.recommended) || models.find((m: any) => m.type === 'video')
  if (!llm || !image || !video) throw new Error('后端未返回完整模型列表，请联系管理员')
  defaultModelsCache = {
    llm: llm.id,
    image: image.id,
    video: video.id,
  }
  return defaultModelsCache!
}

const STYLE_OPTIONS: Record<ProjectType, string[]> = {
  drama: ['热血', '悬疑', '爱情', '喜剧', '古装', '科幻'],
  portrait: ['古风', '现代', '科幻', '梦幻', '复古', '户外'],
  anime: ['热血', '奇幻', '校园', '机甲', '治愈', '悬疑'],
  cinematic: ['史诗', '文艺', '悬疑', '动作', '爱情', '战争'],
  ad: ['简约', '奢华', '科技', '自然', '情感', '潮酷'],
  shopping: ['生活', '美妆', '数码', '美食', '穿搭', '家居'],
}

const PLATFORM_OPTIONS: Record<ProjectType, string[]> = {
  drama: ['抖音', '快手', '视频号', 'B站', '小红书', 'YouTube'],
  portrait: ['小红书', '微博', '朋友圈', '图虫', '500px'],
  anime: ['B站', '抖音', 'AcFun', 'Youtube', 'Netflix'],
  cinematic: ['院线', '电影节', 'B站', 'Youtube', 'Vimeo'],
  ad: ['抖音', '微博', '微信', 'B站', 'Youtube', '电视'],
  shopping: ['抖音', '快手', '淘宝', '拼多多', '视频号'],
}

export function getProjectTypeOptions(type: ProjectType) {
  return {
    styles: STYLE_OPTIONS[type] || [],
    platforms: PLATFORM_OPTIONS[type] || [],
  }
}

function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Bootstrap Engine ─────────────────────────────
export async function bootstrapEngine(config: BootstrapConfig): Promise<BootstrapResult> {
  const projectStore = useProjectStore()
  const pipelineStore = usePipelineStore()

  // 0. 重置所有旧数据（确保新项目不混入旧内容）
  projectStore.resetProject()

  // 1. 初始化项目数据
  const project = projectStore.addProject({
    ...config,
    progress: 0,
    videoCount: 0,
    aiScore: 0,
  })

  await pipelineStore.hydratePipeline(project.id)
  pipelineStore.setProject(project.id)
  pipelineStore.enterStage('story')

  // 2. 初始化角色系统（主角色 + 默认DNA + 记忆系统）
  const typeDna = TYPE_DNA[config.type] || TYPE_DNA.drama
  const defaultCharacter: ProjectCharacter = {
    id: generateId('char-'),
    name: typeDna.charName,
    gender: typeDna.charGender,
    dna: {
      ...typeDna.dna,
      projectType: config.type,
      createdAt: new Date().toISOString(),
    },
    memory: [],
    costumeIds: [],
  }
  projectStore.addCharacter(defaultCharacter)

  // 3. 初始化剧情树（默认 Episode/Scene/Shot 骨架）
  const defaultEpisode: EpisodeData = {
    id: generateId('ep-'),
    index: 1,
    title: `第1集`,
    scenes: [
      {
        id: generateId('sc-'),
        episodeId: '', // will be set
        index: 1,
        title: `开场`,
        location: '主场景',
        shots: [
          {
            id: generateId('sh-'),
            sceneId: '',
            index: 1,
            duration: 5,
            shotType: 'wide',
            description: '开场全景，建立场景氛围',
            status: 'pending',
          },
          {
            id: generateId('sh-'),
            sceneId: '',
            index: 2,
            duration: 3,
            shotType: 'medium',
            description: '主角中景，引入角色',
            status: 'pending',
          },
          {
            id: generateId('sh-'),
            sceneId: '',
            index: 3,
            duration: 4,
            shotType: 'close-up',
            description: '特写镜头，突出情感',
            status: 'pending',
          },
        ],
      },
    ],
  }

  // Wire up IDs
  defaultEpisode.scenes.forEach(sc => {
    sc.episodeId = defaultEpisode.id
    sc.shots.forEach(sh => { sh.sceneId = sc.id })
  })

  projectStore.addEpisode(defaultEpisode)
  pipelineStore.setStageStatus('story', 'completed')

  // 4. 初始化服装系统
  const defaultCostumes: CostumeConfig[] = [
    {
      id: generateId('cos-'),
      characterId: defaultCharacter.id,
      name: '默认装扮',
      styleTag: config.type === 'anime' ? 'casual' : config.type === 'portrait' ? 'luxury' : 'formal',
      continuityAnchored: true,
      sceneBindings: [],
    },
  ]
  defaultCostumes.forEach(c => projectStore.addCostume(c))
  defaultCharacter.costumeIds = defaultCostumes.map(c => c.id)

  // 5. 导演决策（镜头语言 + 运镜规则 + 节奏规则）
  const directorDecision: DirectorDecision = {
    cameraLanguage: config.type === 'cinematic' ? 'cinematic' : config.type === 'anime' ? 'dynamic' : 'standard',
    cameraMovementRules: ['平稳推进', '叙事性运镜', '情感引导'],
    pacingRules: config.type === 'shopping' ? '快节奏' : config.type === 'drama' ? '渐进式' : '标准节奏',
    emotionProfile: config.type === 'drama' ? '先静后动' : config.type === 'ad' ? '情绪共鸣' : '自然过渡',
    styleInfluence: typeDna.storyTheme,
  }
  projectStore.setDirectorDecision(directorDecision)

  // 6. 初始化工作流引擎
  const workflowSteps = [
    'Prompt 编写',
    '故事板生成',
    '镜头规划',
    '图片生成',
    '视频生成',
    '字幕合成',
    '导出发布',
  ]
  projectStore.initWorkflow(workflowSteps)

  // 7. 初始化 Agent 系统
  projectStore.setAgentStatus('directorAgent', 'standby', false)
  projectStore.setAgentStatus('writerAgent', 'standby', false)
  projectStore.setAgentStatus('cameraAgent', 'standby', false)

  // Pipeline advance — story stage completed
  pipelineStore.setStageStatus('story', 'completed')
  localStorage.setItem('pipeline_rehydrated', 'true')

  projectStore.updateStatus(project.id, 'planning')

  // 8. 持久化到 localStorage（避免页面跳转后 Pinia 重置丢失数据）
  try {
    const saveData = {
      project: projectStore.currentProject,
      characters: projectStore.characters,
      episodes: projectStore.episodes,
      costumes: projectStore.costumes,
      directorDecision: projectStore.directorDecision,
      workflow: projectStore.workflow,
      agentState: projectStore.agentState,
    }
    localStorage.setItem(`firekirin_autosave_${project.id}`, JSON.stringify(saveData))
  } catch (e) {
    // localStorage full, ignore
  }

  return { project, defaultCharacter, defaultEpisode }
}
