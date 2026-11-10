import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export interface TrajectoryPoint {
  step: number;
  orderParameter: number;
  meanCoordination: number;
  entropyBits: number;
  mutualInfoBits: number;
  transferEntropyBits: number;
  resourcePool: number;
  activeAgents: number;
  anomalyScore: number;
  lag1Autocorr: number;
  microVariance: number;
  macroDivergence: number;
}

export interface AgentSnapshot {
  id: string;
  role: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  energy: number;
  memoryPolicy: string;
  signal: number;
  lastAction: string;
  clusterId: number;
  active: boolean;
}

export interface SimulationEventRecord {
  seq: number;
  step: number;
  type:
    | "step_tick"
    | "communication"
    | "anomaly_detected"
    | "regime_shift"
    | "intervention_applied"
    | "agent_removed"
    | "data_quality_check";
  agentId?: string;
  targetId?: string;
  summary: string;
  payload: Record<string, string | number | boolean>;
}

export interface DataQualityReport {
  passed: boolean;
  missingSteps: number;
  nanDetected: number;
  outOfOrderEvents: number;
  resourceConservationError: number;
  warnings: string[];
}

export interface CausalNode {
  id: string;
  label: string;
  role: "exposure" | "outcome" | "confounder" | "mediator" | "instrument";
  x: number;
  y: number;
}

export interface CausalEdge {
  from: string;
  to: string;
  type: "causal" | "confounding" | "ablated";
}

export interface MultiLayerUncertainty {
  measurement: string;
  sampling: string;
  model: string;
  mechanism: string;
  novelty: string;
}

export interface QdCell {
  row: number;
  col: number;
  orderBin: string;
  entropyBin: string;
  populated: boolean;
  fitnessCoord: number;
  surpriseScore: number;
  seed: number;
  memoryPolicy: string;
  couplingStrength: number;
  commNoise: number;
  label: string;
}

export interface SweepPoint {
  xVal: number;
  yVal: number;
  orderParameter: number;
  meanCoordination: number;
  entropyBits: number;
  lag1Autocorr: number;
  direction?: "forward" | "reverse";
}

export interface SwarmAuditEntry {
  configuration: string;
  agentCount: number;
  memoryMode: string;
  criticEnabled: boolean;
  heterogeneousModels: boolean;
  discoveryPrecision: number;
  groupthinkRate: number;
  duplicationRate: number;
  dissentPreservation: number;
  falseConsensusCount: number;
}

