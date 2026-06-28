-- Add ImagePromptTemplates table for DB-driven image prompt template management
-- Migration: add_image_prompt_templates
-- Note: column names are camelCase to match Prisma convention (see ai_scene_specs column naming)

CREATE TABLE IF NOT EXISTS "image_prompt_templates" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "type"          TEXT        NOT NULL,
    "templateKey"   TEXT        NOT NULL,
    "title"         TEXT        NOT NULL,
    "content"       TEXT        NOT NULL,
    "sortOrder"     INTEGER     NOT NULL DEFAULT 0,
    "enabled"       BOOLEAN     NOT NULL DEFAULT true,
    "description"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_prompt_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "image_prompt_templates_type_templateKey_key" UNIQUE ("type", "templateKey")
);

-- 插入初始种子数据
INSERT INTO "image_prompt_templates" ("type", "templateKey", "title", "content", "description", "sortOrder", "enabled")
VALUES
    ('portrait', 'negative_prompt', '默认负面提示词',
     'ugly, deformed, blurry, low quality, extra limbs, bad anatomy, watermark, text, multiple views, disfigured, poorly drawn, mutation, bad proportions, extra fingers',
     '默认负向 prompt，当角色图生成时作为 negative prompt 使用', 1, true),

    ('portrait', 'qc_prompt', '质量审核模板',
     '你是一位角色肖像提示词质量管理员。

你将收到【角色肖像优化需求表单】，请检查生成的提示词是否满足以下标准的 AIGC 提示词格式要求：

【标准格式要求】
- 角色名 + 外貌描述（年龄、发色、面部特征、服装、体型）
- 姿态: full body portrait, standing front view
- 表情描述（eg. calm expression, neutral expression）
- 背景: white background, character design sheet style
- 画质标签: high detail face, cinematic lighting, 8k, sharp focus

如果缺少上述要素，请重写提示词。
如果已包含全部要素，输出原始提示词不变。

输出必须是英文纯文本提示词，不要额外解释。',
     'LLM 质量审核的 system prompt，当 compose prompt 质量不达标时调用 LLM 精炼', 2, true),

    ('portrait', 'prompt_structure', 'Prompt 合成模板',
     'Portrait of {{name}}, {{appearance}}, full body portrait, standing front view, white background, character design sheet style, high detail face, cinematic lighting, 8k, sharp focus',
     '提示词组装结构模板，{{name}} 替换为角色名，{{appearance}} 替换为外貌特征描述，{{quality_tags}} 替换为画质标签', 3, true),

    ('portrait', 'quality_rules', '质量检查规则',
     '{"age":{"regex":"\\\\d+\\\\s*(?:year|岁)","label":"年龄"},"body":{"regex":"full body|全身","label":"全身"},"front":{"regex":"front view|正面","label":"正面"},"background":{"regex":"white background|plain background|solid background","label":"背景"},"quality":{"regex":"8k|high detail|sharp focus|cinematic","label":"画质"},"english":{"regex":"^[A-Za-z]","label":"英文"}}',
     '质量门禁检查规则，JSON 格式包含各检查项的 regex 和 label', 4, true),

    ('portrait', 'composition_rules', '合成规则',
     '{"minFeatures":3,"featureTypes":["demographic","hair","eyes","ethnicity","build","clothing","notable","expression"],"qualityTags":["high detail face","cinematic lighting","8k","sharp focus"]}',
     'Prompt 合成规则，包括最小特征数阈值和允许的特征类型', 5, true)

ON CONFLICT ("type", "templateKey") DO NOTHING;
