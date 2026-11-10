import type {
  AgentSnapshot,
  CausalEdge,
  CausalNode,
  DataQualityReport,
  MultiLayerUncertainty,
  QdCell,
  SimulationEventRecord,
  SwarmAuditEntry,
  SweepPoint,
  TrajectoryPoint,
} from "@/db/schema";

export interface ResearchProgramme {
  id: number;
  code: string;
  title: string;
  researchQuestion: string;
  operationalDefinition: string;
  competingHypotheses: string[];
  status: string;
  ethicsChecklistPassed: boolean;
  limitations: string;
  createdAt: string;
}

export interface ExperimentDesign {
  id: number;
  programmeId: number;
  title: string;
  analysisMode: string;
  primaryOutcome: string;
  secondaryOutcomes: string[];
  smallestEffectInterest: number;
  pilotVarianceEstimate: number;
  powerTarget: number;
  plannedTrials: number;
  estimatedPower: number;
  stoppingRule: string;
  exclusionCriteria: string;
  deviations: string[];
  preregistrationHash: string;
  approvedByHuman: boolean;
  createdAt: string;
}

export interface ExperimentRun {
  id: number;
  runCode: string;
  programmeId: number;
  designId: number | null;
  parentRunId: number | null;
  interventionId: number | null;
  title: string;
  runType: string;
  environmentFamily: string;
  seed: number;
  agentCount: number;
  steps: number;
  memoryPolicy: string;
  commNoise: number;
  commChannelEnabled: boolean;
  couplingStrength: number;
  resourceBudget: number;
  modelHeterogeneity: string;
  status: string;
  failureCategory: string | null;
  failureReason: string | null;
  configHash: string;
  datasetHash: string;
  softwareVersion: string;
  meanCoordination: number;
  finalOrderParameter: number;
  entropyBits: number;
  mutualInfoBits: number;
  transferEntropyBits: number;
  criticalSlowingLag1: number;
  microMacroDivergence: number;
  anomalyCount: number;
  statisticalPowerObserved: number;
  dataQuality: DataQualityReport;
  trajectory: TrajectoryPoint[];
  finalAgents: AgentSnapshot[];
  events: SimulationEventRecord[];
  createdAt: string;
}

export interface CounterfactualIntervention {
  id: number;
  code: string;
  parentRunId: number;
  counterfactualRunId: number | null;
  question: string;
  interventionType: string;
  targetSpec: string;
  parameterDelta: Record<string, string | number | boolean>;
  matchedSeed: boolean;
  identificationStatus: string;
  identificationRationale: string;
  confounders: string[];
  alternativeExplanations: string[];
  causalDag: { nodes: CausalNode[]; edges: CausalEdge[] };
  deltaCoordination: number;
  deltaOrderParameter: number;
  deltaTransferEntropy: number;
  effectSizeD: number;
  ci95Low: number;
  ci95High: number;
  sensitivityGammaBound: number;
  conclusionLabel: string;
  createdAt: string;
}

export interface ClaimRecord {
  id: number;
  claimCode: string;
  programmeId: number;
  claimText: string;
  claimType: string;
  operationalDefinition: string;
  supportingRunIds: number[];
  contradictingRunIds: number[];
  assumptions: string[];
  alternativeExplanations: string[];
  scopeConditions: string;
  uncertainty: MultiLayerUncertainty;
  confidenceLabel: string;
  validationStatus: string;
  independenceClassification: string;
  softwareVersion: string;
  humanOverrideApproved: boolean;
  humanOverrideNote: string | null;
  createdAt: string;
}

export interface RedTeamReview {
  id: number;
  claimId: number;
  reviewerIdentity: string;
  reviewerRole: string;
  explanationCategory: string;
  severity: string;
  objectionText: string;
  evidenceRef: string;
  status: string;
  blindReview: boolean;
  sharedModelWarning: boolean;
  resolutionNote: string | null;
  softwareVersion: string;
  createdAt: string;
}

export interface CalibrationBenchmark {
  id: number;
  testCode: string;
  testName: string;
  category: string;
  injectedGroundTruth: string;
  sensitivity: number;
  falsePositiveRate: number;
  precisionScore: number;
  recallScore: number;
  detectionDelaySteps: number;
  status: string;
  notes: string;
  softwareVersion: string;
  executedAt: string;
}

export interface ProvenanceEvent {
  id: number;
  eventCode: string;
  entityType: string;
  entityId: number;
  action: string;
  actor: string;
  rationale: string;
  contentHash: string;
  softwareVersion: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface SystemControls {
  id: number;
  emergencyStopActive: boolean;
  swarmPaused: boolean;
  externalProvidersDisabled: boolean;
  literatureRetrievalDisabled: boolean;
  maxConcurrentJobs: number;
  maxAgentsPerRun: number;
  maxStepsPerRun: number;
  activeCapabilityTier: string;
  autonomousModeEnabled: boolean;
  autonomousIntervalSec: number;
  autonomousCycleCount: number;
  maxAutonomousCycles: number;
  lastAutonomousAction: string | null;
  lastStopReason: string | null;
  updatedAt: string;
}

export interface AutonomousWorkflowLog {
  id: number;
  cycleNumber: number;
  stageName: string;
  actionType: string;
  targetEntityCode: string;
  selectionRationale: string;
  outcomeSummary: string;
  scientificDisposition: string;
  softwareVersion: string;
  createdAt: string;
}

export interface LiteratureRecord {
  id: number;
  litCode: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  doiOrId: string;
  sourceUrl: string;
  peerReviewStatus: string;
  accessStatus: string;
  inspectedFullText: boolean;
  relationToProgramme: string;
  relatedProgrammeCode: string;
  keyClaimChecked: string;
  limitationsNoted: string;
  retrievedAt: string;
}

export interface DiscoveryArchive {
  id: number;
  archiveCode: string;
  environmentFamily: string;
  searchObjective: string;
  descriptorX: string;
  descriptorY: string;
  gridSize: number;
  totalEvaluations: number;
  coveragePct: number;
  qdScore: number;
  cells: QdCell[];
  blindSpots: string;
  stoppingRule: string;
  softwareVersion: string;
  createdAt: string;
}

export interface ParameterSweepRecord {
  id: number;
  sweepCode: string;
  environmentFamily: string;
  sweepMode: string;
  xParam: string;
  yParam: string;
  gridPoints: SweepPoint[];
  criticalTransitionEstimate: string;
  hysteresisGap: number;
  assumptionsWarning: string;
  softwareVersion: string;
  createdAt: string;
}

export interface SwarmAuditRecord {
  id: number;
  auditCode: string;
  benchmarkTask: string;
  seed: number;
  entries: SwarmAuditEntry[];
  empiricalConclusion: string;
  softwareVersion: string;
  createdAt: string;
}

export interface WorkbenchSnapshot {
  softwareVersion: string;
  programmes: ResearchProgramme[];
  designs: ExperimentDesign[];
  runs: ExperimentRun[];
  interventions: CounterfactualIntervention[];
  claims: ClaimRecord[];
  reviews: RedTeamReview[];
  benchmarks: CalibrationBenchmark[];
  provenance: ProvenanceEvent[];
  controls: SystemControls | null;
  literature: LiteratureRecord[];
  discoveries: DiscoveryArchive[];
  sweeps: ParameterSweepRecord[];
  swarmAudits: SwarmAuditRecord[];
  autonomousLogs: AutonomousWorkflowLog[];
}
