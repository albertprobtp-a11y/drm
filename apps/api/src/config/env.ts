import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
// Charge le .env à la racine du monorepo, quel que soit le cwd d'exécution.
dotenv.config({ path: path.resolve(here, "../../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1).default("fr-par"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  S3_BUCKET_DOCUMENTS: z.string().min(1),
  S3_BUCKET_PAGES: z.string().min(1),

  MASTER_ENCRYPTION_KEY: z
    .string()
    .min(1, "MASTER_ENCRYPTION_KEY est requis (openssl rand -base64 32)"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  PAGE_URL_SIGNING_SECRET: z.string().min(16),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("SecureView <no-reply@secureview.fr>"),

  RATE_LIMIT_OTP_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_OTP_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  RATE_LIMIT_PAGE_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_PAGE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Configuration invalide :", parsed.error.flatten().fieldErrors);
    throw new Error("Variables d'environnement invalides — voir .env.example");
  }
  return parsed.data;
}

export const env = loadEnv();
