import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  autonomousWorkflowLogs,
  calibrationBenchmarks,
  claimsLedger,
  counterfactualInterventions,
  discoverySearchArchives,
  experimentDesigns,
  experimentRuns,
  literatureRecords,
  parameterSweeps,
  provenanceEvents,
  redTeamReviews,
  researchProgrammes,
  swarmFailureAudits,
  systemControls,
} from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { SOFTWARE_VERSION } from "@/lib/omeil-engine";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();

    const [
      programmes,
      designs,
      runs,
      interventions,
      claims,
      reviews,
      benchmarks,
      provenance,
      controls,
      literature,
      discoveries,
      sweeps,
      swarmAudits,
      autonomousLogs,
    ] = await Promise.all([
      db.select().from(researchProgrammes).orderBy(researchProgrammes.id),
      db.select().from(experimentDesigns).orderBy(desc(experimentDesigns.id)),
      db.select().from(experimentRuns).orderBy(desc(experimentRuns.id)),
      db
        .select()
        .from(counterfactualInterventions)
        .orderBy(desc(counterfactualInterventions.id)),
      db.select().from(claimsLedger).orderBy(claimsLedger.id),
      db.select().from(redTeamReviews).orderBy(desc(redTeamReviews.id)),
      db
        .select()
        .from(calibrationBenchmarks)
        .orderBy(calibrationBenchmarks.testCode),
      db
        .select()
        .from(provenanceEvents)
        .orderBy(desc(provenanceEvents.id))
        .limit(100),
      db.select().from(systemControls).limit(1),
      db.select().from(literatureRecords).orderBy(desc(literatureRecords.id)),
      db
        .select()
        .from(discoverySearchArchives)
        .orderBy(desc(discoverySearchArchives.id)),
      db.select().from(parameterSweeps).orderBy(desc(parameterSweeps.id)),
      db.select().from(swarmFailureAudits).orderBy(desc(swarmFailureAudits.id)),
      db
        .select()
        .from(autonomousWorkflowLogs)
        .orderBy(desc(autonomousWorkflowLogs.id))
        .limit(50),
    ]);

    return NextResponse.json({
      softwareVersion: SOFTWARE_VERSION,
      programmes,
      designs,
      runs,
      interventions,
      claims,
      reviews,
      benchmarks,
      provenance,
      controls: controls[0] ?? null,
      literature,
      discoveries,
      sweeps,
      swarmAudits,
      autonomousLogs,
    });
  } catch (error) {
    console.error("Failed to fetch workbench state:", error);
    return NextResponse.json(
      { error: "Failed to load OMEIL scientific state" },
      { status: 500 }
    );
  }
}
