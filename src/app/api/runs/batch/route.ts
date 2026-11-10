import { NextResponse } from "next/server";
import { db } from "@/db";
import { provenanceEvents, systemControls } from "@/db/schema";
import { nextSequentialCode } from "@/lib/db-helpers";
import {
  EnvironmentFamily,
  MemoryPolicy,
  runBatchMonteCarloComparison,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const [ctrl] = await db.select().from(systemControls).limit(1);
    if (ctrl?.emergencyStopActive || ctrl?.swarmPaused) {
      return NextResponse.json(
        { error: "Execution halted by Human Oversight Controls." },
        { status: 423 }
      );
    }

    const env = (body.environmentFamily ??
      "ConventionEmergenceGrid") as EnvironmentFamily;
    const memoryA = (body.memoryA ?? "shared_memory") as MemoryPolicy;
    const channelA = body.channelA !== false;
    const memoryB = (body.memoryB ?? "stateless") as MemoryPolicy;
    const channelB = body.channelB !== false;
    const numSeeds = Math.max(3, Math.min(12, Number(body.numSeeds ?? 6)));
    const baseSeed = Number(body.baseSeed ?? 64000);

    const result = runBatchMonteCarloComparison(
      env,
      memoryA,
      channelA,
      memoryB,
      channelB,
      numSeeds,
      baseSeed
    );

    const eventCode = await nextSequentialCode(
      "provenance_events",
      "event_code",
      "PRV",
      4
    );
    await db.insert(provenanceEvents).values({
      eventCode,
      entityType: "batch_sweep",
      entityId: 1,
      action: "MONTE_CARLO_PAIRED_SWEEP",
      actor: "OMEIL Statistical Engine",
      rationale: `Paired ${numSeeds}-seed Monte Carlo in ${env}: ${memoryA}(ch=${channelA}) vs ${memoryB}(ch=${channelB}) -> ${result.verdict} (d=${result.cohensD}, p≈${result.pValueApprox}).`,
      contentHash: sha256Hex(result),
      softwareVersion: SOFTWARE_VERSION,
      metadata: {
        numSeeds,
        cohensD: result.cohensD,
        pValue: result.pValueApprox,
      },
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Batch Monte Carlo error:", error);
    return NextResponse.json(
      { error: "Failed to run Monte Carlo paired comparison" },
      { status: 500 }
    );
  }
}
