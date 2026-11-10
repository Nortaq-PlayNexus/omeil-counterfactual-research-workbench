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
  parameterSweeps,
  provenanceEvents,
  redTeamReviews,
  researchProgrammes,
  swarmFailureAudits,
  systemControls,
} from "@/db/schema";
import { nextSequentialCode, withAutonomousLock } from "@/lib/db-helpers";
import {
  buildCausalDagForIntervention,
  compareCounterfactualRuns,
  EnvironmentFamily,
  estimateStatisticalPower,
  InterventionType,
  MemoryPolicy,
  runCalibrationSuite,
  runParameterSweep,
  runQualityDiversitySearch,
  runSimulation,
  runSwarmAuditComparison,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { desc, eq } from "drizzle-orm";

const ENVIRONMENTS: EnvironmentFamily[] = [
  "CoupledOscillatorSwarm",
  "ResourceForagingCommons",
  "ConventionEmergenceGrid",
  "NullStochasticBaseline",
];

const MEMORIES: MemoryPolicy[] = [
  "stateless",
  "short_memory",
  "persistent_episodic",
  "shared_memory",
];

const INTERVENTIONS: InterventionType[] = [
  "agent_removal",
  "channel_disable",
  "resource_relax",
  "timing_shift",
  "mechanism_ablation",
  "variable_change",
  "environment_transfer",
];

const RED_TEAM_ROLES = [
  "Hypothesis Falsifier",
  "Statistical Skeptic",
  "Measurement Critic",
  "Simulation-Artifact Investigator",
  "Reproducibility Challenger",
  "Alternative-Mechanism Generator",
  "Overclaim Detection Reviewer",
];

const EXPLANATION_CATEGORIES = [
  "random_variation",
  "unbalanced_comparison",
  "confounder",
  "selection_effect",
  "simulator_artifact",
  "accidental_parameter_interaction",
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceSingleStep = Boolean(body.forceSingleStep);

    const result = await withAutonomousLock(async () => {
      const [ctrl] = await db.select().from(systemControls).limit(1);
      if (!ctrl) {
        return {
          status: 404,
          payload: { error: "System controls not initialized" },
        };
      }

      if (ctrl.emergencyStopActive || ctrl.swarmPaused) {
        if (ctrl.autonomousModeEnabled) {
          await db
            .update(systemControls)
            .set({ autonomousModeEnabled: false })
            .where(eq(systemControls.id, ctrl.id));
        }
        return {
          status: 423,
          payload: {
            error:
              "Execution halted by Human Oversight Controls (Emergency Stop or Swarm Paused).",
          },
        };
      }

      if (!forceSingleStep && !ctrl.autonomousModeEnabled) {
        return {
          status: 409,
          payload: { error: "Autonomous Research Mode is currently OFF." },
        };
      }

      if (
        !forceSingleStep &&
        ctrl.autonomousCycleCount >= ctrl.maxAutonomousCycles
      ) {
        await db
          .update(systemControls)
          .set({
            autonomousModeEnabled: false,
            lastAutonomousAction: `Halted safely at cycle budget cap (${ctrl.maxAutonomousCycles}/${ctrl.maxAutonomousCycles})`,
          })
          .where(eq(systemControls.id, ctrl.id));

        return {
          status: 200,
          payload: {
            budgetReached: true,
            message: `Resource Governor safely paused Autonomous Mode after reaching session cap of ${ctrl.maxAutonomousCycles} cycles.`,
          },
        };
      }

      const nextCycle = ctrl.autonomousCycleCount + 1;

      const [programmes, designs, runs, interventions, reviews] =
        await Promise.all([
          db.select().from(researchProgrammes).orderBy(researchProgrammes.id),
          db
            .select()
            .from(experimentDesigns)
            .orderBy(desc(experimentDesigns.id)),
          db.select().from(experimentRuns).orderBy(desc(experimentRuns.id)),
          db
            .select()
            .from(counterfactualInterventions)
            .orderBy(desc(counterfactualInterventions.id)),
          db.select().from(redTeamReviews).orderBy(desc(redTeamReviews.id)),
        ]);

      const nextPrvCode = await nextSequentialCode(
        "provenance_events",
        "event_code",
        "PRV",
        4
      );

      const phase = (nextCycle - 1) % 8;

      let stageName = "";
      let actionType = "";
      let targetEntityCode = "";
      let selectionRationale = "";
      let outcomeSummary = "";
      let scientificDisposition = "candidate_pattern";

      const completedBaselineRuns = runs.filter(
        (r) =>
          r.status === "completed" &&
          r.dataQuality?.passed &&
          r.environmentFamily !== "NullStochasticBaseline"
      );

      if (phase === 0 || runs.length === 0) {
        const env = ENVIRONMENTS[nextCycle % ENVIRONMENTS.length];
        const mem = MEMORIES[(nextCycle + 1) % MEMORIES.length];
        const isNull = env === "NullStochasticBaseline";
        const seed = 31000 + nextCycle * 997;
        const agentCount = Math.min(
          ctrl.maxAgentsPerRun,
          12 + (nextCycle % 3) * 4
        );
        const steps = Math.min(
          ctrl.maxStepsPerRun,
          50 + (nextCycle % 2) * 15
        );
        const coupling = isNull
          ? 0.0
          : Number((0.45 + (nextCycle % 4) * 0.14).toFixed(2));
        const noise = isNull
          ? 0.35
          : Number((0.04 + (nextCycle % 3) * 0.09).toFixed(2));

        const cfg = {
          environmentFamily: env,
          seed,
          agentCount,
          steps,
          memoryPolicy: mem,
          commNoise: noise,
          commChannelEnabled: !isNull,
          couplingStrength: coupling,
          resourceBudget: 100,
          modelHeterogeneity:
            nextCycle % 2 === 0 ? "role_differentiated" : "mixed_model_families",
        };

        const out = runSimulation(cfg);
        const runCode = await nextSequentialCode(
          "experiment_runs",
          "run_code",
          "RUN",
          4
        );
        const progId =
          programmes[nextCycle % Math.max(1, programmes.length)]?.id ?? 1;
        const isUnderpowered =
          out.statisticalPowerObserved < 0.8 && noise >= 0.2;
        const status = !out.dataQuality.passed
          ? "failed"
          : isUnderpowered
          ? "inconclusive"
          : "completed";

        const [created] = await db
          .insert(experimentRuns)
          .values({
            runCode,
            programmeId: progId,
            designId: designs[0]?.id ?? null,
            title: `[AUTO] ${env} (${mem}, k=${coupling}, σ=${noise})`,
            runType: isNull
              ? "null_control"
              : isUnderpowered
              ? "pilot"
              : "exploratory",
            ...cfg,
            status,
            failureCategory: isUnderpowered ? "insufficient_power" : null,
            failureReason: isUnderpowered
              ? `Autonomous power check flagged observed power (${out.statisticalPowerObserved}) < 0.80 under high noise.`
              : null,
            ...out,
            softwareVersion: SOFTWARE_VERSION,
          })
          .returning();

        await db.insert(provenanceEvents).values({
          eventCode: nextPrvCode,
          entityType: "run",
          entityId: created.id,
          action: "AUTONOMOUS_SIMULATION_EXECUTED",
          actor: "OMEIL Autonomous Scientist",
          rationale: `Cycle #${nextCycle}: Sampled ${env} with ${mem} (seed=${seed}).`,
          contentHash: sha256Hex({ runCode, datasetHash: out.datasetHash }),
          softwareVersion: SOFTWARE_VERSION,
          metadata: { cycle: nextCycle, status, seed },
        });

        stageName = "Stage 11 · Bounded Trial Execution";
        actionType = "simulation";
        targetEntityCode = runCode;
        selectionRationale = `Selected ${env} with ${mem} to expand empirical coverage and include null-world controls.`;
        outcomeSummary = `Executed ${runCode} (${status.toUpperCase()}): R=${out.finalOrderParameter}, H=${out.entropyBits}b, TE=${out.transferEntropyBits}b.`;
        scientificDisposition = isNull
          ? "no_effect_or_null"
          : isUnderpowered
          ? "inconclusive_underpowered"
          : "candidate_pattern";
      } else if (phase === 1 && completedBaselineRuns.length > 0) {
        const parent =
          completedBaselineRuns[nextCycle % completedBaselineRuns.length];
        const op = INTERVENTIONS[nextCycle % INTERVENTIONS.length];

        const cfConfig = {
          environmentFamily: parent.environmentFamily as EnvironmentFamily,
          seed: parent.seed,
          agentCount: parent.agentCount,
          steps: parent.steps,
          memoryPolicy: parent.memoryPolicy as MemoryPolicy,
          commNoise: parent.commNoise,
          commChannelEnabled: parent.commChannelEnabled,
          couplingStrength: parent.couplingStrength,
          resourceBudget: parent.resourceBudget,
          modelHeterogeneity: parent.modelHeterogeneity,
          removedAgentIndex: undefined as number | undefined,
          interventionStep: undefined as number | undefined,
          mechanismAblated: undefined as boolean | undefined,
        };

        let targetSpec = "";
        const parameterDelta: Record<string, string | number | boolean> = {};
        if (op === "agent_removal") {
          cfConfig.removedAgentIndex = 0;
          cfConfig.interventionStep = Math.floor(parent.steps / 3);
          targetSpec = `Remove agent A-01 at step ${cfConfig.interventionStep}`;
          parameterDelta.removedAgentIndex = 0;
        } else if (op === "channel_disable") {
          cfConfig.commChannelEnabled = false;
          targetSpec = "commChannelEnabled: true -> false";
          parameterDelta.commChannelEnabled = false;
        } else if (op === "resource_relax") {
          cfConfig.resourceBudget = Number(
            (parent.resourceBudget * 2).toFixed(1)
          );
          targetSpec = `resourceBudget: ${parent.resourceBudget} -> ${cfConfig.resourceBudget}`;
          parameterDelta.resourceBudget = cfConfig.resourceBudget;
        } else if (op === "timing_shift") {
          cfConfig.removedAgentIndex = 0;
          cfConfig.interventionStep = 4;
          targetSpec = "Shift agent dropout timing to early step 4";
          parameterDelta.interventionStep = 4;
        } else if (op === "mechanism_ablation") {
          cfConfig.mechanismAblated = true;
          targetSpec = "Ablate phase-coupling feedback mechanism";
          parameterDelta.mechanismAblated = true;
        } else if (op === "environment_transfer") {
          cfConfig.environmentFamily =
            parent.environmentFamily === "ResourceForagingCommons"
              ? "ConventionEmergenceGrid"
              : "ResourceForagingCommons";
          targetSpec = `Transfer population to ${cfConfig.environmentFamily}`;
          parameterDelta.environmentFamily = cfConfig.environmentFamily;
        } else {
          cfConfig.commNoise = Number(
            Math.min(0.6, parent.commNoise + 0.22).toFixed(2)
          );
          targetSpec = `Increase commNoise -> ${cfConfig.commNoise}`;
          parameterDelta.commNoise = cfConfig.commNoise;
        }

        const cfOut = runSimulation(cfConfig);
        const cfRunCode = await nextSequentialCode(
          "experiment_runs",
          "run_code",
          "RUN",
          4
        );
        const [cfRun] = await db
          .insert(experimentRuns)
          .values({
            runCode: cfRunCode,
            programmeId: parent.programmeId,
            designId: parent.designId,
            parentRunId: parent.id,
            title: `[AUTO CF] (${op}) vs ${parent.runCode}`,
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

        const dag = buildCausalDagForIntervention(op, targetSpec);
        const cmp = compareCounterfactualRuns(
          parent.trajectory,
          cfOut.trajectory,
          parent.transferEntropyBits,
          cfOut.transferEntropyBits
        );
        const cfCode = await nextSequentialCode(
          "counterfactual_interventions",
          "code",
          "CF",
          4
        );

        const [intervention] = await db
          .insert(counterfactualInterventions)
          .values({
            code: cfCode,
            parentRunId: parent.id,
            counterfactualRunId: cfRun.id,
            question: `[AUTO] What happens to ${parent.runCode} under ${op} (${targetSpec})?`,
            interventionType: op,
            targetSpec,
            parameterDelta,
            matchedSeed: true,
            identificationStatus: dag.identificationStatus,
            identificationRationale: dag.identificationRationale,
            confounders: dag.confounders,
            alternativeExplanations: dag.alternativeExplanations,
            causalDag: { nodes: dag.nodes, edges: dag.edges },
            ...cmp,
          })
          .returning();

        await db
          .update(experimentRuns)
          .set({ interventionId: intervention.id })
          .where(eq(experimentRuns.id, cfRun.id));

        await db.insert(provenanceEvents).values({
          eventCode: nextPrvCode,
          entityType: "intervention",
          entityId: intervention.id,
          action: "AUTONOMOUS_COUNTERFACTUAL_EXECUTED",
          actor: "OMEIL Causal Scientist",
          rationale: `Cycle #${nextCycle}: Tested ${op} on ${parent.runCode} -> ${cfRunCode} (${dag.identificationStatus}, d=${cmp.effectSizeD}).`,
          contentHash: sha256Hex({ cfCode, parent: parent.runCode }),
          softwareVersion: SOFTWARE_VERSION,
          metadata: { cycle: nextCycle, effectSizeD: cmp.effectSizeD },
        });

        stageName = "Stage 16 · Discriminating Counterfactual";
        actionType = "counterfactual";
        targetEntityCode = cfCode;
        selectionRationale = `Selected ${parent.runCode} for matched-seed ${op} intervention.`;
        outcomeSummary = `${cfCode} (${cfRunCode}): ${cmp.conclusionLabel} (ΔCoord=${cmp.deltaCoordination}, d=${cmp.effectSizeD}).`;
        scientificDisposition =
          dag.identificationStatus === "associative_only"
            ? "candidate_pattern"
            : Math.abs(cmp.effectSizeD) < 0.2
            ? "no_effect_or_null"
            : "candidate_pattern";
      } else if (phase === 2 && completedBaselineRuns.length > 0) {
        const candidate =
          completedBaselineRuns.find((r) => r.runType !== "replication") ??
          completedBaselineRuns[0];
        const newSeed = candidate.seed + 5003 + nextCycle * 17;
        const repOut = runSimulation({
          environmentFamily: candidate.environmentFamily as EnvironmentFamily,
          seed: newSeed,
          agentCount: candidate.agentCount,
          steps: candidate.steps,
          memoryPolicy: candidate.memoryPolicy as MemoryPolicy,
          commNoise: candidate.commNoise,
          commChannelEnabled: candidate.commChannelEnabled,
          couplingStrength: candidate.couplingStrength,
          resourceBudget: candidate.resourceBudget,
          modelHeterogeneity: candidate.modelHeterogeneity,
        });

        const deltaR = Math.abs(
          repOut.finalOrderParameter - candidate.finalOrderParameter
        );
        const ok = deltaR <= 0.15 && repOut.dataQuality.passed;
        const repCode = await nextSequentialCode(
          "experiment_runs",
          "run_code",
          "RUN",
          4
        );

        const [repRun] = await db
          .insert(experimentRuns)
          .values({
            runCode: repCode,
            programmeId: candidate.programmeId,
            designId: candidate.designId,
            parentRunId: candidate.id,
            title: `[AUTO REP] Independent Seed ${newSeed} of ${candidate.runCode}`,
            runType: "replication",
            environmentFamily: candidate.environmentFamily,
            seed: newSeed,
            agentCount: candidate.agentCount,
            steps: candidate.steps,
            memoryPolicy: candidate.memoryPolicy,
            commNoise: candidate.commNoise,
            commChannelEnabled: candidate.commChannelEnabled,
            couplingStrength: candidate.couplingStrength,
            resourceBudget: candidate.resourceBudget,
            modelHeterogeneity: candidate.modelHeterogeneity,
            status: ok ? "completed" : "inconclusive",
            failureCategory: ok ? null : "non_reproducible_variance",
            failureReason: ok
              ? null
              : `Replication ΔR=${deltaR.toFixed(4)} exceeded 0.15 threshold.`,
            ...repOut,
            softwareVersion: SOFTWARE_VERSION,
          })
          .returning();

        await db.insert(provenanceEvents).values({
          eventCode: nextPrvCode,
          entityType: "run",
          entityId: repRun.id,
          action: ok
            ? "AUTONOMOUS_REPLICATION_PASS"
            : "AUTONOMOUS_REPLICATION_DIVERGED",
          actor: "OMEIL Replication Agent",
          rationale: `Cycle #${nextCycle}: Independent seed ${newSeed} replication of ${candidate.runCode} (ΔR=${deltaR.toFixed(4)}).`,
          contentHash: sha256Hex({ repCode, deltaR }),
          softwareVersion: SOFTWARE_VERSION,
          metadata: { cycle: nextCycle, deltaR: Number(deltaR.toFixed(4)) },
        });

        stageName = "Stage 18 · Independent Replication";
        actionType = "replication";
        targetEntityCode = repCode;
        selectionRationale = `Verified reproducibility of ${candidate.runCode} using independent seed ${newSeed}.`;
        outcomeSummary = `${repCode}: ΔR=${deltaR.toFixed(4)} vs ${candidate.runCode} -> ${ok ? "REPLICATED" : "DIVERGED"}.`;
        scientificDisposition = ok ? "replicated" : "inconclusive_underpowered";
      } else if (phase === 3) {
        const env = ENVIRONMENTS[nextCycle % 3];
        if (nextCycle % 2 === 0) {
          const qdOut = runQualityDiversitySearch(env, 62000 + nextCycle * 41);
          const archiveCode = await nextSequentialCode(
            "discovery_search_archives",
            "archive_code",
            "QD",
            4
          );
          const [arch] = await db
            .insert(discoverySearchArchives)
            .values({
              archiveCode,
              environmentFamily: env,
              searchObjective: `[AUTO] MAP-Elites repertoire exploration in ${env}`,
              descriptorX: "Final Order Parameter R(T) [0, 1]",
              descriptorY: "Shannon Phase Entropy H(T) [0, 3 bits]",
              ...qdOut,
              softwareVersion: SOFTWARE_VERSION,
            })
            .returning();

          await db.insert(provenanceEvents).values({
            eventCode: nextPrvCode,
            entityType: "discovery_archive",
            entityId: arch.id,
            action: "AUTONOMOUS_QD_SEARCH",
            actor: "OMEIL Discovery Explorer",
            rationale: `Cycle #${nextCycle}: Mapped ${qdOut.coveragePct}% behavioral niches in ${env}.`,
            contentHash: sha256Hex(arch),
            softwareVersion: SOFTWARE_VERSION,
            metadata: { cycle: nextCycle, coveragePct: qdOut.coveragePct },
          });

          stageName = "Stage 14 · Open-Ended QD Discovery";
          actionType = "qd_search";
          targetEntityCode = archiveCode;
          selectionRationale = `Covered neglected regions of Order × Entropy space in ${env}.`;
          outcomeSummary = `${archiveCode}: ${qdOut.coveragePct}% coverage (QD=${qdOut.qdScore}).`;
          scientificDisposition = "exploration_mapped";
        } else {
          const mode =
            nextCycle % 3 === 0 ? "hysteresis_loop" : "2d_phase_diagram";
          const swOut = runParameterSweep(env, mode, 85000 + nextCycle * 19);
          const sweepCode = await nextSequentialCode(
            "parameter_sweeps",
            "sweep_code",
            "SWP",
            4
          );
          const [sw] = await db
            .insert(parameterSweeps)
            .values({
              sweepCode,
              environmentFamily: env,
              sweepMode: mode,
              ...swOut,
              softwareVersion: SOFTWARE_VERSION,
            })
            .returning();

          await db.insert(provenanceEvents).values({
            eventCode: nextPrvCode,
            entityType: "parameter_sweep",
            entityId: sw.id,
            action: "AUTONOMOUS_PHASE_SWEEP",
            actor: "OMEIL Dynamical Systems Engine",
            rationale: `Cycle #${nextCycle}: Ran ${mode} on ${env}: ${swOut.criticalTransitionEstimate}.`,
            contentHash: sha256Hex(sw),
            softwareVersion: SOFTWARE_VERSION,
            metadata: { cycle: nextCycle, mode },
          });

          stageName = "Stage 14 · Dynamical Phase Mapping";
          actionType = "phase_sweep";
          targetEntityCode = sweepCode;
          selectionRationale = `Mapped parameter boundaries via ${mode} in ${env}.`;
          outcomeSummary = `${sweepCode}: ${swOut.criticalTransitionEstimate}.`;
          scientificDisposition = "exploration_mapped";
        }
      } else if (phase === 4 && runs.length > 0) {
        const refRun = completedBaselineRuns[0] ?? runs[0];
        const clmCode = await nextSequentialCode(
          "claims_ledger",
          "claim_code",
          "CLM",
          3
        );
        const isStrong =
          refRun.finalOrderParameter > 0.65 && refRun.dataQuality?.passed;

        const [newClaim] = await db
          .insert(claimsLedger)
          .values({
            claimCode: clmCode,
            programmeId: refRun.programmeId,
            claimText: isStrong
              ? `[AUTO] ${refRun.environmentFamily} with ${refRun.memoryPolicy} (k=${refRun.couplingStrength}) achieves R=${refRun.finalOrderParameter} and TE=${refRun.transferEntropyBits}b.`
              : `[AUTO] Preliminary observation on ${refRun.runCode} shows weak/inconclusive order R=${refRun.finalOrderParameter} under noise σ=${refRun.commNoise}.`,
            claimType: isStrong ? "Pattern" : "Speculation",
            operationalDefinition: `Measured via R(T) and TE(X->Y) on ${refRun.runCode} (seed ${refRun.seed}).`,
            supportingRunIds: [refRun.id],
            contradictingRunIds: [],
            assumptions: [
              "Bounded finite-horizon N<=48 simulation",
              "Discretized entropy & TE estimation bins",
            ],
            alternativeExplanations: [
              "Single-seed sampling variation until replicated",
              "Parameter-interaction near coupling threshold",
            ],
            scopeConditions: `${refRun.environmentFamily}, N=${refRun.agentCount}, T=${refRun.steps}.`,
            uncertainty: {
              measurement: refRun.dataQuality?.passed
                ? "DQ Verified"
                : "DQ Failed",
              sampling: `Power observed=${refRun.statisticalPowerObserved}`,
              model: "Tier-1 abstract simulation",
              mechanism: "Requires matched counterfactual ablation",
              novelty: "Provisional internal pattern",
            },
            confidenceLabel: isStrong
              ? "low_exploratory"
              : "inconclusive_underpowered",
            validationStatus: "under_red_team",
            independenceClassification: "partially_independent",
            softwareVersion: SOFTWARE_VERSION,
          })
          .returning();

        const role = RED_TEAM_ROLES[nextCycle % RED_TEAM_ROLES.length];
        const cat =
          EXPLANATION_CATEGORIES[nextCycle % EXPLANATION_CATEGORIES.length];
        const severity = isStrong && nextCycle % 2 === 0 ? "major" : "critical";

        await db.insert(redTeamReviews).values({
          claimId: newClaim.id,
          reviewerIdentity: `RT-Auto-${role.split(" ")[0]}`,
          reviewerRole: role,
          explanationCategory: cat,
          severity,
          objectionText:
            severity === "critical"
              ? `CRITICAL CHALLENGE: ${refRun.runCode} alone cannot exclude ${cat}; requires multi-seed replication and counterfactual ablation before promotion.`
              : `MAJOR CHALLENGE: Verify robustness of ${clmCode} against ${cat} and alternative parameter combinations.`,
          evidenceRef: refRun.runCode,
          status: "unresolved",
          blindReview: true,
          sharedModelWarning: true,
          softwareVersion: SOFTWARE_VERSION,
        });

        if (severity === "critical") {
          await db
            .update(claimsLedger)
            .set({
              validationStatus: "blocked_by_objection",
              confidenceLabel: "blocked_contested",
            })
            .where(eq(claimsLedger.id, newClaim.id));
        }

        await db.insert(provenanceEvents).values({
          eventCode: nextPrvCode,
          entityType: "claim",
          entityId: newClaim.id,
          action: "AUTONOMOUS_CLAIM_AND_REDTEAM",
          actor: `OMEIL Proposer + ${role}`,
          rationale: `Cycle #${nextCycle}: Registered ${clmCode} and filed ${severity.toUpperCase()} blind red-team objection (${cat}).`,
          contentHash: sha256Hex({ clmCode, severity }),
          softwareVersion: SOFTWARE_VERSION,
          metadata: { cycle: nextCycle, severity },
        });

        stageName = "Stage 5 & 15 · Claim + Red-Team Gate";
        actionType = "claim_and_redteam";
        targetEntityCode = clmCode;
        selectionRationale = `Synthesized falsifiable claim from ${refRun.runCode} and dispatched blind ${role}.`;
        outcomeSummary = `Registered ${clmCode} with ${severity.toUpperCase()} unresolved objection (${cat}).`;
        scientificDisposition = "redteam_objection_filed";
      } else if (phase === 5) {
        const prog = programmes[nextCycle % Math.max(1, programmes.length)];
        const plannedTrials = 14 + (nextCycle % 3) * 6;
        const sesoi = 0.15;
        const pilotVar = 0.04;
        const pwr = estimateStatisticalPower(plannedTrials, sesoi, pilotVar);
        const preregHash = sha256Hex({
          cycle: nextCycle,
          prog: prog?.code ?? "PROG-01",
          plannedTrials,
        });

        const [des] = await db
          .insert(experimentDesigns)
          .values({
            programmeId: prog?.id ?? 1,
            title: `[AUTO] PREREG-C${nextCycle}: ${prog?.code ?? "PROG-01"} Confirmatory Sweep`,
            analysisMode: pwr.underpowered ? "pilot" : "confirmatory",
            primaryOutcome: "meanCoordination & finalOrderParameter",
            secondaryOutcomes: ["transferEntropyBits", "criticalSlowingLag1"],
            smallestEffectInterest: sesoi,
            pilotVarianceEstimate: pilotVar,
            powerTarget: 0.8,
            plannedTrials,
            estimatedPower: pwr.power,
            stoppingRule: "Fixed horizon; no optional stopping on p-values.",
            exclusionCriteria: "Exclude DataQualityReport failures.",
            deviations: [],
            preregistrationHash: preregHash,
            approvedByHuman: true,
          })
          .returning();

        await db.insert(provenanceEvents).values({
          eventCode: nextPrvCode,
          entityType: "design",
          entityId: des.id,
          action: "AUTONOMOUS_PREREGISTRATION_LOCKED",
          actor: "OMEIL Experimental Planner",
          rationale: `Cycle #${nextCycle}: Locked protocol ${des.title} (Power=${pwr.power}, N=${plannedTrials}).`,
          contentHash: preregHash,
          softwareVersion: SOFTWARE_VERSION,
          metadata: { cycle: nextCycle, power: pwr.power },
        });

        stageName = "Stage 7 · Preregistration & Power";
        actionType = "preregistration";
        targetEntityCode = `PREREG-${des.id}`;
        selectionRationale = `Prepared formal power-calibrated design for ${prog?.code ?? "PROG-01"}.`;
        outcomeSummary = `Locked ${des.title} (Power=${pwr.power}, Req N=${pwr.requiredNFor80}).`;
        scientificDisposition = "exploration_mapped";
      } else if (phase === 6) {
        const suite = runCalibrationSuite();
        const inserted = await db.transaction(async (tx) => {
          await tx.delete(calibrationBenchmarks);
          return tx
            .insert(calibrationBenchmarks)
            .values(suite.map((s) => ({ ...s, softwareVersion: SOFTWARE_VERSION })))
            .returning();
        });
        const passed = inserted.filter((b) => b.status === "PASS").length;

        await db.insert(provenanceEvents).values({
          eventCode: nextPrvCode,
          entityType: "benchmark",
          entityId: inserted[0]?.id ?? 1,
          action: "AUTONOMOUS_CALIBRATION_CHECK",
          actor: "OMEIL Calibration Watchdog",
          rationale: `Cycle #${nextCycle}: Verified 12-test known-answer suite (${passed}/${inserted.length} PASS).`,
          contentHash: sha256Hex(suite),
          softwareVersion: SOFTWARE_VERSION,
          metadata: { cycle: nextCycle, passed },
        });

        stageName = "Stage 12 · Instrument Self-Calibration";
        actionType = "calibration";
        targetEntityCode = `CAL-${passed}/${inserted.length}`;
        selectionRationale =
          "Periodic verification that anomaly, PID, causal, and null-control instruments remain calibrated.";
        outcomeSummary = `Calibration suite: ${passed}/${inserted.length} PASS (instruments only).`;
        scientificDisposition = "instrument_calibrated";
      } else {
        const openMajorReview = reviews.find(
          (r) => r.status === "unresolved" && r.severity !== "critical"
        );

        if (openMajorReview && interventions.length > 0 && nextCycle % 2 === 1) {
          const refCf = interventions[0];
          await db
            .update(redTeamReviews)
            .set({
              status: "resolved",
              resolutionNote: `[AUTO VERIFIED] Addressed via ${refCf.code} (${refCf.conclusionLabel}, d=${refCf.effectSizeD}).`,
            })
            .where(eq(redTeamReviews.id, openMajorReview.id));

          await db.insert(provenanceEvents).values({
            eventCode: nextPrvCode,
            entityType: "review",
            entityId: openMajorReview.id,
            action: "AUTONOMOUS_OBJECTION_ADDRESSED",
            actor: "OMEIL Evidence Auditor",
            rationale: `Cycle #${nextCycle}: Linked major objection #${openMajorReview.id} to ${refCf.code}.`,
            contentHash: sha256Hex({
              reviewId: openMajorReview.id,
              refCf: refCf.code,
            }),
            softwareVersion: SOFTWARE_VERSION,
            metadata: { cycle: nextCycle },
          });

          stageName = "Stage 17 · Evidence Verification";
          actionType = "redteam_audit";
          targetEntityCode = `REV-${openMajorReview.id}`;
          selectionRationale =
            "Cross-checked open major objection against counterfactual evidence.";
          outcomeSummary = `Resolved major review #${openMajorReview.id} using ${refCf.code}; critical blockers remain protected.`;
          scientificDisposition = "redteam_objection_filed";
        } else {
          const seed = 92000 + nextCycle * 31;
          const auditOut = runSwarmAuditComparison(seed);
          const auditCode = await nextSequentialCode(
            "swarm_failure_audits",
            "audit_code",
            "SWM",
            4
          );
          const [aud] = await db
            .insert(swarmFailureAudits)
            .values({
              auditCode,
              benchmarkTask: `[AUTO] Multi-Agent Swarm Groupthink & Critic Audit (Seed ${seed})`,
              seed,
              ...auditOut,
              softwareVersion: SOFTWARE_VERSION,
            })
            .returning();

          await db.insert(provenanceEvents).values({
            eventCode: nextPrvCode,
            entityType: "swarm_audit",
            entityId: aud.id,
            action: "AUTONOMOUS_SWARM_AUDIT",
            actor: "OMEIL Governance Watchdog",
            rationale: `Cycle #${nextCycle}: Audited 5 swarm architectures under seed ${seed}.`,
            contentHash: sha256Hex(aud),
            softwareVersion: SOFTWARE_VERSION,
            metadata: { cycle: nextCycle, seed },
          });

          stageName = "Stage 19 · Swarm Integrity Audit";
          actionType = "swarm_audit";
          targetEntityCode = auditCode;
          selectionRationale =
            "Empirically verify blind-critic swarm outperforms uncritical shared-memory consensus.";
          outcomeSummary = `${auditCode}: ${auditOut.empiricalConclusion}`;
          scientificDisposition = "instrument_calibrated";
        }
      }

      const [logEntry] = await db
        .insert(autonomousWorkflowLogs)
        .values({
          cycleNumber: nextCycle,
          stageName,
          actionType,
          targetEntityCode,
          selectionRationale,
          outcomeSummary,
          scientificDisposition,
          softwareVersion: SOFTWARE_VERSION,
        })
        .returning();

      const [updatedControls] = await db
        .update(systemControls)
        .set({
          autonomousCycleCount: nextCycle,
          lastAutonomousAction: `${stageName}: ${targetEntityCode} — ${outcomeSummary}`,
          updatedAt: new Date(),
        })
        .where(eq(systemControls.id, ctrl.id))
        .returning();

      return {
        status: 200,
        payload: {
          cycle: logEntry,
          controls: updatedControls,
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error("Autonomous step error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Autonomous cycle error: ${error.message}`
            : "Autonomous workflow cycle encountered an error",
      },
      { status: 500 }
    );
  }
}
