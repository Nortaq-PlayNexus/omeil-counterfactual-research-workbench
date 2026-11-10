import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  provenanceEvents,
  swarmFailureAudits,
  systemControls,
} from "@/db/schema";
import {
  runSwarmAuditComparison,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const [ctrl] = await db.select().from(systemControls).limit(1);
    if (ctrl?.emergencyStopActive || ctrl?.swarmPaused) {
      return NextResponse.json(
        { error: "Execution halted by Human Oversight Controls." },
        { status: 423 }
      );
    }

    const seed = Number(body.seed ?? Math.floor(Math.random() * 80000 + 10000));
    const auditOut = runSwarmAuditComparison(seed);

    const [{ value: auditCount }] = await db
      .select({ value: count() })
      .from(swarmFailureAudits);
    const auditCode = `SWM-${String(auditCount + 1).padStart(4, "0")}`;

    const [created] = await db
      .insert(swarmFailureAudits)
      .values({
        auditCode,
        benchmarkTask:
          String(body.benchmarkTask ?? "").trim() ||
          `Multi-Agent Research Swarm Failure Mode Comparison (Seed ${seed})`,
        seed,
        ...auditOut,
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "swarm_audit",
      entityId: created.id,
      action: "SWARM_FAILURE_AUDIT_EXECUTED",
      actor: "Multi-Agent Governance Evaluator",
      rationale: `Evaluated 5 swarm architectures under seed ${seed}: ${auditOut.empiricalConclusion}`,
      contentHash: sha256Hex(created),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { seed },
    });

    return NextResponse.json({ audit: created }, { status: 201 });
  } catch (error) {
    console.error("Swarm audit POST error:", error);
    return NextResponse.json(
      { error: "Failed to run swarm failure audit" },
      { status: 500 }
    );
  }
}
