import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the local Vite binding or the generated GitHub Actions deployment before using private state."
    );
  }

  return drizzle(env.DB, { schema });
}
