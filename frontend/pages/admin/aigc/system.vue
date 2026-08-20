<template>
  <div class="space-y-6 max-w-4xl">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm text-white/70 font-medium">⚙️ 系统设置</h2>
        <p class="text-[10px] text-gray-600 mt-0.5">平台身份 / SEO / GEO 配置，官网/后台/公开页面统一读取</p>
      </div>
      <button @click="save" :disabled="saving"
        class="px-4 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-50">
        {{ saving ? '保存中...' : '💾 保存' }}
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-1 border-b border-[#1A2240]">
      <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
        class="px-4 py-2 text-xs transition-all border-b-2 -mb-px"
        :class="tab === t.id ? 'text-blue-400 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'">
        {{ t.label }}
      </button>
    </div>

    <!-- ── 基础信息 ── -->
    <div v-if="tab === 'site'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">系统名称</label>
          <input v-model="cfg.site_name" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">网站标题（浏览器 Tab / 首页 Title）</label>
          <input v-model="cfg.site_title" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">网站介绍（一句话）</label>
          <textarea v-model="cfg.site_intro" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Logo 路径</label>
            <input v-model="cfg.site_logo" placeholder="/logo.png" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
            <p class="text-[9px] text-gray-700 mt-1">上传至 /public 后填相对路径，如 /logo.png</p>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">favicon 路径</label>
            <input v-model="cfg.site_favicon" placeholder="/favicon.ico" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">官网域名</label>
          <input v-model="cfg.site_domain" placeholder="aigc.fushtn.com" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          <p class="text-[9px] text-gray-700 mt-1">用于生成 sitemap.xml 完整 URL，不带 https://</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">OG 分享图（可选）</label>
          <input v-model="cfg.og_image" placeholder="/og.png" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
      </div>

      <!-- 财务/钻石兑换 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">💎 钻石兑换比例</h3>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">充值比例（1 元 = N 钻石）</label>
            <input v-model="cfg.diamond_exchange_rate" type="number" min="1" max="10000"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
            <p class="text-[9px] text-gray-700 mt-1">默认 10（1:10）。影响充值钻石发放、档位展示与兑换汇率（1 钻 = {{ (1 / Math.max(1, Number(cfg.diamond_exchange_rate) || 10)).toFixed(2) }} 元）</p>
          </div>
        </div>
      </div>

      <!-- ICP -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">ICP 备案信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">ICP 备案号</label>
            <input v-model="cfg.icp_beian" placeholder="京ICP备xxxxxxxx号" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">许可证</label>
            <input v-model="cfg.icp_license" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">公司名称</label>
            <input v-model="cfg.icp_company" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">版权信息</label>
            <input v-model="cfg.icp_copyright" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── SEO 设置 ── -->
    <div v-if="tab === 'seo'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">SEO 标题</label>
          <input v-model="cfg.seo_title" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          <p class="text-[9px] text-gray-700 mt-1">建议 ≤ 60 字，当前 {{ cfg.seo_title?.length || 0 }} 字</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">SEO 关键词</label>
          <input v-model="cfg.seo_keywords" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">SEO 描述</label>
          <textarea v-model="cfg.seo_description" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">建议 ≤ 150 字，当前 {{ cfg.seo_description?.length || 0 }} 字</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">robots.txt 内容</label>
          <textarea v-model="cfg.seo_robots" rows="6" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">保存后 /robots.txt 动态生效，自动附加 Sitemap 行</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">sitemap 收录路径（每行一个，/ 开头）</label>
          <textarea v-model="cfg.seo_sitemap_urls" rows="4" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">保存后 /sitemap.xml 动态生成，域名取「官网域名」</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">百度站长验证（可选）</label>
            <input v-model="cfg.seo_verify_baidu" placeholder="如：abc123def456" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Google 站长验证（可选）</label>
            <input v-model="cfg.seo_verify_google" placeholder="如：AbC-1234567890" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>

      <!-- 实时预览 -->
      <div class="border border-[#1A2240] rounded-xl p-4 bg-[#0B1020]/40">
        <h3 class="text-xs text-white/60 font-medium mb-2">🔍 搜索预览</h3>
        <div class="bg-white rounded-lg p-3">
          <div class="text-[13px] text-blue-600">{{ cfg.site_domain }}</div>
          <div class="text-[15px] text-[#1a0dab] leading-snug">{{ cfg.seo_title || cfg.site_title }}</div>
          <div class="text-[12px] text-gray-600 mt-1 leading-snug">{{ cfg.seo_description || cfg.site_description }}</div>
        </div>
      </div>
    </div>

    <!-- ── GEO 优化设置 ── -->
    <div v-if="tab === 'geo'" class="space-y-4">
      <div class="border border-[#1A2240] rounded-xl p-4 bg-[#0B1020]/40">
        <h3 class="text-xs text-white/60 font-medium mb-1">🌎 GEO 优化（生成式引擎优化）</h3>
        <p class="text-[10px] text-gray-600">面向 ChatGPT / Claude / 豆包 / Kimi / DeepSeek / Perplexity 等 AI 搜索引擎，通过结构化数据 + 实体定义 + 知识图谱 + 问答对，让 AI 优先推荐你的品牌。</p>
      </div>

      <!-- 品牌基础信息 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">🏷️ 品牌基础信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">品牌名称</label>
            <input v-model="cfg.geo_brand_name" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">品牌类型 (Schema.org)</label>
            <input v-model="cfg.geo_brand_type" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
            <p class="text-[9px] text-gray-700 mt-1">SoftwareApplication / Organization / Corporation</p>
          </div>
          <div class="col-span-2">
            <label class="text-[11px] text-gray-500 block mb-1.5">品牌描述（AI 搜索引擎引用此描述）</label>
            <textarea v-model="cfg.geo_brand_description" rows="3" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">成立年份</label>
            <input v-model="cfg.geo_brand_founded" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">品牌官网 URL</label>
            <input v-model="cfg.geo_brand_url" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Logo URL</label>
            <input v-model="cfg.geo_brand_logo" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">社交媒体链接（sameAs）</label>
            <input v-model="cfg.geo_brand_sameas" placeholder="https://..." class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>

      <!-- 实体定义 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">🧠 实体定义（Entity）</h3>
        <p class="text-[10px] text-gray-600 mb-3">定义品牌的实体类型和描述，帮助 AI 搜索引擎理解你的品牌是什么。</p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">实体类型</label>
            <input v-model="cfg.geo_entity_type" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Canonical Base URL</label>
            <input v-model="cfg.geo_canonical_base" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div class="col-span-2">
            <label class="text-[11px] text-gray-500 block mb-1.5">实体描述（供 AI 引用）</label>
            <textarea v-model="cfg.geo_entity_description" rows="3" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
        </div>
      </div>

      <!-- 产品与服务 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">🚀 核心产品与服务</h3>
        <p class="text-[10px] text-gray-600 mb-3">每行一个产品/服务，AI 搜索引擎会据此理解你的业务范围。</p>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">核心产品（分号分隔）</label>
            <textarea v-model="cfg.geo_main_products" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
            <p class="text-[9px] text-gray-700 mt-1">示例：AI短剧创作工作室;新媒体智能工作台;AI招聘助手</p>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">目标受众（分号分隔）</label>
            <textarea v-model="cfg.geo_target_audience" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">核心功能特性（分号分隔）</label>
            <textarea v-model="cfg.geo_key_features" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">知识库主题（分号分隔）</label>
            <textarea v-model="cfg.geo_knowledge_base" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
            <p class="text-[9px] text-gray-700 mt-1">AI 搜索引擎会基于这些主题判断你的专业领域</p>
          </div>
        </div>
      </div>

      <!-- FAQ 问答对 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">❓ FAQ 问答对（FAQPage Schema）</h3>
        <p class="text-[10px] text-gray-600 mb-3">格式：问题|答案（每条一行），AI 搜索引擎会直接引用这些问答。</p>
        <div>
          <textarea v-model="cfg.geo_faq_schema" rows="8" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
        </div>
      </div>

      <!-- 知识图谱 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">🕸️ 实体知识图谱（Entity Knowledge Graph）</h3>
        <p class="text-[10px] text-gray-600 mb-3">格式：主体|关系|客体（每行一条三元组），帮助 AI 理解品牌与产品、功能之间的关系。</p>
        <div>
          <textarea v-model="cfg.geo_entity_kg" rows="6" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">示例：昆仑镜|hasProduct|AI短剧创作工作室</p>
        </div>
      </div>

      <!-- 问答银行 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">💬 问答银行（供 AI 模型引用）</h3>
        <p class="text-[10px] text-gray-600 mb-3">格式：问题|答案（每行一条），这些问答会被 AI 搜索引擎直接引用。</p>
        <div>
          <textarea v-model="cfg.geo_qa_bank" rows="6" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
        </div>
      </div>

      <!-- JSON-LD 结构化数据 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">📋 JSON-LD 结构化数据</h3>
        <p class="text-[10px] text-gray-600 mb-3">直接嵌入页面的 JSON-LD Schema.org 标记，搜索引擎和 AI 爬虫都会读取。</p>
        <div>
          <textarea v-model="cfg.geo_structured_data" rows="8" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
        </div>
      </div>

      <!-- llms.txt -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">📄 llms.txt（AI 内容索引）</h3>
        <p class="text-[10px] text-gray-600 mb-3">llms.txt 规范（llmstxt.org），为 AI 爬虫提供产品事实与内容索引。</p>
        <div class="grid grid-cols-1 gap-4">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="geo_llms_txt_enable" v-model="cfg.geo_llms_txt_enable" true-value="true" false-value="false" class="accent-blue-500" />
            <label for="geo_llms_txt_enable" class="text-[11px] text-gray-400">启用 llms.txt</label>
          </div>
          <div>
            <textarea v-model="cfg.geo_llms_txt_content" rows="10" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
        </div>
      </div>

      <!-- Meta & Robots -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">🏷️ Meta & Robots 高级设置</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Robots 高级指令</label>
            <input v-model="cfg.geo_meta_robots_advanced" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
            <p class="text-[9px] text-gray-700 mt-1">index, follow, max-snippet:-1, max-image-preview:large</p>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Sitemap 优先级</label>
            <input v-model="cfg.geo_sitemap_priority" type="number" step="0.1" min="0" max="1" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">OG 类型</label>
            <input v-model="cfg.geo_og_type" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">OG Locale</label>
            <input v-model="cfg.geo_og_locale" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">文章发布者</label>
            <input v-model="cfg.geo_article_publisher" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Hreflang 默认语言</label>
            <input v-model="cfg.geo_hreflang_default" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>

      <!-- 功能开关 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">🔧 功能开关</h3>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="cfg.geo_enable" true-value="true" false-value="false" class="accent-blue-500" />
            启用 GEO 优化
          </label>
          <label class="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="cfg.geo_breadcrumb_enable" true-value="true" false-value="false" class="accent-blue-500" />
            启用面包屑导航
          </label>
          <label class="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="cfg.geo_open_graph_enable" true-value="true" false-value="false" class="accent-blue-500" />
            启用 Open Graph
          </label>
          <label class="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="cfg.geo_twitter_card_enable" true-value="true" false-value="false" class="accent-blue-500" />
            启用 Twitter Card
          </label>
          <label class="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="cfg.geo_hreflang_enable" true-value="true" false-value="false" class="accent-blue-500" />
            启用 Hreflang 多语言
          </label>
          <label class="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="cfg.geo_speakable_enable" true-value="true" false-value="false" class="accent-blue-500" />
            启用 Speakable（语音搜索）
          </label>
        </div>
      </div>

      <!-- GEO 预览 -->
      <div class="border border-[#1A2240] rounded-xl p-4 bg-[#0B1020]/40">
        <h3 class="text-xs text-white/60 font-medium mb-2">🤖 AI 搜索预览</h3>
        <div class="bg-white rounded-lg p-3">
          <div class="text-[12px] text-green-700">🔍 AI 搜索："{{ cfg.geo_brand_name || '昆仑镜' }}是什么？"</div>
          <div class="text-[11px] text-gray-700 mt-1.5 leading-relaxed">{{ (cfg.geo_brand_description || '').slice(0, 200) }}</div>
          <div class="text-[10px] text-blue-600 mt-1">来源：{{ cfg.geo_brand_url || 'aigc.fushtn.com' }}</div>
        </div>
      </div>
    </div>

    <div v-if="saved" class="fixed bottom-6 right-6 px-4 py-2.5 bg-green-500/15 border border-green-500/40 text-green-400 text-xs rounded-xl shadow-lg">✅ 配置已保存，已生效</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, onMounted } from 'vue'

