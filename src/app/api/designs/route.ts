import { NextResponse } from "next/server";
import { db } from "@/db";
import { experimentDesigns, provenanceEvents } from "@/db/schema";
import {
  estimateStatisticalPower,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plannedTrials = Math.max(2, Number(body.plannedTrials ?? 16));
    const sesoi = Math.max(0.01, Number(body.smallestEffectInterest ?? 0.15));
    const pilotVar = Math.max(0.001, Number(body.pilotVarianceEstimate ?? 0.04));
    const powerTarget = Math.min(0.99, Math.max(0.5, Number(body.powerTarget ?? 0.8)));

    const est = estimateStatisticalPower(plannedTrials, sesoi, pilotVar);
    const preregHash = sha256Hex({
      title: body.title,
      primaryOutcome: body.primaryOutcome,
      plannedTrials,
      sesoi,
      pilotVar,
      stoppingRule: body.stoppingRule,
    });

    const [created] = await db
      .insert(experimentDesigns)
      .values({
        programmeId: Number(body.programmeId ?? 1),
        title: String(body.title ?? "Preregistered Study Protocol").trim(),
        analysisMode: String(body.analysisMode ?? "confirmatory"),
        primaryOutcome: String(body.primaryOutcome ?? "meanCoordination"),
        secondaryOutcomes: Array.isArray(body.secondaryOutcomes)
          ? body.secondaryOutcomes.map(String)
          : ["transferEntropyBits", "criticalSlowingLag1"],
        smallestEffectInterest: sesoi,
        pilotVarianceEstimate: pilotVar,
        powerTarget,
        plannedTrials,
        estimatedPower: est.power,
        stoppingRule: String(
          body.stoppingRule ?? "Fixed horizon; no optional stopping."
        ),
        exclusionCriteria: String(
          body.exclusionCriteria ?? "Exclude DataQualityReport failures."
        ),
        deviations: [],
        preregistrationHash: preregHash,
        approvedByHuman: true,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "design",
      entityId: created.id,
      action: "PREREGISTRATION_LOCKED",
      actor: "Experimental Design Planner",
      rationale: `Locked ${created.title} (${created.analysisMode}, est. power=${est.power}, req N=${est.requiredNFor80}).`,
      contentHash: preregHash,
      softwareVersion: SOFTWARE_VERSION,
      metadata: {
        plannedTrials,
        estimatedPower: est.power,
        underpowered: est.underpowered,
      },
    });

    return NextResponse.json(
      { design: created, powerDetails: est },
      { status: 201 }
    );
  } catch (error) {
    console.error("Design POST error:", error);
    return NextResponse.json(
      { error: "Failed to save preregistered design" },
      { status: 500 }
    );
  }
}
