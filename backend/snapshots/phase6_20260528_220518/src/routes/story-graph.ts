import type { ApiResponse } from '../contracts/api/base.js';
// ══════════════════════════════════════════════════
// 火麒麟AI导演控制台 — Story Graph 引擎 + 自动分镜系统
// @story-graph-rule: AI must generate StoryGraph before any Shot generation
// @story-graph-rule: Shot generation must strictly follow graph structure
// @story-graph-rule: no direct script-to-video skipping allowed
// ══════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'

// ─── Types ──────────────────────────────────────────────────────

interface StoryNode {
  id: string
  sceneId?: string
  characters: string[]
  emotionState?: string
  location?: string
  timeFlow?: string
  narrativeWeight: number
  event: string
}

interface StoryEdge {
  fromNode: string
  toNode: string
  relationType: 'cause' | 'follow' | 'contrast' | 'parallel'
  emotionTransition?: string
}

interface StoryGraph {
  id: string
  title: string
  nodes: StoryNode[]
  edges: StoryEdge[]
}

interface ShotNode {
  shotId: string
  nodeId: string
  type: 'wide' | 'medium' | 'close' | 'detail' | 'motion'
  cameraMovement?: string
  composition?: string
  durationEstimate: number
  emotionTag?: string
  characterBinding?: string
  sceneBinding?: string
  propBinding?: string
  costumeBinding?: string
}

// ─── In-memory store ────────────────────────────────────────────
const graphs: Map<string, StoryGraph> = new Map()
const shotSequences: Map<string, ShotNode[]> = new Map()

let graphCounter = 0
let shotCounter = 0

// ─── Helper: generate ID ────────────────────────────────────────
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Helper: parse novel text into StoryGraph ───────────────────
function parseTextToGraph(text: string): StoryGraph {
  const id = genId('sg')
  graphCounter++

  // Split into sentences/paragraphs as nodes
  const sentences = text
    .split(/[。！？\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 2)

  const nodes: StoryNode[] = sentences.map((sentence, idx) => {
    // Extract character mentions (simple heuristic)
    const charPatterns = [
      /([^，。！？\s，。！？]{1,4}(?:哥|姐|爷|妹|弟|叔|伯|公|婆|生|士|者|将|军|主|王|帝|后|妃|子|儿|女))/g,
      /([\u4e00-\u9fff]{2,4})/g,
    ]
    const chars: string[] = []
    for (const pattern of charPatterns) {
      const matches = sentence.match(pattern)
      if (matches) {
        for (const m of matches) {
          const clean = m.trim()
          if (clean.length >= 2 && !chars.includes(clean)) {
            chars.push(clean)
          }
        }
      }
    }

    // Determine approximate location
    const locationWords = ['办公室', '房间', '街道', '公园', '河边', '山顶', '海边', '车内', '屋里',
      '天台', '地铁', '商场', '学校', '医院', '餐厅', '酒吧', '夜店', '森林', '沙漠', '城堡']
    let location: string | undefined
    for (const loc of locationWords) {
      if (sentence.includes(loc)) {
        location = loc
        break
      }
    }

    // Determine emotion state
    const emotionWords: [string, string][] = [
      ['生气', 'angry'], ['愤怒', 'angry'], ['怒', 'angry'],
      ['高兴', 'happy'], ['开心', 'happy'], ['笑', 'happy'], ['快乐', 'happy'],
      ['悲伤', 'sad'], ['哭', 'sad'], ['难过', 'sad'], ['伤心', 'sad'],
      ['焦虑', 'anxious'], ['紧张', 'anxious'], ['不安', 'anxious'],
      ['惊讶', 'surprised'], ['震惊', 'surprised'], ['吓', 'fearful'], ['恐惧', 'fearful'],
      ['冷静', 'calm'], ['平静', 'calm'], ['淡定', 'calm'],
      ['激动', 'excited'], ['兴奋', 'excited'], ['热烈', 'excited'],
    ]
    let emotion: string | undefined
    for (const [word, emo] of emotionWords) {
      if (sentence.includes(word)) {
        emotion = emo
        break
      }
    }

    // Narrative weight based on length and content complexity
    let weight = 3 + Math.floor(sentence.length / 20)
    if (emotion) weight += 2
    if (location) weight += 1
    weight = Math.min(10, Math.max(1, weight))

    // Time flow heuristic
    const timeWords = ['清晨', '早晨', '中午', '下午', '傍晚', '黄昏', '夜晚', '深夜', '午夜',
      '春天', '夏天', '秋天', '冬天', '去年', '今年', '明天', '昨天', '此时', '同时']
    let timeFlow: string | undefined
    for (const tw of timeWords) {
      if (sentence.includes(tw)) {
        timeFlow = tw
        break
      }
    }

    return {
      id: `node-${idx}`,
      characters: chars.length > 0 ? chars : ['未知角色'],
      emotionState: emotion,
      location,
      timeFlow,
      narrativeWeight: weight,
      event: sentence.length > 40 ? sentence.slice(0, 40) + '...' : sentence,
    }
  })

  // Generate edges between consecutive nodes
  const edges: StoryEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const fromNode = nodes[i]
    const toNode = nodes[i + 1]

    // Determine relation type
    let relationType: 'cause' | 'follow' | 'contrast' | 'parallel' = 'follow'

    // Check for contrast (opposite emotions or locations)
    if (fromNode.emotionState && toNode.emotionState && fromNode.emotionState !== toNode.emotionState) {
      const negativeEmotions = ['angry', 'sad', 'fearful', 'anxious']
      const positiveEmotions = ['happy', 'excited', 'calm']
      if (
        (negativeEmotions.includes(fromNode.emotionState) && positiveEmotions.includes(toNode.emotionState)) ||
        (positiveEmotions.includes(fromNode.emotionState) && negativeEmotions.includes(toNode.emotionState))
      ) {
        relationType = 'contrast'
      }
    }

    // Check for cause (causality words)
    const causeWords = ['因为', '所以', '因此', '导致', '引发', '于是', '从此', '结果']
    if (causeWords.some(w => toNode.event.includes(w) || fromNode.event.includes(w))) {
      relationType = 'cause'
    }

    // Emotion transition
    let emotionTransition: string | undefined
    if (fromNode.emotionState && toNode.emotionState && fromNode.emotionState !== toNode.emotionState) {
      emotionTransition = `${fromNode.emotionState} → ${toNode.emotionState}`
    }

    edges.push({
      fromNode: fromNode.id,
      toNode: toNode.id,
      relationType,
      emotionTransition,
    })
  }

  const graph: StoryGraph = {
    id,
    title: `剧情图谱 #${graphCounter} — ${nodes.length}个节点`,
    nodes,
    edges,
  }

  // Store
  graphs.set(id, graph)

  return graph
}

