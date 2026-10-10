import { loadCliEnv, type CliEnv } from "@yoryon/config";
import { createStorage, type MediaStorage } from "@yoryon/core";
import { createDb, createLockClient, type Database } from "@yoryon/db";

export interface CliContext {
  env: CliEnv;
  db: Database;
  storage: MediaStorage;
  close: () => Promise<void>;
}

let cached: CliContext | null = null;

export function getContext(): CliContext {
  if (!cached) {
    const env = loadCliEnv();
    const { db, close } = createDb(env.DATABASE_URL);
    cached = { env, db, storage: createStorage(env), close };
  }
  return cached;
}

export async function withLockClient<T>(fn: (client: import("pg").Client) => Promise<T>): Promise<T> {
  const env = loadCliEnv();
  const client = await createLockClient(env.DATABASE_URL);
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function closeContext(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
