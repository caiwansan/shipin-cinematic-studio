// 中国行政区划数据导入脚本
const { PrismaClient } = require('@prisma/client')
const data = require('china-area-data')

const prisma = new PrismaClient()

async function main() {
  console.log('开始导入中国行政区划数据...')
  const provinces = data['86'] || {}
  let total = 0

  for (const [code, name] of Object.entries(provinces)) {
    await prisma.chinaRegion.upsert({
      where: { code },
      update: { name, level: 1 },
      create: { code, name, level: 1 },
    })
    total++

    const cities = data[code] || {}
    for (const [cityCode, cityName] of Object.entries(cities)) {
      await prisma.chinaRegion.upsert({
        where: { code: cityCode },
        update: { name: cityName, level: 2, parentCode: code },
        create: { code: cityCode, name: cityName, level: 2, parentCode: code },
      })
      total++

      const districts = data[cityCode] || {}
      for (const [distCode, distName] of Object.entries(districts)) {
        await prisma.chinaRegion.upsert({
          where: { code: distCode },
          update: { name: distName, level: 3, parentCode: cityCode },
          create: { code: distCode, name: distName, level: 3, parentCode: cityCode },
        })
        total++
      }
    }
  }

  console.log(`导入完成！共 ${total} 条记录`)
}

main()
  .catch((e) => {
    console.error('导入失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
