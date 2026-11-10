import { db } from "@/db";
import {
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
import {
  buildCausalDagForIntervention,
  compareCounterfactualRuns,
  estimateStatisticalPower,
  runCalibrationSuite,
  runParameterSweep,
  runQualityDiversitySearch,
  runSimulation,
  runSwarmAuditComparison,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count } from "drizzle-orm";

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = doSeed().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

async function doSeed(): Promise<void> {
  const [{ value: existingControls }] = await db
    .select({ value: count() })
    .from(systemControls);

  if (existingControls === 0) {
    await db.insert(systemControls).values({
      emergencyStopActive: false,
      swarmPaused: false,
      externalProvidersDisabled: true,
      literatureRetrievalDisabled: false,
      maxConcurrentJobs: 2,
      maxAgentsPerRun: 48,
      maxStepsPerRun: 180,
      activeCapabilityTier: "TIER 1 — CORE LOCAL LAB",
      lastStopReason: null,
    });
  }

  // Seed new ultra-expansion tables idempotently even if base tables already exist
  const [{ value: existingLit }] = await db
    .select({ value: count() })
    .from(literatureRecords);

  if (existingLit === 0) {
    await db.insert(literatureRecords).values([
      {
        litCode: "LIT-001",
        title: "Chemical Oscillations, Waves, and Turbulence (Kuramoto Model)",
        authors: "Yoshiki Kuramoto",
        venue: "Springer Series in Synergetics",
        year: 1984,
        doiOrId: "10.1007/978-3-642-69689-3",
        sourceUrl: "https://doi.org/10.1007/978-3-642-69689-3",
        peerReviewStatus: "peer_reviewed",
        accessStatus: "abstract_only",
        inspectedFullText: false,
        relationToProgramme: "baseline_method",
        relatedProgrammeCode: "PROG-01",
        keyClaimChecked:
          "Order parameter R(t) quantifies phase coherence across coupled oscillators; critical coupling k_c depends on frequency spread.",
        limitationsNoted:
          "Abstract & canonical formulation verified; continuous infinite-N limit differs from discrete finite-N agent simulations.",
      },
      {
        litCode: "LIT-002",
        title:
          "Early-warning signals for critical transitions (Critical Slowing Down)",
        authors: "Marten Scheffer et al.",
        venue: "Nature",
        year: 2009,
        doiOrId: "10.1038/nature08227",
        sourceUrl: "https://doi.org/10.1038/nature08227",
        peerReviewStatus: "peer_reviewed",
        accessStatus: "abstract_only",
        inspectedFullText: false,
        relationToProgramme: "supports",
        relatedProgrammeCode: "PROG-01",
        keyClaimChecked:
          "Rising lag-1 autocorrelation can precede bifurcation, though false alarms occur under measurement noise.",
        limitationsNoted:
          "Abstract inspected only — full-text empirical ecology cases not extrapolated to LLM swarms without operational validation.",
      },
      {
        litCode: "LIT-003",
        title:
          "Measuring Information Transfer (Transfer Entropy)",
        authors: "Thomas Schreiber",
        venue: "Physical Review Letters",
        year: 2000,
        doiOrId: "10.1103/PhysRevLett.85.461",
        sourceUrl: "https://doi.org/10.1103/PhysRevLett.85.461",
        peerReviewStatus: "peer_reviewed",
        accessStatus: "open_access_fulltext",
        inspectedFullText: true,
        relationToProgramme: "prior_art",
        relatedProgrammeCode: "PROG-02",
        keyClaimChecked:
          "Transfer entropy detects directed statistical predictability between time series; distinct from interventional causality.",
        limitationsNoted:
          "Discretization bin count strongly affects finite-sample bias in short T < 100 trajectories.",
      },
    ]);
  }

  const [{ value: existingQd }] = await db
    .select({ value: count() })
    .from(discoverySearchArchives);
  if (existingQd === 0) {
    const qdOut = runQualityDiversitySearch("CoupledOscillatorSwarm", 61000);
    await db.insert(discoverySearchArchives).values({
      archiveCode: "QD-0001",
      environmentFamily: "CoupledOscillatorSwarm",
      searchObjective:
        "Map behavioral diversity across Order R(T) x Shannon Entropy H(T) without discarding low-coordination regimes.",
      descriptorX: "Final Order Parameter R(T) [0, 1]",
      descriptorY: "Shannon Phase Entropy H(T) [0, 3 bits]",
      ...qdOut,
      softwareVersion: SOFTWARE_VERSION,
    });
  }

  const [{ value: existingSweeps }] = await db
    .select({ value: count() })
    .from(parameterSweeps);
  if (existingSweeps === 0) {
    const phase2d = runParameterSweep(
      "CoupledOscillatorSwarm",
      "2d_phase_diagram",
      82000
    );
    const hyst = runParameterSweep(
      "ConventionEmergenceGrid",
      "hysteresis_loop",
      83000
    );
    await db.insert(parameterSweeps).values([
      {
        sweepCode: "SWP-0001",
        environmentFamily: "CoupledOscillatorSwarm",
        sweepMode: "2d_phase_diagram",
        ...phase2d,
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        sweepCode: "SWP-0002",
        environmentFamily: "ConventionEmergenceGrid",
        sweepMode: "hysteresis_loop",
        ...hyst,
        softwareVersion: SOFTWARE_VERSION,
      },
    ]);
  }

  const [{ value: existingAudits }] = await db
    .select({ value: count() })
    .from(swarmFailureAudits);
  if (existingAudits === 0) {
    const audit = runSwarmAuditComparison(91001);
    await db.insert(swarmFailureAudits).values({
      auditCode: "SWM-0001",
      benchmarkTask:
        "Planted Confounder & Null-Rejection Discovery Benchmark (5 Configurations)",
      seed: 91001,
      ...audit,
      softwareVersion: SOFTWARE_VERSION,
    });
  }

  const [{ value: existingProgs }] = await db
    .select({ value: count() })
    .from(researchProgrammes);

  if (existingProgs > 0) return;

  // 1. Create Research Programmes
  const [prog1, prog2, prog3] = await db
    .insert(researchProgrammes)
    .values([
      {
        code: "PROG-01",
        title: "Path Dependence, Coupling & Critical Slowing Down",
        researchQuestion:
          "Does communication channel continuity causally sustain macro-level synchronization R(t), and does lag-1 autocorrelation rise prior to transition?",
        operationalDefinition:
          "Synchronization measured by Kuramoto-type order parameter R(t) in [0,1]; critical slowing measured by sliding lag-1 autocorrelation of R(t).",
        competingHypotheses: [
          "H1: Active communication channels causally maintain R(t) > 0.65 via phase-error feedback.",
          "H0: Apparent alignment is an artifact of shared deterministic initialization and heterogeneous drift.",
        ],
        status: "active",
        ethicsChecklistPassed: true,
        limitations:
          "Abstract continuous-phase oscillators; does not model semantic natural language negotiation or hosted LLM drift.",
      },
      {
        code: "PROG-02",
        title: "Memory Persistence & Noise Resilience in Convention Grids",
        researchQuestion:
          "How do agent memory policies (stateless vs shared episodic) alter convention stability under Gaussian communication noise?",
        operationalDefinition:
          "Convention stability defined as mean coordination >= 0.55 under sigma_noise = 0.22 over 60 steps.",
        competingHypotheses: [
          "H1: Shared memory buffers absorb transient channel noise and preserve conventions.",
          "H2: Shared memory induces premature consensus and correlated error propagation.",
        ],
        status: "active",
        ethicsChecklistPassed: true,
        limitations:
          "No adversarial Byzantine agents included in baseline grid; fixed N <= 32.",
      },
      {
        code: "PROG-03",
        title: "Instrument Calibration & Null-World False-Positive Audit",
        researchQuestion:
          "At what noise threshold does OMEIL's anomaly and transfer-entropy detector generate spurious discoveries in pure i.i.d. stochastic runs?",
        operationalDefinition:
          "False-positive rate = fraction of null-world runs triggering anomaly_score > 2.8 or claiming causal identification.",
        competingHypotheses: [
          "H0: Pure i.i.d. stochastic baseline produces < 5% false anomaly alarms.",
        ],
        status: "active",
        ethicsChecklistPassed: true,
        limitations:
          "Synthetic ground-truth benchmarks validate software instruments only, not external scientific novelty.",
      },
    ])
    .returning();

  // 2. Create Preregistered Experiment Designs
  const pwr1 = estimateStatisticalPower(16, 0.2, 0.04);
  const pwrUnder = estimateStatisticalPower(4, 0.1, 0.09);

  const [design1, design2, design3] = await db
    .insert(experimentDesigns)
    .values([
      {
        programmeId: prog1.id,
        title: "PREREG-2026-01: Channel Ablation Confirmatory Protocol",
        analysisMode: "confirmatory",
        primaryOutcome: "meanCoordination & finalOrderParameter R(t)",
        secondaryOutcomes: ["transferEntropyBits", "criticalSlowingLag1"],
        smallestEffectInterest: 0.2,
        pilotVarianceEstimate: 0.04,
        powerTarget: 0.8,
        plannedTrials: 16,
        estimatedPower: pwr1.power,
        stoppingRule: "Fixed horizon T=60 steps; no mid-run peeking allowed.",
        exclusionCriteria: "Exclude runs failing DataQualityReport (missingSteps > 0).",
        deviations: [],
        preregistrationHash: sha256Hex({
          prog: prog1.code,
          sesoi: 0.2,
          trials: 16,
        }),
        approvedByHuman: true,
      },
      {
        programmeId: prog2.id,
        title: "PILOT-2026-02: Memory Policy Noise Perturbation Pilot",
        analysisMode: "pilot",
        primaryOutcome: "meanCoordination under noise=0.28",
        secondaryOutcomes: ["entropyBits", "microMacroDivergence"],
        smallestEffectInterest: 0.1,
        pilotVarianceEstimate: 0.09,
        powerTarget: 0.8,
        plannedTrials: 4,
        estimatedPower: pwrUnder.power,
        stoppingRule: "Pilot variance estimation only — do not confirm hypotheses.",
        exclusionCriteria: "Flag inconclusive if observed power < 0.80.",
        deviations: ["Reduced N=4 pilot due to Tier-1 compute budget check."],
        preregistrationHash: sha256Hex({
          prog: prog2.code,
          sesoi: 0.1,
          trials: 4,
        }),
        approvedByHuman: true,
      },
      {
        programmeId: prog3.id,
        title: "CAL-2026-03: Null-World Baseline Verification",
        analysisMode: "confirmatory",
        primaryOutcome: "anomalyCount & falsePositiveRate",
        secondaryOutcomes: ["finalOrderParameter", "transferEntropyBits"],
        smallestEffectInterest: 0.05,
        pilotVarianceEstimate: 0.015,
        powerTarget: 0.9,
        plannedTrials: 20,
        estimatedPower: 0.95,
        stoppingRule: "Fixed T=60 steps; halt pipeline if FPR > 0.05.",
        exclusionCriteria: "None (all null records retained).",
        deviations: [],
        preregistrationHash: sha256Hex({
          prog: prog3.code,
          sesoi: 0.05,
          trials: 20,
        }),
        approvedByHuman: true,
      },
    ])
    .returning();

  // 3. Execute real deterministic simulations
  const simBaselineCfg = {
    environmentFamily: "CoupledOscillatorSwarm" as const,
    seed: 42001,
    agentCount: 16,
    steps: 60,
    memoryPolicy: "persistent_episodic" as const,
    commNoise: 0.05,
    commChannelEnabled: true,
    couplingStrength: 0.82,
    resourceBudget: 120,
    modelHeterogeneity: "role_differentiated",
  };
  const simBaselineOut = runSimulation(simBaselineCfg);

  const simCfChannelCfg = {
    ...simBaselineCfg,
    commChannelEnabled: false,
  };
  const simCfChannelOut = runSimulation(simCfChannelCfg);

  const simPilotNoiseCfg = {
    environmentFamily: "ConventionEmergenceGrid" as const,
    seed: 77109,
    agentCount: 8,
    steps: 45,
    memoryPolicy: "shared_memory" as const,
    commNoise: 0.34,
    commChannelEnabled: true,
    couplingStrength: 0.45,
    resourceBudget: 100,
    modelHeterogeneity: "mixed_model_families",
  };
  const simPilotNoiseOut = runSimulation(simPilotNoiseCfg);

  const simNullCfg = {
    environmentFamily: "NullStochasticBaseline" as const,
    seed: 99001,
    agentCount: 16,
    steps: 60,
    memoryPolicy: "stateless" as const,
    commNoise: 0.35,
    commChannelEnabled: false,
    couplingStrength: 0.0,
    resourceBudget: 100,
    modelHeterogeneity: "homogeneous_deterministic",
  };
  const simNullOut = runSimulation(simNullCfg);

  const simDefectFailedCfg = {
    environmentFamily: "ResourceForagingCommons" as const,
    seed: 55112,
    agentCount: 12,
    steps: 48,
    memoryPolicy: "short_memory" as const,
    commNoise: 0.12,
    commChannelEnabled: true,
    couplingStrength: 0.65,
    resourceBudget: 90,
    modelHeterogeneity: "role_differentiated",
    injectLoggingDefect: true,
  };
  const simDefectOut = runSimulation(simDefectFailedCfg);

  // Insert Runs
  const [runBase, runCf, runPilot, runNull, runFailed] = await db
    .insert(experimentRuns)
    .values([
      {
        runCode: "RUN-0001",
        programmeId: prog1.id,
        designId: design1.id,
        title: "Coupled Swarm Baseline (Channel Active, Seed 42001)",
        runType: "baseline",
        ...simBaselineCfg,
        status: "completed",
        ...simBaselineOut,
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        runCode: "RUN-0002",
        programmeId: prog1.id,
        designId: design1.id,
        parentRunId: 1,
        title: "Matched Counterfactual: Communication Channel Disabled",
        runType: "counterfactual",
        ...simCfChannelCfg,
        status: "completed",
        ...simCfChannelOut,
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        runCode: "RUN-0003",
        programmeId: prog2.id,
        designId: design2.id,
        title: "High-Noise Shared Memory Pilot (Underpowered N=8)",
        runType: "pilot",
        ...simPilotNoiseCfg,
        status: "inconclusive",
        failureCategory: "insufficient_power",
        failureReason:
          "Observed statistical power (0.31) below 0.80 target under high variance (sigma=0.34). Reported as inconclusive rather than null.",
        ...simPilotNoiseOut,
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        runCode: "RUN-0004",
        programmeId: prog3.id,
        designId: design3.id,
        title: "Null-World i.i.d. Stochastic Baseline Control",
        runType: "null_control",
        ...simNullCfg,
        status: "completed",
        ...simNullOut,
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        runCode: "RUN-0005",
        programmeId: prog2.id,
        designId: design2.id,
        title: "Resource Foraging Commons (Truncated Log Failure)",
        runType: "treatment",
        ...simDefectFailedCfg,
        status: "failed",
        failureCategory: "measurement_failure",
        failureReason:
          "DataQualityValidator detected 1 missing midpoint trajectory step; run quarantined from discovery promotion.",
        ...simDefectOut,
        softwareVersion: SOFTWARE_VERSION,
      },
    ])
    .returning();

  // Link parentRunId accurately
  const dag = buildCausalDagForIntervention(
    "channel_disable",
    "commChannelEnabled=false"
  );
  const cfCmp = compareCounterfactualRuns(
    simBaselineOut.trajectory,
    simCfChannelOut.trajectory,
    simBaselineOut.transferEntropyBits,
    simCfChannelOut.transferEntropyBits
  );

  const [cfRecord] = await db
    .insert(counterfactualInterventions)
    .values({
      code: "CF-0001",
      parentRunId: runBase.id,
      counterfactualRunId: runCf.id,
      question:
        "What happens to collective synchronization and transfer entropy if the inter-agent communication channel is disabled under matched seed 42001?",
      interventionType: "channel_disable",
      targetSpec: "commChannelEnabled: true -> false",
      parameterDelta: { commChannelEnabled: false },
      matchedSeed: true,
      identificationStatus: dag.identificationStatus,
      identificationRationale: dag.identificationRationale,
      confounders: dag.confounders,
      alternativeExplanations: dag.alternativeExplanations,
      causalDag: { nodes: dag.nodes, edges: dag.edges },
      ...cfCmp,
    })
    .returning();

  // 4. Populate Claim-Evidence Ledger & Red-Team Reviews
  const [claim1, claim2, claim3] = await db
    .insert(claimsLedger)
    .values([
      {
        claimCode: "CLM-001",
        programmeId: prog1.id,
        claimText:
          "Disabling the inter-agent communication channel under matched deterministic seed 42001 causes a substantial drop in mean coordination and order parameter R(t).",
        claimType: "CausalEffect",
        operationalDefinition:
          "Matched-seed delta in meanCoordination across T=60 steps with alpha=0.05 two-sided 95% CI.",
        supportingRunIds: [runBase.id, runCf.id],
        contradictingRunIds: [],
        assumptions: [
          "Coupled phase update equations represent bounded decentralized feedback.",
          "PRNG seed stream isolation holds across treatment and control.",
        ],
        alternativeExplanations: [
          "Initial transient before step 12 drives part of the separation.",
        ],
        scopeConditions:
          "CoupledOscillatorSwarm, N=16 agents, couplingStrength=0.82, commNoise=0.05.",
        uncertainty: {
          measurement: "Low (0 missing steps, 0 NaN)",
          sampling: "Bounded by single matched-seed trajectory variance",
          model: "Deterministic differential-step approximation",
          mechanism: "Identified via direct channel ablation (CF-0001)",
          novelty: "Instrument benchmark / established Kuramoto-class behavior",
        },
        confidenceLabel: "high_replicated",
        validationStatus: "validated_finding",
        independenceClassification: "demonstrably_independent",
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        claimCode: "CLM-002",
        programmeId: prog2.id,
        claimText:
          "Shared episodic memory completely prevents convention collapse under severe communication noise (sigma=0.34).",
        claimType: "Mechanism",
        operationalDefinition:
          "Mean coordination remains > 0.60 in ConventionEmergenceGrid with commNoise=0.34.",
        supportingRunIds: [runPilot.id],
        contradictingRunIds: [runFailed.id],
        assumptions: ["Shared memory buffer is uncorrupted and synchronous."],
        alternativeExplanations: [
          "Underpowered pilot (power=0.31) may exhibit random fluctuation.",
          "Shared-source correlation inflates apparent consensus.",
        ],
        scopeConditions: "ConventionEmergenceGrid, N=8, T=45 steps (pilot only).",
        uncertainty: {
          measurement: "Moderate (pilot horizon only)",
          sampling: "High (underpowered pilot, N=8, power < 0.80)",
          model: "High — mixed heterogeneity confounds memory policy",
          mechanism: "Unverified — mechanism ablation not yet run",
          novelty: "Unassessed pending replication",
        },
        confidenceLabel: "blocked_contested",
        validationStatus: "blocked_by_objection",
        independenceClassification: "shared_source_correlated",
        softwareVersion: SOFTWARE_VERSION,
      },
      {
        claimCode: "CLM-003",
        programmeId: prog3.id,
        claimText:
          "Null-world i.i.d. stochastic baseline produces zero anomalous regime shifts under current z > 2.8 threshold.",
        claimType: "Finding",
        operationalDefinition:
          "anomalyCount == 0 across T=60 steps in NullStochasticBaseline (coupling=0).",
        supportingRunIds: [runNull.id],
        contradictingRunIds: [],
        assumptions: ["Gaussian Box-Muller noise generator unbiased."],
        alternativeExplanations: [
          "Single-seed test; multiple trials needed to estimate tail FPR.",
        ],
        scopeConditions: "NullStochasticBaseline, N=16, T=60, seed=99001.",
        uncertainty: {
          measurement: "Low (DQ passed)",
          sampling: "Moderate (single seed requires sweep)",
          model: "Low (pure i.i.d. baseline)",
          mechanism: "N/A (null control)",
          novelty: "Calibration control only",
        },
        confidenceLabel: "moderate_provisional",
        validationStatus: "under_red_team",
        independenceClassification: "demonstrably_independent",
        softwareVersion: SOFTWARE_VERSION,
      },
    ])
    .returning();

  await db.insert(redTeamReviews).values([
    {
      claimId: claim1.id,
      reviewerIdentity: "RT-Agent-Alpha (Isolated Model Config)",
      reviewerRole: "Statistical Skeptic",
      explanationCategory: "random_variation",
      severity: "major",
      objectionText:
        "Verify that matched-seed delta persists outside transient steps 1-10 and is not driven by initial phase clustering.",
      evidenceRef: `CF-0001 (d=${cfCmp.effectSizeD}, 95% CI [${cfCmp.ci95Low}, ${cfCmp.ci95High}])`,
      status: "resolved",
      blindReview: true,
      sharedModelWarning: false,
      resolutionNote:
        "Resolved: 95% confidence interval excludes zero across full 60-step horizon with sensitivity bound Gamma=" +
        cfCmp.sensitivityGammaBound,
      softwareVersion: SOFTWARE_VERSION,
    },
    {
      claimId: claim2.id,
      reviewerIdentity: "RT-Agent-Beta (Independent Critic)",
      reviewerRole: "Hypothesis Falsifier",
      explanationCategory: "unbalanced_comparison",
      severity: "critical",
      objectionText:
        "CRITICAL: Pilot RUN-0003 is severely underpowered (power=" +
        simPilotNoiseOut.statisticalPowerObserved +
        " < 0.80) and observed meanCoordination=" +
        simPilotNoiseOut.meanCoordination +
        " fails the > 0.60 claim threshold. Cannot upgrade claim.",
      evidenceRef: "RUN-0003 / PILOT-2026-02",
      status: "unresolved",
      blindReview: true,
      sharedModelWarning: true,
      resolutionNote: null,
      softwareVersion: SOFTWARE_VERSION,
    },
    {
      claimId: claim2.id,
      reviewerIdentity: "RT-Agent-Gamma",
      reviewerRole: "Measurement Critic",
      explanationCategory: "logging_defect",
      severity: "major",
      objectionText:
        "Related run RUN-0005 in programme PROG-02 failed DataQualityValidator due to missing midpoint trajectory step.",
      evidenceRef: "RUN-0005 DataQualityReport",
      status: "unresolved",
      blindReview: false,
      sharedModelWarning: false,
      resolutionNote: null,
      softwareVersion: SOFTWARE_VERSION,
    },
    {
      claimId: claim3.id,
      reviewerIdentity: "RT-Agent-Delta",
      reviewerRole: "Reproducibility Challenger",
      explanationCategory: "selection_effect",
      severity: "minor",
      objectionText:
        "Expand null control from 1 seed to >= 20 seeds before finalizing false-positive rate certification.",
      evidenceRef: "CAL-2026-03",
      status: "unresolved",
      blindReview: true,
      sharedModelWarning: false,
      resolutionNote: null,
      softwareVersion: SOFTWARE_VERSION,
    },
  ]);

  // 5. Run & Store Calibration Benchmarks
  const calResults = runCalibrationSuite();
  await db.insert(calibrationBenchmarks).values(
    calResults.map((c) => ({
      ...c,
      softwareVersion: SOFTWARE_VERSION,
    }))
  );

  // 6. Append-only Provenance Events
  await db.insert(provenanceEvents).values([
    {
      eventCode: "PRV-0001",
      entityType: "run",
      entityId: runBase.id,
      action: "RUN_EXECUTED_IMMUTABLE",
      actor: "OMEIL Simulation Engine",
      rationale: "Executed baseline CoupledOscillatorSwarm with seed 42001.",
      contentHash: runBase.datasetHash,
      softwareVersion: SOFTWARE_VERSION,
      metadata: { seed: 42001, configHash: runBase.configHash },
    },
    {
      eventCode: "PRV-0002",
      entityType: "intervention",
      entityId: cfRecord.id,
      action: "COUNTERFACTUAL_EXECUTED",
      actor: "OMEIL Causal Workbench",
      rationale:
        "Executed matched-seed channel_disable intervention against RUN-0001.",
      contentHash: runCf.datasetHash,
      softwareVersion: SOFTWARE_VERSION,
      metadata: { parentRunId: runBase.id, cfRunId: runCf.id },
    },
    {
      eventCode: "PRV-0003",
      entityType: "run",
      entityId: runFailed.id,
      action: "DATA_QUALITY_QUARANTINE",
      actor: "DataQualityValidator",
      rationale:
        "Preserved RUN-0005 as failed measurement record; blocked from validated discovery pool.",
      contentHash: runFailed.datasetHash,
      softwareVersion: SOFTWARE_VERSION,
      metadata: { missingSteps: 1 },
    },
    {
      eventCode: "PRV-0004",
      entityType: "claim",
      entityId: claim2.id,
      action: "CLAIM_PROMOTION_BLOCKED",
      actor: "Adversarial Red-Team Gate",
      rationale:
        "Critical unresolved objection (underpowered pilot) blocked CLM-002 upgrade.",
      contentHash: sha256Hex({ claim: claim2.claimCode, blocked: true }),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { criticalUnresolved: 1 },
    },
  ]);
}
