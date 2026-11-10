import { db } from "@/db";
import { sql } from "drizzle-orm";

// In-process single-flight queue for autonomous cycles and code generation
let cycleQueue: Promise<unknown> = Promise.resolve();

export async function withAutonomousLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = cycleQueue;
  let release!: () => void;
  cycleQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function nextSequentialCode(
  tableName:
    | "experiment_runs"
    | "counterfactual_interventions"
    | "claims_ledger"
    | "provenance_events"
    | "discovery_search_archives"
    | "parameter_sweeps"
    | "swarm_failure_audits"
    | "literature_records"
    | "research_programmes",
  columnName: string,
  prefix: string,
  padLength = 4
): Promise<string> {
  const res = await db.execute(
    sql.raw(
      `SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*) AS total_cnt FROM ${tableName}`
    )
  );
  const row = res.rows[0] as { max_id?: string | number; total_cnt?: string | number } | undefined;
  const maxId = Number(row?.max_id ?? 0);
  const totalCnt = Number(row?.total_cnt ?? 0);
  let nextNum = Math.max(maxId, totalCnt) + 1;

  // Verify uniqueness against existing codes in case custom codes exist
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${prefix}-${String(nextNum).padStart(padLength, "0")}`;
    const check = await db.execute(
      sql.raw(
        `SELECT 1 FROM ${tableName} WHERE ${columnName} = '${candidate}' LIMIT 1`
      )
    );
    if (check.rows.length === 0) {
      return candidate;
    }
    nextNum++;
  }

  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