const tab = ref<'site' | 'seo' | 'geo'>('site')
const tabs = [
  { id: 'site', label: '基础信息' },
  { id: 'seo', label: 'SEO 设置' },
  { id: 'geo', label: 'GEO 优化' },
]
const saving = ref(false)
const saved = ref(false)

const cfg = reactive<Record<string, string>>({
  site_name: '', site_title: '', site_description: '', site_keywords: '',
  site_intro: '', site_logo: '/logo.png', site_favicon: '/favicon.ico',
  site_domain: '', og_image: '', icp_beian: '', icp_license: '',
  icp_company: '', icp_business: '', icp_copyright: '',
  diamond_exchange_rate: '10',
  seo_title: '', seo_keywords: '', seo_description: '',
  seo_robots: '', seo_sitemap_urls: '', seo_verify_baidu: '', seo_verify_google: '',
  // GEO
  geo_enable: 'true', geo_brand_name: '', geo_brand_type: 'SoftwareApplication',
  geo_brand_description: '', geo_brand_founded: '', geo_brand_url: '',
  geo_brand_logo: '', geo_brand_sameas: '', geo_entity_type: 'Organization',
  geo_entity_description: '', geo_main_products: '', geo_target_audience: '',
  geo_key_features: '', geo_knowledge_base: '', geo_faq_schema: '',
  geo_structured_data: '', geo_meta_robots_advanced: '', geo_canonical_base: '',
  geo_hreflang_enable: 'false', geo_hreflang_default: 'zh-CN', geo_sitemap_priority: '1.0',
  geo_breadcrumb_enable: 'true', geo_open_graph_enable: 'true', geo_twitter_card_enable: 'true',
  geo_og_type: 'website', geo_og_locale: 'zh_CN', geo_article_publisher: '',
  geo_llms_txt_enable: 'true', geo_llms_txt_content: '', geo_entity_kg: '', geo_qa_bank: '',
  geo_speakable_enable: 'true', geo_speakable_selector: 'article, .content, main',
})

async function fetchConfig() {
  try {
    const token = window.localStorage?.getItem('auth_token')
    const res = await fetch('/api/admin/system/config', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) { window.location.href = '/admin/aigc/login'; return }
    const data = await res.json()
    Object.assign(cfg, data)
  } catch { /* ignore */ }
}

async function save() {
  saving.value = true
  saved.value = false
  try {
    const token = window.localStorage?.getItem('auth_token')
    const res = await fetch('/api/admin/system/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cfg),
    })
    if (res.status === 401) { window.location.href = '/admin/aigc/login'; return }
    const data = await res.json()
    if (data.config) Object.assign(cfg, data.config)
    saved.value = true
    setTimeout(() => (saved.value = false), 2500)
  } catch { /* ignore */ } finally {
    saving.value = false
  }
}

onMounted(fetchConfig)
</script>
