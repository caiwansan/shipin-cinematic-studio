/**
 * ECO-02 Plugin Manifest Runtime — plugin.json 校验纯函数
 * --------------------------------------------------------
 * 原则：只验证不执行 / 零副作用 / 纯函数可单测
 * 协议：plugin.json 是未来开发者接入昆仑镜的标准身份证格式
 *
 * 白名单（未来扩展只改这里，不改校验逻辑）：
 *  - type: agent | tool | workflow
 *  - permissions: browser | content | analytics | storage | network | automation
 *  - runtime: { kaor: boolean, local?: boolean }（禁止任意运行时声明）
 *    local=true 强制 kaor=true（本地插件必须是云端 Agent 型，纯本地插件不存在）
 */
import { ZodError, z } from 'zod';

/** 已知权限白名单 */
export const KNOWN_PERMISSIONS = [
  'browser',
  'content',
  'analytics',
  'storage',
  'network',
  'automation',
] as const;

/** 已知插件类型 */
export const KNOWN_PLUGIN_TYPES = ['agent', 'tool', 'workflow'] as const;

/** 已知运行时能力（kaor=云端 Agent 执行；local=允许桌面本地入口，白名单） */
export const KNOWN_RUNTIME_KEYS = ['kaor', 'local'] as const;

/** plugin.json schema（zod 严格模式：未知字段拒绝，防线之一） */
const manifestSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9-]{2,63}$/, 'id 必须小写字母开头，仅含小写字母/数字/连字符，3-64 字符'),
    name: z.string().min(1).max(100),
    type: z.enum(KNOWN_PLUGIN_TYPES),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version 必须为严格 semver 格式 x.y.z'),
    author: z.string().min(1).max(64),
    application: z.string().max(80).optional(), // 关联 ecology_applications.slug（可选）
    description: z.string().max(500).optional(),
    permissions: z.array(z.enum(KNOWN_PERMISSIONS)).min(1, 'permissions 至少 1 项'),
    runtime: z
      .object({
        kaor: z.boolean(),
        local: z.boolean().optional(), // true = 允许出现在桌面本地加载器（白名单，缺省 false）
      })
      .strict()
      .optional() // 严格：未知运行时字段拒绝
      .superRefine((runtime, ctx) => {
        // 掌柜冻结：local=true 必须 kaor=true（非法组合直接拒绝）
        if (runtime?.local === true && runtime.kaor !== true) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['runtime'],
            message: 'runtime.local=true 必须同时 runtime.kaor=true（本地插件必须是云端 Agent 型）',
          });
        }
      }),
    billing: z
      .object({
        subscription: z.boolean(),
        price: z.number().nonnegative().optional(),
        currency: z.string().max(10).optional(),
      })
      .strict()
      .optional(), // 仅登记展示，不接入支付
  })
  .strict(); // 严格：未知顶层字段拒绝

/** 校验结果 */
export interface ManifestValidationResult {
  valid: boolean;
  manifest: z.infer<typeof manifestSchema> | null;
  errors: string[];
}

/**
 * validatePluginManifest — 纯函数，零副作用
 * 合法 → { valid: true, manifest, errors: [] }
 * 非法 → { valid: false, manifest: null, errors: [...] }
 */
export function validatePluginManifest(raw: unknown): ManifestValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, manifest: null, errors: ['manifest 必须是 JSON 对象'] };
  }
  try {
    const manifest = manifestSchema.parse(raw);
    return { valid: true, manifest, errors: [] };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        valid: false,
        manifest: null,
        errors: err.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`),
      };
    }
    return { valid: false, manifest: null, errors: ['manifest 解析失败'] };
  }
}

/**
 * isKnownPermission — 权限是否在白名单
 * 未来新权限必须先加入白名单才能被插件声明（权限不存在防线）
 */
export function isKnownPermission(p: string): boolean {
  return (KNOWN_PERMISSIONS as readonly string[]).includes(p);
}

/**
 * isKnownPluginType — 类型是否在白名单
 */
export function isKnownPluginType(t: string): boolean {
  return (KNOWN_PLUGIN_TYPES as readonly string[]).includes(t);
}

/**
 * isKnownRuntimeKey — 运行时能力是否在白名单
 */
export function isKnownRuntimeKey(k: string): boolean {
  return (KNOWN_RUNTIME_KEYS as readonly string[]).includes(k);
}
