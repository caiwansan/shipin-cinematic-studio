// 中国行政区划数据导入脚本
// 数据来源: china-area-data (国家标准 GB/T 2260)
// 用法: npx tsx prisma/seed-regions.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 使用动态 import 加载 china-area-data
  const data = require('china-area-data')

  console.log('开始导入中国行政区划数据...')

  // 1. 先导入省份 (key '86')
  const provinces = data['86'] || {}
  let provinceCount = 0
  let cityCount = 0
  let districtCount = 0

  for (const [code, name] of Object.entries(provinces)) {
    await prisma.chinaRegion.upsert({
      where: { code },
      update: { name: name as string, level: 1 },
      create: { code, name: name as string, level: 1 },
    })
    provinceCount++

    // 2. 导入对应市
    const cities = data[code] || {}
    for (const [cityCode, cityName] of Object.entries(cities)) {
      await prisma.chinaRegion.upsert({
        where: { code: cityCode },
        update: { name: cityName as string, level: 2, parentCode: code },
        create: { code: cityCode, name: cityName as string, level: 2, parentCode: code },
      })
      cityCount++

      // 3. 导入对应区县
      const districts = data[cityCode] || {}
      for (const [distCode, distName] of Object.entries(districts)) {
        await prisma.chinaRegion.upsert({
          where: { code: distCode },
          update: { name: distName as string, level: 3, parentCode: cityCode },
          create: { code: distCode, name: distName as string, level: 3, parentCode: cityCode },
        })
        districtCount++
      }
    }
  }

  console.log(`导入完成：${provinceCount} 省/直辖市 + ${cityCount} 市 + ${districtCount} 区县 = ${provinceCount + cityCount + districtCount} 条记录`)
}

main()
  .catch((e) => {
    console.error('导入失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