export const researchProgrammes = pgTable("research_programmes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  researchQuestion: text("research_question").notNull(),
  operationalDefinition: text("operational_definition").notNull(),
  competingHypotheses: jsonb("competing_hypotheses").$type<string[]>().notNull(),
  status: text("status").notNull().default("active"), // active | paused | completed | archived
  ethicsChecklistPassed: boolean("ethics_checklist_passed").notNull().default(true),
  limitations: text("limitations").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experimentDesigns = pgTable("experiment_designs", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id")
    .references(() => researchProgrammes.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  analysisMode: text("analysis_mode").notNull().default("confirmatory"), // pilot | confirmatory | exploratory
  primaryOutcome: text("primary_outcome").notNull(),
  secondaryOutcomes: jsonb("secondary_outcomes").$type<string[]>().notNull(),
  smallestEffectInterest: doublePrecision("smallest_effect_interest").notNull(),
  pilotVarianceEstimate: doublePrecision("pilot_variance_estimate").notNull(),
  powerTarget: doublePrecision("power_target").notNull().default(0.8),
  plannedTrials: integer("planned_trials").notNull(),
  estimatedPower: doublePrecision("estimated_power").notNull(),
  stoppingRule: text("stopping_rule").notNull(),
  exclusionCriteria: text("exclusion_criteria").notNull(),
  deviations: jsonb("deviations").$type<string[]>().notNull().default([]),
  preregistrationHash: text("preregistration_hash").notNull(),
  approvedByHuman: boolean("approved_by_human").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const experimentRuns = pgTable("experiment_runs", {
  id: serial("id").primaryKey(),
  runCode: text("run_code").notNull().unique(),
  programmeId: integer("programme_id")
    .references(() => researchProgrammes.id, { onDelete: "cascade" })
    .notNull(),
  designId: integer("design_id").references(() => experimentDesigns.id, {
    onDelete: "set null",
  }),
  parentRunId: integer("parent_run_id"),
  interventionId: integer("intervention_id"),
  title: text("title").notNull(),
  runType: text("run_type").notNull(), // baseline | treatment | counterfactual | pilot | confirmatory | null_control | replication
  environmentFamily: text("environment_family").notNull(), // CoupledOscillatorSwarm | ResourceForagingCommons | ConventionEmergenceGrid | NullStochasticBaseline
  seed: integer("seed").notNull(),
  agentCount: integer("agent_count").notNull(),
  steps: integer("steps").notNull(),
  memoryPolicy: text("memory_policy").notNull(), // stateless | short_memory | persistent_episodic | shared_memory
  commNoise: doublePrecision("comm_noise").notNull().default(0.05),
  commChannelEnabled: boolean("comm_channel_enabled").notNull().default(true),
  couplingStrength: doublePrecision("coupling_strength").notNull().default(0.55),
  resourceBudget: doublePrecision("resource_budget").notNull().default(100),
  modelHeterogeneity: text("model_heterogeneity").notNull().default("homogeneous_deterministic"),
  status: text("status").notNull().default("completed"), // queued | running | completed | stopped | failed | inconclusive
  failureCategory: text("failure_category"), // null | software_failure | simulation_failure | insufficient_power | measurement_failure | safety_stop
  failureReason: text("failure_reason"),
  configHash: text("config_hash").notNull(),
  datasetHash: text("dataset_hash").notNull(),
  softwareVersion: text("software_version").notNull().default("omeil-os-0.9.4"),
  meanCoordination: doublePrecision("mean_coordination").notNull(),
  finalOrderParameter: doublePrecision("final_order_parameter").notNull(),
  entropyBits: doublePrecision("entropy_bits").notNull(),
  mutualInfoBits: doublePrecision("mutual_info_bits").notNull(),
  transferEntropyBits: doublePrecision("transfer_entropy_bits").notNull(),
  criticalSlowingLag1: doublePrecision("critical_slowing_lag1").notNull(),
  microMacroDivergence: doublePrecision("micro_macro_divergence").notNull(),
  anomalyCount: integer("anomaly_count").notNull().default(0),
  statisticalPowerObserved: doublePrecision("statistical_power_observed").notNull(),
  dataQuality: jsonb("data_quality").$type<DataQualityReport>().notNull(),
  trajectory: jsonb("trajectory").$type<TrajectoryPoint[]>().notNull(),
  finalAgents: jsonb("final_agents").$type<AgentSnapshot[]>().notNull(),
  events: jsonb("events").$type<SimulationEventRecord[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const counterfactualInterventions = pgTable("counterfactual_interventions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  parentRunId: integer("parent_run_id")
    .references(() => experimentRuns.id, { onDelete: "cascade" })
    .notNull(),
  counterfactualRunId: integer("counterfactual_run_id").references(
    () => experimentRuns.id,
    { onDelete: "set null" }
  ),
  question: text("question").notNull(),
  interventionType: text("intervention_type").notNull(), // variable_change | agent_removal | channel_disable | resource_relax | timing_shift | mechanism_ablation | environment_transfer
  targetSpec: text("target_spec").notNull(),
  parameterDelta: jsonb("parameter_delta")
    .$type<Record<string, string | number | boolean>>()
    .notNull(),
  matchedSeed: boolean("matched_seed").notNull().default(true),
  identificationStatus: text("identification_status").notNull(), // identified_matched_counterfactual | associative_only | unidentified_confounded
  identificationRationale: text("identification_rationale").notNull(),
  confounders: jsonb("confounders").$type<string[]>().notNull(),
  alternativeExplanations: jsonb("alternative_explanations").$type<string[]>().notNull(),
  causalDag: jsonb("causal_dag")
    .$type<{ nodes: CausalNode[]; edges: CausalEdge[] }>()
    .notNull(),
  deltaCoordination: doublePrecision("delta_coordination").notNull(),
  deltaOrderParameter: doublePrecision("delta_order_parameter").notNull(),
  deltaTransferEntropy: doublePrecision("delta_transfer_entropy").notNull(),
  effectSizeD: doublePrecision("effect_size_d").notNull(),
  ci95Low: doublePrecision("ci95_low").notNull(),
  ci95High: doublePrecision("ci95_high").notNull(),
  sensitivityGammaBound: doublePrecision("sensitivity_gamma_bound").notNull(),
  conclusionLabel: text("conclusion_label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const claimsLedger = pgTable("claims_ledger", {
  id: serial("id").primaryKey(),
  claimCode: text("claim_code").notNull().unique(),
  programmeId: integer("programme_id")
    .references(() => researchProgrammes.id, { onDelete: "cascade" })
    .notNull(),
  claimText: text("claim_text").notNull(),
  claimType: text("claim_type").notNull(), // Pattern | Anomaly | CausalEffect | Mechanism | Finding | Speculation
  operationalDefinition: text("operational_definition").notNull(),
  supportingRunIds: jsonb("supporting_run_ids").$type<number[]>().notNull(),
  contradictingRunIds: jsonb("contradicting_run_ids").$type<number[]>().notNull(),
  assumptions: jsonb("assumptions").$type<string[]>().notNull(),
  alternativeExplanations: jsonb("alternative_explanations").$type<string[]>().notNull(),
  scopeConditions: text("scope_conditions").notNull(),
  uncertainty: jsonb("uncertainty").$type<MultiLayerUncertainty>().notNull(),
  confidenceLabel: text("confidence_label").notNull(), // high_replicated | moderate_provisional | low_exploratory | blocked_contested | inconclusive_underpowered
  validationStatus: text("validation_status").notNull().default("candidate"), // candidate | under_red_team | blocked_by_objection | validated_finding | falsified | inconclusive
  independenceClassification: text("independence_classification").notNull(), // demonstrably_independent | partially_independent | shared_source_correlated | unknown
  softwareVersion: text("software_version").notNull().default("omeil-os-0.9.4"),
  humanOverrideApproved: boolean("human_override_approved").notNull().default(false),
  humanOverrideNote: text("human_override_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const redTeamReviews = pgTable("red_team_reviews", {
  id: serial("id").primaryKey(),
  claimId: integer("claim_id")
    .references(() => claimsLedger.id, { onDelete: "cascade" })
    .notNull(),
  reviewerIdentity: text("reviewer_identity").notNull(),
  reviewerRole: text("reviewer_role").notNull(),
  explanationCategory: text("explanation_category").notNull(),
  severity: text("severity").notNull(), // critical | major | minor
  objectionText: text("objection_text").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  status: text("status").notNull().default("unresolved"), // unresolved | resolved | human_override
  blindReview: boolean("blind_review").notNull().default(true),
  sharedModelWarning: boolean("shared_model_warning").notNull().default(false),
  resolutionNote: text("resolution_note"),
  softwareVersion: text("software_version").notNull().default("omeil-os-0.9.4"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calibrationBenchmarks = pgTable("calibration_benchmarks", {
  id: serial("id").primaryKey(),
  testCode: text("test_code").notNull().unique(),
  testName: text("test_name").notNull(),
  category: text("category").notNull(),
  injectedGroundTruth: text("injected_ground_truth").notNull(),
  sensitivity: doublePrecision("sensitivity").notNull(),
  falsePositiveRate: doublePrecision("false_positive_rate").notNull(),
  precisionScore: doublePrecision("precision_score").notNull(),
  recallScore: doublePrecision("recall_score").notNull(),
  detectionDelaySteps: integer("detection_delay_steps").notNull(),
  status: text("status").notNull(), // PASS | WARN | FAIL
  notes: text("notes").notNull(),
  softwareVersion: text("software_version").notNull().default("omeil-os-0.9.4"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export const provenanceEvents = pgTable("provenance_events", {
  id: serial("id").primaryKey(),
  eventCode: text("event_code").notNull().unique(),
  entityType: text("entity_type").notNull(), // run | intervention | claim | review | design | system_control | benchmark
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  rationale: text("rationale").notNull(),
  contentHash: text("content_hash").notNull(),
  softwareVersion: text("software_version").notNull().default("omeil-os-0.9.4"),
  metadata: jsonb("metadata")
    .$type<Record<string, string | number | boolean>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemControls = pgTable("system_controls", {
  id: serial("id").primaryKey(),
  emergencyStopActive: boolean("emergency_stop_active").notNull().default(false),
  swarmPaused: boolean("swarm_paused").notNull().default(false),
  externalProvidersDisabled: boolean("external_providers_disabled")
    .notNull()
    .default(true),
  literatureRetrievalDisabled: boolean("literature_retrieval_disabled")
    .notNull()
    .default(false),
  maxConcurrentJobs: integer("max_concurrent_jobs").notNull().default(2),
  maxAgentsPerRun: integer("max_agents_per_run").notNull().default(48),
  maxStepsPerRun: integer("max_steps_per_run").notNull().default(180),
  activeCapabilityTier: text("active_capability_tier")
    .notNull()
    .default("TIER 1 — CORE LOCAL LAB"),
  autonomousModeEnabled: boolean("autonomous_mode_enabled")
    .notNull()
    .default(false),
  autonomousIntervalSec: integer("autonomous_interval_sec")
    .notNull()
    .default(5),
  autonomousCycleCount: integer("autonomous_cycle_count")
    .notNull()
    .default(0),
  maxAutonomousCycles: integer("max_autonomous_cycles")
    .notNull()
    .default(40),
  lastAutonomousAction: text("last_autonomous_action"),
  lastStopReason: text("last_stop_reason"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const autonomousWorkflowLogs = pgTable("autonomous_workflow_logs", {
  id: serial("id").primaryKey(),
  cycleNumber: integer("cycle_number").notNull(),
  stageName: text("stage_name").notNull(),
  actionType: text("action_type").notNull(), // simulation | counterfactual | replication | qd_search | phase_sweep | claim_and_redteam | redteam_audit | calibration | preregistration | swarm_audit
  targetEntityCode: text("target_entity_code").notNull(),
  selectionRationale: text("selection_rationale").notNull(),
  outcomeSummary: text("outcome_summary").notNull(),
  scientificDisposition: text("scientific_disposition").notNull(), // candidate_pattern | replicated | no_effect_or_null | inconclusive_underpowered | redteam_objection_filed | instrument_calibrated | exploration_mapped
  softwareVersion: text("software_version").notNull().default("omeil-os-1.0.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const literatureRecords = pgTable("literature_records", {
  id: serial("id").primaryKey(),
  litCode: text("lit_code").notNull().unique(),
  title: text("title").notNull(),
  authors: text("authors").notNull(),
  venue: text("venue").notNull(),
  year: integer("year").notNull(),
  doiOrId: text("doi_or_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  peerReviewStatus: text("peer_review_status").notNull(), // peer_reviewed | preprint | technical_report
  accessStatus: text("access_status").notNull(), // open_access_fulltext | abstract_only | user_provided
  inspectedFullText: boolean("inspected_full_text").notNull().default(false),
  relationToProgramme: text("relation_to_programme").notNull(), // supports | contradicts | baseline_method | prior_art
  relatedProgrammeCode: text("related_programme_code").notNull(),
  keyClaimChecked: text("key_claim_checked").notNull(),
  limitationsNoted: text("limitations_noted").notNull(),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
});

export const discoverySearchArchives = pgTable("discovery_search_archives", {
  id: serial("id").primaryKey(),
  archiveCode: text("archive_code").notNull().unique(),
  environmentFamily: text("environment_family").notNull(),
  searchObjective: text("search_objective").notNull(),
  descriptorX: text("descriptor_x").notNull(),
  descriptorY: text("descriptor_y").notNull(),
  gridSize: integer("grid_size").notNull().default(5),
  totalEvaluations: integer("total_evaluations").notNull(),
  coveragePct: doublePrecision("coverage_pct").notNull(),
  qdScore: doublePrecision("qd_score").notNull(),
  cells: jsonb("cells").$type<QdCell[]>().notNull(),
  blindSpots: text("blind_spots").notNull(),
  stoppingRule: text("stopping_rule").notNull(),
  softwareVersion: text("software_version").notNull().default("omeil-os-1.0.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const parameterSweeps = pgTable("parameter_sweeps", {
  id: serial("id").primaryKey(),
  sweepCode: text("sweep_code").notNull().unique(),
  environmentFamily: text("environment_family").notNull(),
  sweepMode: text("sweep_mode").notNull(), // 2d_phase_diagram | hysteresis_loop
  xParam: text("x_param").notNull(),
  yParam: text("y_param").notNull(),
  gridPoints: jsonb("grid_points").$type<SweepPoint[]>().notNull(),
  criticalTransitionEstimate: text("critical_transition_estimate").notNull(),
  hysteresisGap: doublePrecision("hysteresis_gap").notNull().default(0),
  assumptionsWarning: text("assumptions_warning").notNull(),
  softwareVersion: text("software_version").notNull().default("omeil-os-1.0.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const swarmFailureAudits = pgTable("swarm_failure_audits", {
  id: serial("id").primaryKey(),
  auditCode: text("audit_code").notNull().unique(),
  benchmarkTask: text("benchmark_task").notNull(),
  seed: integer("seed").notNull(),
  entries: jsonb("entries").$type<SwarmAuditEntry[]>().notNull(),
  empiricalConclusion: text("empirical_conclusion").notNull(),
  softwareVersion: text("software_version").notNull().default("omeil-os-1.0.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