// ─── Helper: generate shot sequence from StoryGraph ────────────
function generateShotsFromGraph(graph: StoryGraph): ShotNode[] {
  const shots: ShotNode[] = []
  shotCounter++

  for (const node of graph.nodes) {
    // Determine shot type based on narrative weight and emotion
    const shotTypes: Array<'wide' | 'medium' | 'close' | 'detail' | 'motion'> =
      ['wide', 'medium', 'close', 'detail', 'motion']

    let type: 'wide' | 'medium' | 'close' | 'detail' | 'motion'
    if (node.narrativeWeight >= 8) {
      type = 'motion'
    } else if (node.narrativeWeight >= 6) {
      type = 'close'
    } else if (node.narrativeWeight >= 4) {
      type = 'medium'
    } else {
      type = 'wide'
    }

    // Camera movement based on emotion
    let cameraMovement: string | undefined
    if (node.emotionState === 'angry' || node.emotionState === 'excited') {
      cameraMovement = '急推/摇晃'
    } else if (node.emotionState === 'sad' || node.emotionState === 'calm') {
      cameraMovement = '缓慢推进'
    } else if (node.emotionState === 'fearful' || node.emotionState === 'anxious') {
      cameraMovement = '手持抖动'
    } else {
      cameraMovement = '固定机位'
    }

    // Composition
    const compositionOptions = [
      '三分法构图', '中心构图', '对角线构图', '框架构图',
      '对称构图', '引导线构图', '黄金比例', '特写填充',
    ]
    const composition = compositionOptions[Math.floor(Math.random() * compositionOptions.length)]

    // Duration estimate (1-10 seconds based on weight)
    const durationEstimate = Math.max(1, Math.min(10, node.narrativeWeight * 1.2))

    // Emotion tag
    let emotionTag: string | undefined
    if (node.emotionState) {
      const tagMap: Record<string, string> = {
        happy: '喜悦', sad: '悲伤', angry: '愤怒', calm: '平静',
        anxious: '焦虑', excited: '激动', fearful: '恐惧', surprised: '惊讶',
      }
      emotionTag = tagMap[node.emotionState] || node.emotionState
    }

    const shot: ShotNode = {
      shotId: `shot-${shotCounter}-${node.id}`,
      nodeId: node.id,
      type,
      cameraMovement,
      composition,
      durationEstimate: Math.round(durationEstimate * 10) / 10,
      emotionTag,
      characterBinding: node.characters[0],
      sceneBinding: node.location,
      propBinding: undefined,
      costumeBinding: undefined,
    }

    shots.push(shot)
  }

  // Store
  const seqId = graph.id
  shotSequences.set(seqId, shots)

  return shots
}

