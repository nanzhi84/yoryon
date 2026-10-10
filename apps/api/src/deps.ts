import { loadApiEnv, type ApiEnv } from "@yoryon/config";
import { createMailer, createStorage, type Mailer, type MediaStorage } from "@yoryon/core";
import { createDb, type Database } from "@yoryon/db";
import { RateLimiter } from "./middleware/rate-limit";

export interface AppDeps {
  env: ApiEnv;
  db: Database;
  storage: MediaStorage;
  mailer: Mailer;
  rateLimiter: RateLimiter;
  close: () => Promise<void>;
}

/** 从环境变量组装依赖。可注入覆盖用于 E2E/特殊场景。 */
export function createDeps(envOverrides?: Partial<ApiEnv>): AppDeps {
  const env = { ...loadApiEnv(), ...envOverrides } as ApiEnv;
  const { db, close } = createDb(env.DATABASE_URL);
  return {
    env,
    db,
    storage: createStorage(env),
    mailer: createMailer(env),
    rateLimiter: new RateLimiter(),
    close,
  };
}
