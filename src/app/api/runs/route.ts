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
import { count } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [ctrl] = await db.select().from(systemControls).limit(1);
    if (ctrl?.emergencyStopActive) {
      return NextResponse.json(
        {
          error:
            "Emergency Stop is active. Release Emergency Stop in Human Oversight Controls before launching new runs.",
        },
        { status: 423 }
      );
    }
    if (ctrl?.swarmPaused) {
      return NextResponse.json(
        {
          error:
            "Research swarm is paused. Resume operations before executing simulations.",
        },
        { status: 423 }
      );
    }

    const maxAgents = ctrl?.maxAgentsPerRun ?? 48;
    const maxSteps = ctrl?.maxStepsPerRun ?? 180;
    const requestedAgents = Number(body.agentCount ?? 16);
    const requestedSteps = Number(body.steps ?? 60);

    if (requestedAgents > maxAgents || requestedSteps > maxSteps) {
      return NextResponse.json(
        {
          error: `Resource governor blocked unbounded workload (requested ${requestedAgents} agents / ${requestedSteps} steps; limit is ${maxAgents} agents / ${maxSteps} steps).`,
        },
        { status: 400 }
      );
    }

    const cfg = {
      environmentFamily: (body.environmentFamily ??
        "CoupledOscillatorSwarm") as EnvironmentFamily,
      seed: Number(body.seed ?? Math.floor(Math.random() * 90000 + 10000)),
      agentCount: Math.max(4, Math.min(maxAgents, requestedAgents)),
      steps: Math.max(12, Math.min(maxSteps, requestedSteps)),
      memoryPolicy: (body.memoryPolicy ?? "persistent_episodic") as MemoryPolicy,
      commNoise: Number(body.commNoise ?? 0.08),
      commChannelEnabled: body.commChannelEnabled !== false,
      couplingStrength: Number(body.couplingStrength ?? 0.72),
      resourceBudget: Number(body.resourceBudget ?? 100),
      modelHeterogeneity: String(
        body.modelHeterogeneity ?? "role_differentiated"
      ),
      injectLoggingDefect: Boolean(body.injectLoggingDefect ?? false),
    };

    const output = runSimulation(cfg);
    const [{ value: runCount }] = await db
      .select({ value: count() })
      .from(experimentRuns);
    const runCode = `RUN-${String(runCount + 1).padStart(4, "0")}`;

    let status = "completed";
    let failureCategory: string | null = null;
    let failureReason: string | null = null;

    if (!output.dataQuality.passed) {
      status = "failed";
      failureCategory = "measurement_failure";
      failureReason = output.dataQuality.warnings.join(" ");
    } else if (
      body.runType === "pilot" &&
      output.statisticalPowerObserved < 0.8
    ) {
      status = "inconclusive";
      failureCategory = "insufficient_power";
      failureReason = `Observed power (${output.statisticalPowerObserved}) < 0.80 threshold; reported inconclusive rather than null.`;
    }

    const [created] = await db
      .insert(experimentRuns)
      .values({
        runCode,
        programmeId: Number(body.programmeId ?? 1),
        designId: body.designId ? Number(body.designId) : null,
        parentRunId: body.parentRunId ? Number(body.parentRunId) : null,
        title:
          String(body.title ?? "").trim() ||
          `${cfg.environmentFamily} (${cfg.memoryPolicy}, seed ${cfg.seed})`,
        runType: String(body.runType ?? "exploratory"),
        ...cfg,
        status,
        failureCategory,
        failureReason,
        ...output,
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);

    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "run",
      entityId: created.id,
      action:
        status === "failed"
          ? "DATA_QUALITY_QUARANTINE"
          : "RUN_EXECUTED_IMMUTABLE",
      actor: "Researcher / OMEIL Engine",
      rationale:
        failureReason ??
        `Executed ${created.runType} run ${created.runCode} with seed ${created.seed}.`,
      contentHash: sha256Hex({
        runCode: created.runCode,
        configHash: created.configHash,
        datasetHash: created.datasetHash,
      }),
      softwareVersion: SOFTWARE_VERSION,
      metadata: {
        seed: created.seed,
        status,
        dataQualityPassed: output.dataQuality.passed,
      },
    });

    return NextResponse.json({ run: created }, { status: 201 });
  } catch (error) {
    console.error("Run execution error:", error);
    return NextResponse.json(
      { error: "Failed to execute simulation run" },
      { status: 500 }
    );
  }
}