// ─── Route Registration ─────────────────────────────────────────
export default async function storyGraphRoutes(fastify: FastifyInstance) {
  // @story-graph-rule: AI must generate StoryGraph before any Shot generation

  // ── POST /api/v1/story-graph/parse ──────────────────────────────
  fastify.post('/api/v1/story-graph/parse', async (request, reply) => {
    const { text } = request.body as { text?: string }

    if (!text || text.trim().length === 0) {
      return reply.status(400).send({ success: false, message: '请提供需要解析的文本内容' })
    }

    try {
      const graph = parseTextToGraph(text)
      return {
        success: true,
        data: graph,
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: `解析失败: ${err.message}` })
    }
  })

  // ── GET /api/v1/story-graph/:id ─────────────────────────────────
  fastify.get('/api/v1/story-graph/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const graph = graphs.get(id)

    if (!graph) {
      return reply.status(404).send({ success: false, message: '未找到该剧情图谱' })
    }

    return { success: true, data: graph } satisfies ApiResponse<unknown>;

  })

  // @story-graph-rule: Shot generation must strictly follow graph structure

  // ── POST /api/v1/story-graph/generate-shots ────────────────────
  fastify.post('/api/v1/story-graph/generate-shots', async (request, reply) => {
    const { graphId } = request.body as { graphId?: string }

    if (!graphId) {
      return reply.status(400).send({ success: false, message: '请提供剧情图谱ID' })
    }

    const graph = graphs.get(graphId)
    if (!graph) {
      return reply.status(404).send({ success: false, message: '未找到该剧情图谱，请先解析文本' })
    }

    try {
      const shots = generateShotsFromGraph(graph)
      return {
        success: true,
        data: {
          graphId,
          totalShots: shots.length,
          totalDuration: shots.reduce((acc, s) => acc + s.durationEstimate, 0).toFixed(1),
          shots,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: `分镜生成失败: ${err.message}` })
    }
  })

  // ── GET /api/v1/story-graph/:id/shots ───────────────────────────
  fastify.get('/api/v1/story-graph/:id/shots', async (request, reply) => {
    const { id } = request.params as { id: string }
    const shots = shotSequences.get(id)

    if (!shots) {
      return reply.status(404).send({ success: false, message: '未找到该图谱生成的镜头序列' })
    }

    return { success: true, data: shots } satisfies ApiResponse<unknown>;

  })

  // @story-graph-rule: no direct script-to-video skipping allowed

  // ── POST /api/v1/story-graph/regenerate ────────────────────────
  fastify.post('/api/v1/story-graph/regenerate', async (request, reply) => {
    const { text } = request.body as { text?: string }

    if (!text || text.trim().length === 0) {
      return reply.status(400).send({ success: false, message: '请提供需要重新解析的文本内容' })
    }

    try {
      // Parse and generate new graph
      const graph = parseTextToGraph(text)
      const shots = generateShotsFromGraph(graph)

      return {
        success: true,
        data: {
          graph,
          shots: {
            graphId: graph.id,
            totalShots: shots.length,
            totalDuration: shots.reduce((acc, s) => acc + s.durationEstimate, 0).toFixed(1),
            shots,
          },
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: `重新生成失败: ${err.message}` })
    }
  })
}
