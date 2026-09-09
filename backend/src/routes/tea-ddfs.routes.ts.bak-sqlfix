// tea-ddfs.routes.ts — 分布式文件存储(设备级, 轻中心化)
// 平台 = 只中继 + 只存元数据(合规); 不持久存完整文件/切片。
// 每个用户贡献 10G 作为“节点”存储(平台分配/送达切片, 强制额度; 贡献者看不到切片=切片加密)。
// 每份文件多副本 × 冗余分片(Reed-Solomon), 防止个别存储节点离线取不回。
// 找回: 源文件用户凭助记词(本地派生)提供 rootHash → 平台 locate 分片位置 → 中继取回 → 本地恢复显示。
import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'

const NODE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024 // 每用户贡献 10G
const RELAY_TTL_MS = 60 * 60 * 1000 // 中继暂存 1h(只中继不持久)

// 中继暂存: nodeUid -> [{sliceId, rootHash, sliceIdx, subHash, encrypted, size, ts}]
const relayBuffer = new Map<string, { rootHash: string; sliceIdx: number; subHash: string; encrypted: string; size: number; ts: number }[]>()
const relaySeen = new Set<string>() // 已送达确认, 防重复
// 文件级中继暂存(每个 rootHash 的加密切片; 1h 过期注销, 平台不持久化)
const fileRelay = new Map<string, { slices: { sliceIdx: number; subHash: string; encrypted: string; size: number }[]; ts: number }>()

