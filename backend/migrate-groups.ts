import { prisma } from './src/utils/index.js'
import { wkApi, ensureMember } from './src/routes/im.js'
import { groupChannelId, GROUP_CHANNEL_TYPE, GROUP_ROLE_OWNER, GROUP_ROLE_MEMBER } from './src/routes/im-groups.js'
import { BOT_UID } from './src/routes/im-moderation.routes.js'
import data from '/root/groups-export.json'

async function main() {
  for (const g of data.groups as any[]) {
    if (!g.member_count || !g.owner_cloud_uid) { console.log('SKIP', g.id, g.name); continue }
    const chId = groupChannelId(g.id)
    await prisma.imGroup.upsert({
      where: { id: g.id },
      create: { id: g.id, name: g.name, intro: g.intro || '', ownerUid: g.owner_cloud_uid },
      update: {},
    })
    try { await wkApi('/channel', { channel_id: chId, channel_type: GROUP_CHANNEL_TYPE, channel_name: g.name, channel_remark: g.intro || '' }) } catch (e: any) { console.log('channel warn', g.id, e.message) }
    const uids = [...new Set([g.owner_cloud_uid, ...g.members.map((m: any) => m.cloud_uid), BOT_UID])]
    try { await wkApi('/channel/subscriber_add', { channel_id: chId, channel_type: GROUP_CHANNEL_TYPE, subscribers: uids }) } catch (e: any) { console.log('sub warn', g.id, e.message) }
    await ensureMember({ channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid: g.owner_cloud_uid, role: GROUP_ROLE_OWNER, name: '群主', avatar: '' })
    for (const m of g.members as any[]) {
      await ensureMember({ channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid: m.cloud_uid, role: m.role >= 1 ? 1 : GROUP_ROLE_MEMBER, name: m.name || '成员', avatar: m.avatar || '' })
    }
    try { await ensureMember({ channelId: chId, channelType: GROUP_CHANNEL_TYPE, uid: BOT_UID, role: GROUP_ROLE_MEMBER, name: '昆仑镜小管家', avatar: '' }) } catch (e: any) { console.log('bot warn', e.message) }
    console.log('MIGRATED', g.id, g.name, '| kind:', g.kind, '| subscribers:', uids.length)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
