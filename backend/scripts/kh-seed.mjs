// AI Knowledge Hub — Seed Data
// 创建初始演示数据，确保 Dashboard 不为空

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('[KH-Seed] 🌱 Starting Knowledge Hub seed...');

  // 检查是否已有数据
  const existingBrands = await prisma.knowledgeBrand.count();
  if (existingBrands > 0) {
    console.log(`[KH-Seed] ⏭️  Brands already exist (${existingBrands}), skipping seed`);
    return;
  }

  // 创建品牌
  const brand = await prisma.knowledgeBrand.create({
    data: {
      name: '昆仑镜',
      industry: 'AI / 人工智能',
      description: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。',
      website: 'https://aigc.fushtn.com',
      mission: '让每个人都能创作影视级短剧',
      vision: '成为全球领先的 AI 短剧创作平台',
      values: ['创新', '用户至上', '品质第一'],
    },
  });
  console.log(`[KH-Seed] ✅ Created brand: ${brand.name}`);

  // 创建产品
  const product = await prisma.knowledgeProduct.create({
    data: {
      brandId: brand.id,
      name: '昆仑镜短剧工作台',
      description: 'AI 驱动的短剧创作全流程管理平台',
      features: ['AI 剧本生成', '多角色管理', '场景分镜', '一键视频生成'],
      pricing: '基础版免费，专业版 ¥199/月',
      useCases: ['短剧创作', '广告制作', '教育培训'],
    },
  });
  console.log(`[KH-Seed] ✅ Created product: ${product.name}`);

  // 创建知识文章
  const articleTypes = ['article', 'case_study', 'glossary', 'tutorial'];
  for (let i = 0; i < 4; i++) {
    await prisma.knowledgeArticle.create({
      data: {
        type: articleTypes[i],
        title: [
          '昆仑镜平台架构介绍',
          '使用昆仑镜创作 3 分钟短剧',
          'AI 视频生成术语表',
          '快速入门教程'
        ][i],
        content: `这是${['平台架构介绍', '案例研究', '术语表', '入门教程'][i]}的示例内容。`,
        category: i === 0 ? '技术文档' : i === 1 ? '案例' : i === 2 ? '参考' : '教程',
        tags: i === 0 ? ['架构', 'AI视频'] : i === 1 ? ['短剧', '案例'] : i === 2 ? ['术语'] : ['教程', '入门'],
        status: 'published',
      },
    });
  }
  console.log(`[KH-Seed] ✅ Created 4 articles`);

  // 创建实体
  const entities = [
    { type: 'Brand', name: '昆仑镜', description: 'AI 短剧创作平台' },
    { type: 'Product', name: '短剧工作台', description: '核心产品' },
    { type: 'Technology', name: 'AI 视频生成引擎', description: '核心技术' },
    { type: 'Industry', name: 'AI 视频生成', description: '所属行业' },
  ];
  for (const entity of entities) {
    await prisma.knowledgeEntity.create({
      data: {
        type: entity.type,
        name: entity.name,
        description: entity.description,
        aliases: [],
        relations: [],
        knowledgeSignals: [{ type: 'category', text: `实体类型: ${entity.type}`, importance: 'High' }],
      },
    });
  }
  console.log(`[KH-Seed] ✅ Created ${entities.length} entities`);

  // 创建发布记录
  const pub = await prisma.knowledgePublication.create({
    data: {
      type: 'jsonld',
      status: 'published',
      target: 'https://aigc.fushtn.com',
      content: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: '昆仑镜',
        applicationCategory: 'Multimedia',
      }),
      publishedAt: new Date(),
    },
  });
  console.log(`[KH-Seed] ✅ Created publication: ${pub.type}`);

  console.log('[KH-Seed] 🌱 Seed complete!');
}

seed()
  .catch(e => {
    console.error('[KH-Seed] ❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
