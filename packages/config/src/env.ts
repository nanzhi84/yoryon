import { z } from "zod";

/**
 * 环境变量校验。所有密钥仅经环境变量注入（ADR §12），禁止写入仓库。
 * 每个应用只加载自己的 schema，启动即失败，避免运行期才发现配置缺失。
 */

const databaseUrl = z.string().min(1, "DATABASE_URL is required");

const storageBackend = z.enum(["oss", "fs"]);

const ossFields = {
  OSS_REGION: z.string().optional(),
  OSS_BUCKET: z.string().optional(),
  OSS_ACCESS_KEY_ID: z.string().optional(),
  OSS_ACCESS_KEY_SECRET: z.string().optional(),
  /** 内网 endpoint 可用 internal 域名；仅用于签名 URL 的公网 host 可单独覆盖 */
  OSS_ENDPOINT: z.string().optional(),
};

const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: databaseUrl,
    /** BFF 共享密钥：仅标识来源与 IP 归因，绝不参与授权（ADR-0001） */
    BFF_SHARED_SECRET: z.string().min(16),
    /** 站点公网地址（邮件中的链接等使用），如 https://www.example.com */
    SITE_URL: z.string().url().default("http://localhost:3000"),
    STORAGE_BACKEND: storageBackend.default("fs"),
    /** STORAGE_BACKEND=fs 时的本地根目录与签名密钥（E2E/本地开发） */
    FS_STORAGE_ROOT: z.string().optional(),
    FS_STORAGE_SIGNING_SECRET: z.string().optional(),
    /** fs 模式下签名 URL 指向的 API 公网 base，如 http://localhost:4000 */
    API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
    ...ossFields,
    MEDIA_SIGN_TTL: z.coerce.number().int().positive().default(900),
    MEDIA_BLOCK_WEIGHT: z.coerce.number().int().positive().default(300),
    MAIL_SMTP_HOST: z.string().default("localhost"),
    MAIL_SMTP_PORT: z.coerce.number().int().positive().default(1025),
    MAIL_SMTP_USER: z.string().optional(),
    MAIL_SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default("Yoryon Blog <no-reply@example.com>"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_BACKEND === "oss") {
      for (const key of ["OSS_REGION", "OSS_BUCKET", "OSS_ACCESS_KEY_ID", "OSS_ACCESS_KEY_SECRET"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", message: `${key} required when STORAGE_BACKEND=oss`, path: [key] });
      }
    }
    if (env.STORAGE_BACKEND === "fs") {
      if (!env.FS_STORAGE_ROOT) ctx.addIssue({ code: "custom", message: "FS_STORAGE_ROOT required when STORAGE_BACKEND=fs", path: ["FS_STORAGE_ROOT"] });
      if (!env.FS_STORAGE_SIGNING_SECRET || env.FS_STORAGE_SIGNING_SECRET.length < 16) {
        ctx.addIssue({ code: "custom", message: "FS_STORAGE_SIGNING_SECRET (>=16 chars) required when STORAGE_BACKEND=fs", path: ["FS_STORAGE_SIGNING_SECRET"] });
      }
    }
  });

const cliEnvSchema = apiEnvSchema.extend({
  /** CLI 需要 OSS 写/删权限（发布身份），fs 模式无需额外字段 */
  SSH_HOST: z.string().optional(),
  SSH_USER: z.string().optional(),
  SSH_PORT: z.coerce.number().int().positive().default(22),
  SSH_KEY_PATH: z.string().optional(),
  /** blog db tunnel 使用的本地端口 */
  TUNNEL_LOCAL_PORT: z.coerce.number().int().positive().default(55432),
});

const webEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** BFF 转发目标（服务端内网地址），如 http://127.0.0.1:4000 */
  API_INTERNAL_URL: z.string().url(),
  BFF_SHARED_SECRET: z.string().min(16),
  /** 允许的外部 Origin 白名单，逗号分隔（CSRF 防线，ADR-0001） */
  ALLOWED_ORIGINS: z.string().min(1),
  /** 信息流公开缓存 revalidate 秒数（ADR-0003 公开线） */
  FEED_REVALIDATE_SEC: z.coerce.number().int().nonnegative().default(60),
  SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type CliEnv = z.infer<typeof cliEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid API environment:\n${formatIssues(parsed.error)}`);
  return parsed.data;
}

export function loadCliEnv(source: NodeJS.ProcessEnv = process.env): CliEnv {
  const parsed = cliEnvSchema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid CLI environment:\n${formatIssues(parsed.error)}`);
  return parsed.data;
}

export function loadWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const parsed = webEnvSchema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid Web environment:\n${formatIssues(parsed.error)}`);
  return parsed.data;
}
