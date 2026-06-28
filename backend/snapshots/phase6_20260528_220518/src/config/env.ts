import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().default('dev-secret-change-in-production-aigc-only'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/scs'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('scs-assets'),
  DEEPSEEK_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  REPLICATE_API_KEY: z.string().default(''),
  VOLCENGINE_API_KEY: z.string().default(''),
  VOLCENGINE_BASE_URL: z.string().default('https://ark.cn-beijing.volces.com/api/v3'),
  VOLCENGINE_VIDEO_MODEL: z.string().default('doubao-seedance-1-5-pro-251215'),
  VOLCENGINE_IMAGE_MODEL: z.string().default('doubao-seedream-4-0-250828'),
  VOLCENGINE_LLM_MODEL: z.string().default('doubao-seed-2-0-mini-260428'),
  // 音乐生成
  MUREKA_API_KEY: z.string().default(''),
  MUREKA_BASE_URL: z.string().default('https://api.mureka.ai/v1'),
  SUNO_API_KEY: z.string().default(''),
  SUNO_BASE_URL: z.string().default('https://api.suno.ai/v1'),
  MUSIC15_API_KEY: z.string().default(''),
  MUSIC15_BASE_URL: z.string().default('https://api.music15.ai/v1'),
  // 语音合成
  SILICONFLOW_API_KEY: z.string().default(''),
  SILICONFLOW_BASE_URL: z.string().default('https://api.siliconflow.cn/v1'),
  // 阿里云百炼
  ALIYUN_API_KEY: z.string().default(''),
  ALIYUN_IMAGE_MODEL: z.string().default('wanx2.1-t2i-turbo'),
  ALIYUN_VIDEO_MODEL: z.string().default('wan2.7-t2v'),
  PUBLIC_DOMAIN: z.string().default('https://shipin.fushtn.com'),
})

export const env = envSchema.parse(process.env)

// Set LLM provider env vars from parsed config
process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
process.env.REPLICATE_API_KEY = env.REPLICATE_API_KEY
process.env.VOLCENGINE_API_KEY = env.VOLCENGINE_API_KEY
process.env.MUREKA_API_KEY = env.MUREKA_API_KEY
process.env.SUNO_API_KEY = env.SUNO_API_KEY
process.env.MUSIC15_API_KEY = env.MUSIC15_API_KEY
process.env.SILICONFLOW_API_KEY = env.SILICONFLOW_API_KEY
process.env.SILICONFLOW_BASE_URL = env.SILICONFLOW_BASE_URL
process.env.ALIYUN_API_KEY = env.ALIYUN_API_KEY
