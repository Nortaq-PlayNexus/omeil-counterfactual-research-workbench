import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  counterfactualInterventions,
  experimentRuns,
  provenanceEvents,
  systemControls,
} from "@/db/schema";
import {
  buildCausalDagForIntervention,
  compareCounterfactualRuns,
  EnvironmentFamily,
  InterventionType,
  MemoryPolicy,
  runSimulation,
  sha256Hex,
  SimulationConfig,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count, eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [ctrl] = await db.select().from(systemControls).limit(1);
    if (ctrl?.emergencyStopActive || ctrl?.swarmPaused) {
      return NextResponse.json(
        {
          error:
            "Execution halted by Human Oversight Controls (Emergency Stop or Swarm Paused).",
        },
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
        { error: "Parent immutable run not found." },
        { status: 404 }
      );
    }

    const interventionType = (body.interventionType ??
      "channel_disable") as InterventionType;
    const matchedSeed = body.matchedSeed !== false;
    const seedToUse = matchedSeed
      ? parent.seed
      : Number(body.customSeed ?? parent.seed + 101);

    const cfConfig: SimulationConfig = {
      environmentFamily: parent.environmentFamily as EnvironmentFamily,
      seed: seedToUse,
      agentCount: parent.agentCount,
      steps: parent.steps,
      memoryPolicy: parent.memoryPolicy as MemoryPolicy,
      commNoise: parent.commNoise,
      commChannelEnabled: parent.commChannelEnabled,
      couplingStrength: parent.couplingStrength,
      resourceBudget: parent.resourceBudget,
      modelHeterogeneity: parent.modelHeterogeneity,
    };

    let targetSpec = "";
    const parameterDelta: Record<string, string | number | boolean> = {};

    if (interventionType === "channel_disable") {
      cfConfig.commChannelEnabled = false;
      targetSpec = "commChannelEnabled: true -> false";
      parameterDelta.commChannelEnabled = false;
    } else if (interventionType === "agent_removal") {
      const idx = Math.max(
        0,
        Math.min(parent.agentCount - 1, Number(body.removedAgentIndex ?? 0))
      );
      cfConfig.removedAgentIndex = idx;
      cfConfig.interventionStep = Number(
        body.interventionStep ?? Math.floor(parent.steps / 3)
      );
      targetSpec = `Remove agent index ${idx} at step ${cfConfig.interventionStep}`;
      parameterDelta.removedAgentIndex = idx;
      parameterDelta.interventionStep = cfConfig.interventionStep;
    } else if (interventionType === "resource_relax") {
      const mult = Number(body.resourceMultiplier ?? 2.0);
      cfConfig.resourceBudget = Number(
        (parent.resourceBudget * mult).toFixed(1)
      );
      targetSpec = `resourceBudget: ${parent.resourceBudget} -> ${cfConfig.resourceBudget}`;
      parameterDelta.resourceBudget = cfConfig.resourceBudget;
    } else if (interventionType === "timing_shift") {
      cfConfig.removedAgentIndex = 0;
      cfConfig.interventionStep = Number(body.interventionStep ?? 5);
      targetSpec = `Shift perturbation timing to step ${cfConfig.interventionStep}`;
      parameterDelta.interventionStep = cfConfig.interventionStep;
    } else if (interventionType === "mechanism_ablation") {
      cfConfig.mechanismAblated = true;
      targetSpec = "Ablate phase-coupling feedback mechanism";
      parameterDelta.mechanismAblated = true;
    } else if (interventionType === "environment_transfer") {
      const targetEnv = (body.targetEnvironment ??
        "ResourceForagingCommons") as EnvironmentFamily;
      cfConfig.environmentFamily = targetEnv;
      targetSpec = `Transfer population to ${targetEnv}`;
      parameterDelta.environmentFamily = targetEnv;
    } else {
      // variable_change
      const newNoise = Number(body.commNoise ?? Math.min(0.6, parent.commNoise + 0.2));
      const newCoupling = Number(body.couplingStrength ?? parent.couplingStrength);
      cfConfig.commNoise = newNoise;
      cfConfig.couplingStrength = newCoupling;
      targetSpec = `commNoise=${newNoise}, coupling=${newCoupling}`;
      parameterDelta.commNoise = newNoise;
      parameterDelta.couplingStrength = newCoupling;
    }

    const cfOut = runSimulation(cfConfig);
    const [{ value: runCount }] = await db
      .select({ value: count() })
      .from(experimentRuns);
    const runCode = `RUN-${String(runCount + 1).padStart(4, "0")}`;

    const [cfRun] = await db
      .insert(experimentRuns)
      .values({
        runCode,
        programmeId: parent.programmeId,
        designId: parent.designId,
        parentRunId: parent.id,
        title: `CF (${interventionType}) vs ${parent.runCode}`,
        runType: "counterfactual",
        environmentFamily: cfConfig.environmentFamily,
        seed: cfConfig.seed,
        agentCount: cfConfig.agentCount,
        steps: cfConfig.steps,
        memoryPolicy: cfConfig.memoryPolicy,
        commNoise: cfConfig.commNoise,
        commChannelEnabled: cfConfig.commChannelEnabled,
        couplingStrength: cfConfig.couplingStrength,
        resourceBudget: cfConfig.resourceBudget,
        modelHeterogeneity: cfConfig.modelHeterogeneity,
        status: cfOut.dataQuality.passed ? "completed" : "failed",
        ...cfOut,
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const dag = buildCausalDagForIntervention(interventionType, targetSpec);
    const cmp = compareCounterfactualRuns(
      parent.trajectory,
      cfOut.trajectory,
      parent.transferEntropyBits,
      cfOut.transferEntropyBits
    );

    const [{ value: cfCount }] = await db
      .select({ value: count() })
      .from(counterfactualInterventions);
    const cfCode = `CF-${String(cfCount + 1).padStart(4, "0")}`;

    const [intervention] = await db
      .insert(counterfactualInterventions)
      .values({
        code: cfCode,
        parentRunId: parent.id,
        counterfactualRunId: cfRun.id,
        question:
          String(body.question ?? "").trim() ||
          `What happens to ${parent.runCode} under ${interventionType} (${targetSpec})?`,
        interventionType,
        targetSpec,
        parameterDelta,
        matchedSeed,
        identificationStatus: dag.identificationStatus,
        identificationRationale: dag.identificationRationale,
        confounders: dag.confounders,
        alternativeExplanations: dag.alternativeExplanations,
        causalDag: { nodes: dag.nodes, edges: dag.edges },
        ...cmp,
      })
      .returning();

    // Update counterfactual run with interventionId link
    await db
      .update(experimentRuns)
      .set({ interventionId: intervention.id })
      .where(eq(experimentRuns.id, cfRun.id));

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);

    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "intervention",
      entityId: intervention.id,
      action: "COUNTERFACTUAL_EXECUTED",
      actor: "OMEIL Causal Engine",
      rationale: `${cfCode} (${interventionType}) executed against immutable ${parent.runCode}; produced ${cfRun.runCode} [${dag.identificationStatus}].`,
      contentHash: sha256Hex({
        cfCode,
        parentHash: parent.datasetHash,
        cfHash: cfRun.datasetHash,
      }),
      softwareVersion: SOFTWARE_VERSION,
      metadata: {
        parentRunId: parent.id,
        counterfactualRunId: cfRun.id,
        matchedSeed,
        deltaCoordination: cmp.deltaCoordination,
      },
    });

    return NextResponse.json(
      { intervention, counterfactualRun: cfRun },
      { status: 201 }
    );
  } catch (error) {
    console.error("Counterfactual execution error:", error);
    return NextResponse.json(
      { error: "Failed to execute counterfactual experiment" },
      { status: 500 }
    );
  }
}
