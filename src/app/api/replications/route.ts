import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  experimentRuns,
  provenanceEvents,
  systemControls,
} from "@/db/schema";
import {
  EnvironmentFamily,
  MemoryPolicy,
  runSimulation,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count, eq } from "drizzle-orm";

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

    const parentRunId = Number(body.parentRunId);
    const [parent] = await db
      .select()
      .from(experimentRuns)
      .where(eq(experimentRuns.id, parentRunId));

    if (!parent) {
      return NextResponse.json(
        { error: "Parent run not found for replication" },
        { status: 404 }
      );
    }

    // Independent seed replication (never a cached copy)
    const newSeed = Number(body.seed ?? parent.seed + 7919);
    const repOut = runSimulation({
      environmentFamily: parent.environmentFamily as EnvironmentFamily,
      seed: newSeed,
      agentCount: parent.agentCount,
      steps: parent.steps,
      memoryPolicy: parent.memoryPolicy as MemoryPolicy,
      commNoise: parent.commNoise,
      commChannelEnabled: parent.commChannelEnabled,
      couplingStrength: parent.couplingStrength,
      resourceBudget: parent.resourceBudget,
      modelHeterogeneity: parent.modelHeterogeneity,
    });

    const deltaR = Math.abs(
      repOut.finalOrderParameter - parent.finalOrderParameter
    );
    const replicatedWithinTolerance = deltaR <= 0.15 && repOut.dataQuality.passed;

    const [{ value: runCount }] = await db
      .select({ value: count() })
      .from(experimentRuns);
    const runCode = `RUN-${String(runCount + 1).padStart(4, "0")}`;

    const [repRun] = await db
      .insert(experimentRuns)
      .values({
        runCode,
        programmeId: parent.programmeId,
        designId: parent.designId,
        parentRunId: parent.id,
        title: `REPLICATION of ${parent.runCode} (Independent Seed ${newSeed})`,
        runType: "replication",
        environmentFamily: parent.environmentFamily,
        seed: newSeed,
        agentCount: parent.agentCount,
        steps: parent.steps,
        memoryPolicy: parent.memoryPolicy,
        commNoise: parent.commNoise,
        commChannelEnabled: parent.commChannelEnabled,
        couplingStrength: parent.couplingStrength,
        resourceBudget: parent.resourceBudget,
        modelHeterogeneity: parent.modelHeterogeneity,
        status: replicatedWithinTolerance ? "completed" : "inconclusive",
        failureCategory: replicatedWithinTolerance
          ? null
          : "non_reproducible_variance",
        failureReason: replicatedWithinTolerance
          ? null
          : `Replication ΔR=${deltaR.toFixed(4)} exceeded 0.15 tolerance vs ${parent.runCode}.`,
        ...repOut,
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "run",
      entityId: repRun.id,
      action: replicatedWithinTolerance
        ? "REPLICATION_CONFIRMED"
        : "REPLICATION_DIVERGED",
      actor: "OMEIL Replication Protocol",
      rationale: `Independent seed ${newSeed} replication of ${parent.runCode} -> ${repRun.runCode} (ΔR=${deltaR.toFixed(4)}, withinTolerance=${replicatedWithinTolerance}).`,
      contentHash: sha256Hex({
        parentHash: parent.datasetHash,
        repHash: repRun.datasetHash,
      }),
      softwareVersion: SOFTWARE_VERSION,
      metadata: {
        parentRunId: parent.id,
        newSeed,
        deltaR: Number(deltaR.toFixed(4)),
        replicatedWithinTolerance,
      },
    });

    return NextResponse.json(
      {
        replicationRun: repRun,
        deltaOrderParameter: Number(deltaR.toFixed(4)),
        replicatedWithinTolerance,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Replication POST error:", error);
    return NextResponse.json(
      { error: "Failed to execute independent replication" },
      { status: 500 }
    );
  }
}
