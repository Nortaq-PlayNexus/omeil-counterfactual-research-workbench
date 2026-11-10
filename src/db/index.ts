import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import path from "path";

const globalForDb = globalThis as typeof globalThis & {
  __omeilPglite?: PGlite;
};

const client = globalForDb.__omeilPglite ?? new PGlite();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__omeilPglite = client;
}

const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch((e) => { console.error("migration error", e); });

export { db };