export default async function teaDdfsRoutes(fastify: FastifyInstance) {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ddfs_nodes (
    uid TEXT PRIMARY KEY,
    quota_used_bytes BIGINT DEFAULT 0,
    last_seen TIMESTAMPTZ DEFAULT now()
  )`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ddfs_files (
    root_hash TEXT PRIMARY KEY,
    owner_uid TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    slice_count INT DEFAULT 0,
    replicas INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
  )`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ddfs_slices (
    id TEXT PRIMARY KEY,
    root_hash TEXT NOT NULL,
    slice_idx INT DEFAULT 0,
    sub_hash TEXT DEFAULT '',
    node_uid TEXT NOT NULL,
    owner_uid TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
  )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ddfs_slices_root ON ddfs_slices(root_hash)`)

  const uidOf = (req: any): string => (req.user as any)?.id || (req.user as any)?.userId || ''

  // ---------- 节点心跳(贡献者设备上报在线) ----------
  fastify.post('/api/ddfs/node/heartbeat', { preHandler: [fastify.authenticate] }, async (req: any) => {
    const uid = uidOf(req)
    // 清过期中继
    const now = Date.now()
    for (const [k, arr] of [...relayBuffer.entries()]) { if (arr.every(s => now - s.ts > RELAY_TTL_MS)) relayBuffer.delete(k) }
    await prisma.$executeRawUnsafe(
      `INSERT INTO ddfs_nodes (uid, quota_used_bytes, last_seen) VALUES ($1, 0, now())
       ON CONFLICT (uid) DO UPDATE SET last_seen = now()`, uid)
    return { success: true, data: { quotaBytes: NODE_QUOTA_BYTES } }
  })

  // ---------- 发布(源文件用户上传切片 → 平台分配 + 中继投递) ----------
  fastify.post('/api/ddfs/publish', { preHandler: [fastify.authenticate] }, async (req: any, reply: FastifyReply) => {
    const owner = uidOf(req)
    const { rootHash, size, sliceCount, replicas, slices } = (req.body as any) || {}
    if (!rootHash || !Array.isArray(slices) || slices.length === 0) return reply.status(400).send({ success: false, error: 'rootHash/slices 必填' })
    const rep = Math.min(Math.max(Number(replicas) || 1, 1), 3)
    // 元数据(平台只存元数据, 不存切片)
    await prisma.$executeRawUnsafe(
      `INSERT INTO ddfs_files (root_hash, owner_uid, size, slice_count, replicas, created_at) VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (root_hash) DO UPDATE SET replicas = $5`, rootHash, owner, Number(size) || 0, Number(sliceCount) || slices.length, rep)
    // 为每片×每副本 分配在线节点(额度强制)
    const placements: Record<number, string[]> = {} // sliceIdx -> [nodeUid...]
    for (const s of slices) {
      const idx = Number(s.sliceIdx); const assigned: string[] = []
      for (let r = 0; r < Math.min(rep, 3); r++) {
        const node = await pickNode(Number(s.size) || 0)
        if (!node) break
        await prisma.$executeRawUnsafe(
          `INSERT INTO ddfs_slices (id, root_hash, slice_idx, sub_hash, node_uid, owner_uid, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())
           ON CONFLICT (id) DO NOTHING`,
          `${rootHash}_${idx}_${r}`, rootHash, idx, String(s.subHash || ''), node, owner)
        // 中继: 投递给该节点
        pushRelay(node, { rootHash, sliceIdx: idx, subHash: String(s.subHash || ''), encrypted: String(s.encrypted || ''), size: Number(s.size) || 0, ts: Date.now() })
        await bumpQuota(node, Number(s.size) || 0)
        assigned.push(node)
      }
      // 文件级中继暂存(供找回方 fetch; 1h 过期, 不持久)
      const fr = fileRelay.get(rootHash) || { slices: [], ts: Date.now() }
      if (Date.now() - fr.ts > RELAY_TTL_MS) { fr.slices = []; fr.ts = Date.now() }
      if (!fr.slices.find(x => x.sliceIdx === idx)) fr.slices.push({ sliceIdx: idx, subHash: String(s.subHash||''), encrypted: String(s.encrypted||''), size: Number(s.size)||0 })
      fileRelay.set(rootHash, fr)
      placements[idx] = assigned
    }
    return { success: true, data: { rootHash, placements, replicas: rep } }
  })

  // ---------- 贡献节点拉取待投递切片(中继出口) ----------
  fastify.post('/api/ddfs/pending', { preHandler: [fastify.authenticate] }, async (req: any) => {
    const uid = uidOf(req)
    const arr = relayBuffer.get(uid) || []
    return { success: true, data: { slices: arr } }
  })

  // ---------- 贡献节点确认已接收(平台清缓存, 不持久) ----------
  fastify.post('/api/ddfs/received', { preHandler: [fastify.authenticate] }, async (req: any) => {
    const uid = uidOf(req)
    const { rootHash, sliceIdx } = (req.body as any) || {}
    const arr = relayBuffer.get(uid)
    if (arr) { const i = arr.findIndex(s => s.rootHash === rootHash && Number(s.sliceIdx) === Number(sliceIdx)); if (i >= 0) arr.splice(i, 1) }
    return { success: true }
  })

  // ---------- 找回: 源文件用户按 rootHash 取回加密切片(平台中继暂存, 1h) ----------
  fastify.post('/api/ddfs/fetch', { preHandler: [fastify.authenticate] }, async (req: any, reply: FastifyReply) => {
    const { rootHash } = (req.body as any) || {}
    if (!rootHash) return reply.status(400).send({ success: false, error: 'rootHash 必填' })
    const fr = fileRelay.get(String(rootHash))
    let count = 0; let origSize = 0
    const metaRows: any[] = await prisma.$queryRawUnsafe(`SELECT size, slice_count FROM ddfs_files WHERE root_hash = $1`, String(rootHash))
    if (metaRows[0]) { origSize = Number(metaRows[0].size) || 0; count = Number(metaRows[0].slice_count) || 0 }
    if (!fr || Date.now() - fr.ts > RELAY_TTL_MS) return { success: true, data: { slices: [], expired: true, count, origSize } }
    return { success: true, data: { slices: fr.slices, expired: false, count, origSize } }
  })

  // ---------- 找回: 定位分片(源文件用户凭 rootHash) ----------
  fastify.post('/api/ddfs/locate', { preHandler: [fastify.authenticate] }, async (req: any, reply: FastifyReply) => {
    const { rootHash } = (req.body as any) || {}
    if (!rootHash) return reply.status(400).send({ success: false, error: 'rootHash 必填' })
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT slice_idx, node_uid, sub_hash FROM ddfs_slices WHERE root_hash = $1 ORDER BY slice_idx`, rootHash)
    const byIdx: Record<number, { nodeUid: string; subHash: string }[]> = {}
    for (const r of rows) {
      const i = Number(r.slice_idx); (byIdx[i] = byIdx[i] || []).push({ nodeUid: r.node_uid, subHash: r.sub_hash || '' })
    }
    return { success: true, data: { rootHash, slices: byIdx } }
  })

  // ---------- 管理员/合规: 元数据(ddfs_files) ----------
  fastify.get('/api/ddfs/meta/:rootHash', { preHandler: [fastify.authenticate] }, async (req: any) => {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT root_hash, owner_uid, size, slice_count, replicas, created_at FROM ddfs_files WHERE root_hash = $1`, String((req.params as any).rootHash))
    return { success: true, data: { file: rows[0] || null, nodeCount: await prisma.ddfs_nodes?.count?.() ?? (await prisma.$queryRawUnsafe(`SELECT COUNT(*) c FROM ddfs_nodes`))[0].c } }
  })

  // ---------- helpers ----------
  async function pickNode(sliceSize: number): Promise<string | null> {
    // 在线节点(近5分钟内)中, 额度未满且剩余>sliceSize 的; 优先剩余多的
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT uid, quota_used_bytes FROM ddfs_nodes WHERE last_seen > now() - interval '5 minutes' AND quota_used_bytes + $1 <= $2 ORDER BY quota_used_bytes ASC LIMIT 1`,
      Number(sliceSize) || 0, NODE_QUOTA_BYTES)
    return rows[0]?.uid || null
  }
  async function bumpQuota(uid: string, bytes: number) {
    await prisma.$executeRawUnsafe(`UPDATE ddfs_nodes SET quota_used_bytes = quota_used_bytes + $1, last_seen = now() WHERE uid = $2`, Number(bytes) || 0, uid)
  }
  function pushRelay(uid: string, item: any) {
    const arr = relayBuffer.get(uid) || []; arr.push(item); relayBuffer.set(uid, arr)
  }
}
