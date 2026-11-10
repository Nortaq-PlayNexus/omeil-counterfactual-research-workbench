"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  Compass,
  Cpu,
  Download,
  Eye,
  FileText,
  FlaskConical,
  GitBranch,
  HelpCircle,
  Layers,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Search,
  ShieldAlert,
  SkipForward,
  Sliders,
  Square,
  Terminal,
  Unlock,
  Users,
  Zap,
  Moon,
  Sun,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { TrajectoryChart } from "@/components/TrajectoryChart";
import { PhaseSpace3D } from "@/components/PhaseSpace3D";
import { CausalDagSvg } from "@/components/CausalDagSvg";
import { PhaseDiagramHeatmap } from "@/components/PhaseDiagramHeatmap";
import {
  QualityDiversityGrid,
  RecurrenceAndPidPanel,
} from "@/components/RecurrenceAndPidPanel";
import { TraceabilityGraphSvg } from "@/components/TraceabilityGraphSvg";
import {
  MultiScaleAndIndependencePanel,
  PowerCurveAndAlphaPanel,
} from "@/components/PowerAndMultiScalePanel";
import {
  AgentNetworkTopologySvg,
  AutonomousPipelineStepper,
  EvidenceQueryAssistant,
  OmeilErrorBoundary,
} from "@/components/ObservatoryPanels";
import type {
  BatchComparisonResult,
  EnvironmentValidationCheck,
} from "@/lib/omeil-engine";
import type {
  ClaimRecord,
  CounterfactualIntervention,
  ExperimentRun,
  WorkbenchSnapshot,
} from "@/components/types";

async function safeParseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || `HTTP ${res.status}` };
  }
}

type TabId =
  | "overview"
  | "simulations"
  | "counterfactuals"
  | "discovery"
  | "redteam"
  | "calibration"
  | "provenance"
  | "methods";

const RED_TEAM_ROLES = [
  "Hypothesis Falsifier",
  "Statistical Skeptic",
  "Measurement Critic",
  "Simulation-Artifact Investigator",
  "Literature Contradiction Researcher",
  "Reproducibility Challenger",
  "Data Provenance Auditor",
  "Alternative-Mechanism Generator",
  "Overclaim Detection Reviewer",
  "Safety and Scope Reviewer",
];

const EXPLANATION_CATEGORIES = [
  "random_variation",
  "implementation_bug",
  "incorrect_metric",
  "unbalanced_comparison",
  "hidden_environmental_difference",
  "selection_effect",
  "simulator_artifact",
  "logging_defect",
  "agent_prompt_artifact",
  "model_provider_change",
  "confounder",
  "accidental_parameter_interaction",
  "known_published_phenomenon",
];

const EXPERIMENT_MATRIX_TEMPLATES = [
  {
    code: "EXP-11",
    name: "Interaction Order & Path Dependence",
    env: "CoupledOscillatorSwarm",
    noise: 0.05,
    coupling: 0.8,
    memory: "persistent_episodic",
    status: "EXECUTABLE",
  },
  {
    code: "EXP-12",
    name: "Hysteresis & Regime Persistence",
    env: "ConventionEmergenceGrid",
    noise: 0.08,
    coupling: 0.65,
    memory: "shared_memory",
    status: "EXECUTABLE (Sweep Tab)",
  },
  {
    code: "EXP-13",
    name: "Agent Removal & Network Resilience",
    env: "ResourceForagingCommons",
    noise: 0.06,
    coupling: 0.75,
    memory: "persistent_episodic",
    status: "EXECUTABLE (Counterfactual)",
  },
  {
    code: "EXP-14",
    name: "Communication Noise & Convention Stability",
    env: "ConventionEmergenceGrid",
    noise: 0.34,
    coupling: 0.55,
    memory: "shared_memory",
    status: "EXECUTABLE",
  },
  {
    code: "EXP-15",
    name: "Shared vs Isolated Memory Swarm",
    env: "CoupledOscillatorSwarm",
    noise: 0.1,
    coupling: 0.7,
    memory: "stateless",
    status: "EXECUTABLE (Swarm Audit)",
  },
  {
    code: "EXP-24",
    name: "Discovery Pipeline False-Positive Null Control",
    env: "NullStochasticBaseline",
    noise: 0.4,
    coupling: 0.0,
    memory: "stateless",
    status: "EXECUTABLE",
  },
];

const GLOSSARY_TERMS = [
  {
    term: "Order Parameter R(t)",
    plain:
      "A number from 0 to 1 measuring how synchronized the agents' phases are at step t. R=0 means disordered; R=1 means locked consensus.",
  },
  {
    term: "Transfer Entropy (TE)",
    plain:
      "How much knowing one agent's past signal reduces uncertainty about another agent's next signal. Indicates statistical information flow, NOT causal proof or semantic meaning.",
  },
  {
    term: "Partial Information Decomposition (PID)",
    plain:
      "Breaks joint information into Redundancy (shared), Unique (from one variable), and Synergy (only visible collectively).",
  },
  {
    term: "Critical Slowing Down (Lag-1 AC)",
    plain:
      "When a system approaches a tipping point, it recovers slowly from tiny shocks, causing consecutive states to become highly correlated (Lag-1 AC > 0.75).",
  },
  {
    term: "Matched-Seed Counterfactual",
    plain:
      "Re-running the exact same random seed while changing only one intervention operator, isolating the causal effect in deterministic simulations.",
  },
  {
    term: "Rosenbaum Sensitivity Bound (Γ)",
    plain:
      "Estimates how strong an unmeasured confounder would have to be to overturn an observed counterfactual effect.",
  },
];

export function OmeilWorkbench() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autoStepInFlightRef = useRef(false);

  const [data, setData] = useState<WorkbenchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [observatoryTheme, setObservatoryTheme] = useState(false);
  const [colorBlindSafe, setColorBlindSafe] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [batchForm, setBatchForm] = useState({
    environmentFamily: "ConventionEmergenceGrid",
    memoryA: "shared_memory",
    channelA: true,
    memoryB: "stateless",
    channelB: true,
    numSeeds: 6,
  });
  const [batchResult, setBatchResult] = useState<BatchComparisonResult | null>(null);
  const [envChecks, setEnvChecks] = useState<EnvironmentValidationCheck[] | null>(null);
  const [progForm, setProgForm] = useState({
    title: "",
    researchQuestion: "",
    operationalDefinition: "",
    hypothesis1: "",
    hypothesis0: "",
  });

  // Selected IDs & Command Palette
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);
  const [selectedCfId, setSelectedCfId] = useState<number | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(null);
  const [selectedSweepId, setSelectedSweepId] = useState<number | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState<number | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Replay debugger state
  const [replayStep, setReplayStep] = useState<number>(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Forms
  const [simForm, setSimForm] = useState({
    programmeId: 1,
    title: "",
    environmentFamily: "CoupledOscillatorSwarm",
    runType: "exploratory",
    seed: 51204,
    agentCount: 16,
    steps: 60,
    memoryPolicy: "persistent_episodic",
    commNoise: 0.06,
    commChannelEnabled: true,
    couplingStrength: 0.78,
    resourceBudget: 100,
    modelHeterogeneity: "role_differentiated",
    injectLoggingDefect: false,
  });

  const [cfForm, setCfForm] = useState({
    parentRunId: 1,
    interventionType: "agent_removal",
    question: "",
    matchedSeed: true,
    removedAgentIndex: 0,
    interventionStep: 20,
    resourceMultiplier: 2.0,
    commNoise: 0.28,
    couplingStrength: 0.5,
    targetEnvironment: "ResourceForagingCommons",
  });

  const [claimForm, setClaimForm] = useState({
    programmeId: 1,
    claimText: "",
    claimType: "Pattern",
    operationalDefinition: "",
    supportingRunId: 1,
    scopeConditions: "CoupledOscillatorSwarm, bounded Tier-1 run",
  });

  const [reviewForm, setReviewForm] = useState({
    reviewerRole: "Hypothesis Falsifier",
    reviewerIdentity: "RT-Independent-Critic",
    explanationCategory: "random_variation",
    severity: "major",
    objectionText: "",
    evidenceRef: "",
    blindReview: true,
    sharedModelWarning: false,
  });

  const [litForm, setLitForm] = useState({
    title: "",
    authors: "",
    venue: "",
    year: 2025,
    doiOrId: "",
    accessStatus: "abstract_only",
    inspectedFullText: false,
    relationToProgramme: "supports",
    relatedProgrammeCode: "PROG-01",
    keyClaimChecked: "",
  });

  const [qdEnv, setQdEnv] = useState("CoupledOscillatorSwarm");
  const [sweepForm, setSweepForm] = useState({
    environmentFamily: "CoupledOscillatorSwarm",
    sweepMode: "2d_phase_diagram",
  });

  const [overrideTargetClaim, setOverrideTargetClaim] =
    useState<ClaimRecord | null>(null);
  const [overrideNote, setOverrideNote] = useState("");

  const [designForm, setDesignForm] = useState({
    programmeId: 1,
    title: "",
    analysisMode: "confirmatory",
    primaryOutcome: "meanCoordination",
    smallestEffectInterest: 0.15,
    pilotVarianceEstimate: 0.04,
    plannedTrials: 16,
    stoppingRule: "Fixed horizon T=60 steps; no optional stopping.",
    exclusionCriteria: "Exclude runs failing DataQualityReport.",
  });

  // Keyboard shortcuts (Ctrl+K toggles Command Palette; Escape closes)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadWorkbench = useCallback(async () => {
    try {
      const res = await fetch("/api/workbench", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load laboratory state");
      const json = (await safeParseJson(res)) as WorkbenchSnapshot;
      if (!json || !Array.isArray(json.runs)) {
        throw new Error("Invalid workbench payload");
      }
      setData(json);

      if (json.runs.length > 0) {
        setSelectedRunId((prev) => prev ?? json.runs[0].id);
        setCfForm((prev) => ({
          ...prev,
          parentRunId: json.runs.find((r) => r.id === prev.parentRunId)
            ? prev.parentRunId
            : json.runs[0].id,
        }));
        setClaimForm((prev) => ({
          ...prev,
          supportingRunId: json.runs[0].id,
        }));
      }
      if (json.interventions.length > 0) {
        setSelectedCfId((prev) => prev ?? json.interventions[0].id);
      }
      if (json.claims.length > 0) {
        setSelectedClaimId((prev) => prev ?? json.claims[0].id);
      }
      if (json.sweeps?.length > 0) {
        setSelectedSweepId((prev) => prev ?? json.sweeps[0].id);
      }
      if (json.discoveries?.length > 0) {
        setSelectedArchiveId((prev) => prev ?? json.discoveries[0].id);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to fetch laboratory state"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkbench();
  }, [loadWorkbench]);

  const executeAutonomousCycle = useCallback(
    async (forceSingleStep = false) => {
      if (autoStepInFlightRef.current) return;
      autoStepInFlightRef.current = true;
      try {
        const res = await fetch("/api/autonomous/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceSingleStep }),
        });
        const json = await safeParseJson(res);
        if (!res.ok) {
          if (res.status === 423 || res.status >= 500) {
            setErrorBanner(
              json.error ?? "Autonomous execution halted safely."
            );
          }
          await loadWorkbench();
          return;
        }
        if (json.budgetReached) {
          setSuccessBanner(json.message);
          await loadWorkbench();
          return;
        }
        if (json.cycle) {
          setSuccessBanner(
            `[AUTO Cycle #${json.cycle.cycleNumber}] ${json.cycle.stageName} → ${json.cycle.targetEntityCode}: ${json.cycle.outcomeSummary}`
          );
        }
        await loadWorkbench();
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : "Autonomous cycle error"
        );
      } finally {
        autoStepInFlightRef.current = false;
      }
    },
    [loadWorkbench]
  );

  // Continuous human-like autonomous research loop when turned ON
  useEffect(() => {
    const ctrl = data?.controls;
    if (
      !ctrl ||
      !ctrl.autonomousModeEnabled ||
      ctrl.emergencyStopActive ||
      ctrl.swarmPaused
    ) {
      return;
    }

    // Fire first cycle smoothly after 300ms, then repeat on configured interval
    const firstTimer = setTimeout(() => {
      executeAutonomousCycle(false);
    }, 300);

    const intervalMs = Math.max(2000, (ctrl.autonomousIntervalSec ?? 5) * 1000);
    const timer = setInterval(() => {
      executeAutonomousCycle(false);
    }, intervalMs);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(timer);
    };
  }, [
    data?.controls?.autonomousModeEnabled,
    data?.controls?.emergencyStopActive,
    data?.controls?.swarmPaused,
    data?.controls?.autonomousIntervalSec,
    executeAutonomousCycle,
  ]);

  const activeRun: ExperimentRun | null = useMemo(() => {
    if (!data || data.runs.length === 0) return null;
    return data.runs.find((r) => r.id === selectedRunId) ?? data.runs[0];
  }, [data, selectedRunId]);

  const compareRun: ExperimentRun | null = useMemo(() => {
    if (!data || !compareRunId) return null;
    return data.runs.find((r) => r.id === compareRunId) ?? null;
  }, [data, compareRunId]);

  useEffect(() => {
    if (activeRun) {
      const maxS =
        activeRun.trajectory[activeRun.trajectory.length - 1]?.step ??
        activeRun.steps;
      setReplayStep(maxS);
      setIsPlaying(false);
      setSelectedAgentId(activeRun.finalAgents[0]?.id ?? null);
    }
  }, [activeRun?.id]);

  useEffect(() => {
    if (!isPlaying || !activeRun) return;
    const maxS =
      activeRun.trajectory[activeRun.trajectory.length - 1]?.step ??
      activeRun.steps;
    const timer = setInterval(
      () => {
        setReplayStep((prev) => {
          if (prev >= maxS) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      },
      reducedMotion ? 350 : 160
    );
    return () => clearInterval(timer);
  }, [isPlaying, activeRun, reducedMotion]);

  const activeCf: CounterfactualIntervention | null = useMemo(() => {
    if (!data || data.interventions.length === 0) return null;
    return (
      data.interventions.find((c) => c.id === selectedCfId) ??
      data.interventions[0]
    );
  }, [data, selectedCfId]);

  const activeClaim: ClaimRecord | null = useMemo(() => {
    if (!data || data.claims.length === 0) return null;
    return data.claims.find((c) => c.id === selectedClaimId) ?? data.claims[0];
  }, [data, selectedClaimId]);

  const activeSweep = useMemo(() => {
    if (!data?.sweeps?.length) return null;
    return data.sweeps.find((s) => s.id === selectedSweepId) ?? data.sweeps[0];
  }, [data, selectedSweepId]);

  const activeArchive = useMemo(() => {
    if (!data?.discoveries?.length) return null;
    return (
      data.discoveries.find((d) => d.id === selectedArchiveId) ??
      data.discoveries[0]
    );
  }, [data, selectedArchiveId]);

  const notify = (msg: string, isError = false) => {
    if (isError) {
      setErrorBanner(msg);
      setSuccessBanner(null);
    } else {
      setSuccessBanner(msg);
      setErrorBanner(null);
    }
  };

  // Actions
  const updateControl = async (patch: Record<string, unknown>, label: string) => {
    setBusyMsg(label);
    try {
      const res = await fetch("/api/controls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await safeParseJson(res);
      if (!res.ok) throw new Error(json.error ?? "Control update failed");
      await loadWorkbench();
      notify(label);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Control update failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyMsg("Executing deterministic simulation...");
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Simulation blocked");
      await loadWorkbench();
      setSelectedRunId(json.run.id);
      notify(
        `Executed ${json.run.runCode} [${json.run.status.toUpperCase()}] — sha256:${json.run.datasetHash}`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Simulation failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleReplicateRun = async (runId: number) => {
    setBusyMsg("Running independent-seed replication...");
    try {
      const res = await fetch("/api/replications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentRunId: runId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Replication failed");
      await loadWorkbench();
      setSelectedRunId(json.replicationRun.id);
      notify(
        `${json.replicationRun.runCode} completed (ΔR=${json.deltaOrderParameter}, ${
          json.replicatedWithinTolerance ? "REPLICATED" : "DIVERGED"
        }).`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Replication failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunCounterfactual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyMsg("Executing counterfactual causal intervention...");
    try {
      const res = await fetch("/api/counterfactuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Counterfactual failed");
      await loadWorkbench();
      setSelectedCfId(json.intervention.id);
      notify(
        `${json.intervention.code} completed -> ${json.counterfactualRun.runCode} [${json.intervention.identificationStatus}]`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Counterfactual failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunQdSearch = async () => {
    setBusyMsg("Running MAP-Elites Quality-Diversity search (20 runs)...");
    try {
      const res = await fetch("/api/discoveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentFamily: qdEnv }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "QD search failed");
      await loadWorkbench();
      setSelectedArchiveId(json.archive.id);
      notify(
        `${json.archive.archiveCode} mapped ${json.archive.coveragePct}% behavioral repertoire (QD=${json.archive.qdScore}).`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "QD search failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunSweep = async () => {
    setBusyMsg(`Running ${sweepForm.sweepMode} sweep...`);
    try {
      const res = await fetch("/api/sweeps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sweepForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sweep failed");
      await loadWorkbench();
      setSelectedSweepId(json.sweep.id);
      notify(
        `${json.sweep.sweepCode} finished: ${json.sweep.criticalTransitionEstimate}`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Sweep failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunSwarmAudit = async () => {
    setBusyMsg("Benchmarking 5 multi-agent swarm architectures...");
    try {
      const res = await fetch("/api/swarm-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Swarm audit failed");
      await loadWorkbench();
      notify(`Executed ${json.audit.auditCode} swarm failure-mode benchmark.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Swarm audit failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleAddLiterature = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyMsg("Recording verified literature reference...");
    try {
      const res = await fetch("/api/literature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(litForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Literature add failed");
      setLitForm((p) => ({
        ...p,
        title: "",
        authors: "",
        doiOrId: "",
        keyClaimChecked: "",
      }));
      await loadWorkbench();
      notify(`Registered ${json.literature.litCode} in citation graph.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Literature error", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimForm.claimText.trim()) return;
    setBusyMsg("Registering claim in ledger...");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programmeId: claimForm.programmeId,
          claimText: claimForm.claimText,
          claimType: claimForm.claimType,
          operationalDefinition: claimForm.operationalDefinition,
          supportingRunIds: [claimForm.supportingRunId],
          scopeConditions: claimForm.scopeConditions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Claim registration failed");
      setClaimForm((p) => ({ ...p, claimText: "", operationalDefinition: "" }));
      await loadWorkbench();
      setSelectedClaimId(json.claim.id);
      notify(`Registered ${json.claim.claimCode} under red-team review.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to file claim", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClaim || !reviewForm.objectionText.trim()) return;
    setBusyMsg("Filing adversarial red-team objection...");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_review",
          claimId: activeClaim.id,
          ...reviewForm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to file objection");
      setReviewForm((p) => ({ ...p, objectionText: "", evidenceRef: "" }));
      await loadWorkbench();
      notify(`Filed ${reviewForm.severity.toUpperCase()} objection.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to file objection", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleResolveReview = async (reviewId: number) => {
    setBusyMsg("Resolving objection...");
    try {
      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_review",
          reviewId,
          status: "resolved",
          resolutionNote:
            "Verified against stored counterfactual & data quality logs.",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to resolve");
      await loadWorkbench();
      notify("Red-team objection marked resolved.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to resolve", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleClaimTransition = async (
    claim: ClaimRecord,
    targetStatus: string,
    humanOverride = false,
    note = ""
  ) => {
    setBusyMsg("Validating claim promotion gate...");
    try {
      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: claim.id,
          validationStatus: targetStatus,
          humanOverrideApproved: humanOverride,
          humanOverrideNote: note,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && targetStatus === "validated_finding") {
          setOverrideTargetClaim(claim);
        }
        throw new Error(json.error ?? "Transition blocked");
      }
      setOverrideTargetClaim(null);
      setOverrideNote("");
      await loadWorkbench();
      notify(`Updated ${claim.claimCode} -> ${targetStatus}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Transition blocked", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleCreateDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyMsg("Locking preregistered design...");
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(designForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save design");
      setDesignForm((p) => ({ ...p, title: "" }));
      await loadWorkbench();
      notify(
        `Preregistration locked (${json.design.preregistrationHash}). Power: ${json.powerDetails.power}`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Design error", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunCalibration = async () => {
    setBusyMsg("Running 12-test synthetic known-answer calibration suite...");
    try {
      const res = await fetch("/api/calibration", { method: "POST" });
      const json = await safeParseJson(res);
      if (!res.ok) throw new Error(json.error ?? "Calibration failed");
      await loadWorkbench();
      const passed = json.benchmarks.filter(
        (b: { status: string }) => b.status === "PASS"
      ).length;
      notify(
        `Calibration suite completed: ${passed}/${json.benchmarks.length} PASS (instruments only).`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Calibration failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleRunBatchMonteCarlo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyMsg(`Executing ${batchForm.numSeeds}-seed paired Monte Carlo comparison...`);
    try {
      const res = await fetch("/api/runs/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchForm),
      });
      const json = await safeParseJson(res);
      if (!res.ok) throw new Error(json.error ?? "Monte Carlo batch failed");
      setBatchResult(json.result);
      await loadWorkbench();
      notify(
        `Paired ${batchForm.numSeeds}-seed verdict: ${json.result.verdict} (d=${json.result.cohensD}, p≈${json.result.pValueApprox})`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Monte Carlo failed", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleValidateEnvironments = async () => {
    setBusyMsg("Running Part LVI Environment Factory Validation Suite...");
    try {
      const res = await fetch("/api/environments/validate", { method: "POST" });
      const json = await safeParseJson(res);
      if (!res.ok) throw new Error(json.error ?? "Environment validation failed");
      setEnvChecks(json.checks);
      await loadWorkbench();
      notify(
        `Environment Factory Validation: ${json.checks.filter((c: EnvironmentValidationCheck) => c.status === "PASS").length}/${json.checks.length} environments PASS.`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Validation error", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const handleCreateProgramme = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyMsg("Registering Research Programme...");
    try {
      const res = await fetch("/api/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progForm),
      });
      const json = await safeParseJson(res);
      if (!res.ok) throw new Error(json.error ?? "Failed to create programme");
      setProgForm({
        title: "",
        researchQuestion: "",
        operationalDefinition: "",
        hypothesis1: "",
        hypothesis0: "",
      });
      await loadWorkbench();
      notify(`Registered ${json.programme.code}: ${json.programme.title}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Programme error", true);
    } finally {
      setBusyMsg(null);
    }
  };

  const exportResearchRelease = (
    format: "markdown" | "json" | "csv" | "notebook" | "html"
  ) => {
    if (!data) return;
    if (format === "html") {
      const htmlDoc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>OMEIL Research Release ${data.softwareVersion}</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#0f172a;line-height:1.6}h1,h2{border-bottom:1px solid #e2e8f0;padding-bottom:6px}code{background:#f1f5f9;padding:2px 5px;border-radius:4px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:13px;text-align:left}</style></head><body><h1>OMEIL Research Release & Evidence Package</h1><p><strong>Version:</strong> <code>${data.softwareVersion}</code> | <strong>Generated:</strong> ${new Date().toISOString()}</p><h2>Runs (${data.runs.length})</h2><table><tr><th>Code</th><th>Status</th><th>Env</th><th>Seed</th><th>Order R</th><th>TE (bits)</th><th>Dataset Hash</th></tr>${data.runs
        .map(
          (r) =>
            `<tr><td>${r.runCode}</td><td>${r.status}</td><td>${r.environmentFamily}</td><td>${r.seed}</td><td>${r.finalOrderParameter}</td><td>${r.transferEntropyBits}</td><td><code>${r.datasetHash}</code></td></tr>`
        )
        .join("")}</table><h2>Claims (${data.claims.length})</h2><ul>${data.claims
        .map(
          (c) =>
            `<li><strong>${c.claimCode}</strong> [${c.validationStatus}]: ${c.claimText}</li>`
        )
        .join("")}</ul></body></html>`;
      const blob = new Blob([htmlDoc], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omeil-publication-${data.softwareVersion}.html`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Exported print-ready HTML scientific release.");
      return;
    }
    if (!data) return;
    if (format === "notebook") {
      const nb = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {
          kernelspec: {
            display_name: "Python 3",
            language: "python",
            name: "python3",
          },
        },
        cells: [
          {
            cell_type: "markdown",
            metadata: {},
            source: [
              `# OMEIL Reproducible Research Notebook (${data.softwareVersion})\n`,
              `Generated directly from PostgreSQL stored records (${data.runs.length} runs, ${data.interventions.length} counterfactuals, ${data.claims.length} claims).\n`,
            ],
          },
          {
            cell_type: "code",
            execution_count: null,
            metadata: {},
            outputs: [],
            source: [
              "import json\n",
              `OMEIL_RUNS = ${JSON.stringify(
                data.runs.map((r) => ({
                  runCode: r.runCode,
                  status: r.status,
                  env: r.environmentFamily,
                  seed: r.seed,
                  orderParameter: r.finalOrderParameter,
                  meanCoordination: r.meanCoordination,
                  entropyBits: r.entropyBits,
                  transferEntropyBits: r.transferEntropyBits,
                  datasetHash: r.datasetHash,
                })),
                null,
                2
              )}\n`,
              "print(f'Loaded {len(OMEIL_RUNS)} OMEIL runs')\n",
              "for r in OMEIL_RUNS[:5]:\n",
              "    print(r['runCode'], r['status'], r['env'], 'R=', r['orderParameter'])\n",
            ],
          },
        ],
      };
      const blob = new Blob([JSON.stringify(nb, null, 2)], {
        type: "application/x-ipynb+json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omeil-analysis-${data.softwareVersion}.ipynb`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Exported reproducible Jupyter Notebook (.ipynb).");
      return;
    }

    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omeil-reproduction-bundle-${data.softwareVersion}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Exported full JSON reproduction bundle.");
      return;
    }

    if (format === "csv") {
      const header =
        "runCode,status,environmentFamily,seed,agentCount,steps,memoryPolicy,finalOrderParameter,meanCoordination,entropyBits,transferEntropyBits,criticalSlowingLag1,dqPassed,datasetHash\n";
      const rows = data.runs
        .map(
          (r) =>
            `${r.runCode},${r.status},${r.environmentFamily},${r.seed},${r.agentCount},${r.steps},${r.memoryPolicy},${r.finalOrderParameter},${r.meanCoordination},${r.entropyBits},${r.transferEntropyBits},${r.criticalSlowingLag1},${r.dataQuality.passed},${r.datasetHash}`
        )
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omeil-runs-${data.softwareVersion}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Exported runs telemetry CSV.");
      return;
    }

    const lines: string[] = [
      `# OMEIL Research Release & Evidence Package`,
      `Software Version: ${data.softwareVersion}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `## 1. Research Programmes`,
      ...data.programmes.map(
        (p) =>
          `### ${p.code}: ${p.title}\n- Question: ${p.researchQuestion}\n- Operational Definition: ${p.operationalDefinition}\n- Limitations: ${p.limitations}\n`
      ),
      `## 2. Executed Runs (Including Failures & Replications)`,
      ...data.runs.map(
        (r) =>
          `- **${r.runCode}** [${r.status.toUpperCase()} / ${r.runType}] | ${r.environmentFamily} | Seed ${r.seed} | R=${r.finalOrderParameter} | TE=${r.transferEntropyBits}b | Hash \`${r.datasetHash}\`${r.failureReason ? ` | Failure: ${r.failureReason}` : ""}`
      ),
      ``,
      `## 3. Counterfactual Causal Interventions`,
      ...data.interventions.map(
        (cf) =>
          `- **${cf.code}** (${cf.interventionType}): ${cf.conclusionLabel} | d=${cf.effectSizeD} | 95% CI [${cf.ci95Low}, ${cf.ci95High}] | Γ=${cf.sensitivityGammaBound} | ID: ${cf.identificationStatus}`
      ),
      ``,
      `## 4. Claim-Evidence Ledger & Red-Team Status`,
      ...data.claims.map(
        (c) =>
          `- **${c.claimCode}** [${c.validationStatus}]: ${c.claimText}`
      ),
      ``,
      `## 5. Literature Sources Inspected`,
      ...(data.literature ?? []).map(
        (l) =>
          `- **${l.litCode}** (${l.year}) ${l.title} — DOI: ${l.doiOrId} [Access: ${l.accessStatus}, FullText: ${l.inspectedFullText}]`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omeil-research-report-${data.softwareVersion}.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Exported Markdown research report.");
  };

  const livePowerPreview = useMemo(() => {
    const safeVar = Math.max(1e-6, designForm.pilotVarianceEstimate);
    const sd = Math.sqrt(safeVar);
    const delta = Math.abs(designForm.smallestEffectInterest) / sd;
    const zAlpha = 1.96;
    const nSafe = Math.max(2, designForm.plannedTrials);
    const nc = delta * Math.sqrt(nSafe / 2);
    const z = zAlpha - nc;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    const cdf = z > 0 ? 1 - p : p;
    const power = Math.max(0.05, Math.min(0.999, 1 - cdf));
    const reqN =
      delta > 1e-6
        ? Math.ceil((2 * (1.96 + 0.8416) ** 2) / (delta * delta))
        : 9999;
    return {
      power: Number(power.toFixed(3)),
      reqN,
      underpowered: power < 0.8,
    };
  }, [
    designForm.plannedTrials,
    designForm.smallestEffectInterest,
    designForm.pilotVarianceEstimate,
  ]);

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070D19] text-slate-200">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-6 py-4 shadow-2xl">
          <RefreshCw className="h-5 w-5 animate-spin text-sky-400" />
          <span className="font-mono text-xs tracking-wide">
            BOOTSTRAPPING OMEIL SCIENTIFIC OPERATING SYSTEM & POSTGRESQL LEDGER...
          </span>
        </div>
      </div>
    );
  }

  const controls = data.controls;
  const unresolvedCriticalCount = data.reviews.filter(
    (r) => r.severity === "critical" && r.status === "unresolved"
  ).length;
  const failedRunsCount = data.runs.filter(
    (r) => r.status === "failed" || r.status === "inconclusive"
  ).length;
  const calPassCount = data.benchmarks.filter((b) => b.status === "PASS").length;

  const filteredRuns = data.runs.filter(
    (r) =>
      !searchQuery ||
      r.runCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.environmentFamily.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.datasetHash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClaims = data.claims.filter(
    (c) =>
      !searchQuery ||
      c.claimCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claimText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    {
      id: "overview",
      label: "Command & Lifecycle",
      icon: <Layers className="h-3.5 w-3.5" />,
    },
    {
      id: "simulations",
      label: "Simulations, 3D & Replay",
      icon: <Activity className="h-3.5 w-3.5" />,
      badge: String(data.runs.length),
    },
    {
      id: "counterfactuals",
      label: "Causal & Counterfactuals",
      icon: <GitBranch className="h-3.5 w-3.5" />,
      badge: String(data.interventions.length),
    },
    {
      id: "discovery",
      label: "QD Search & Phase Space",
      icon: <Compass className="h-3.5 w-3.5" />,
      badge: `${data.discoveries?.length ?? 0}+${data.sweeps?.length ?? 0}`,
    },
    {
      id: "redteam",
      label: "Red-Team, Swarm & Lit",
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      badge:
        unresolvedCriticalCount > 0
          ? `${unresolvedCriticalCount} CRIT`
          : String(data.claims.length),
    },
    {
      id: "calibration",
      label: "Calibration & Power",
      icon: <Sliders className="h-3.5 w-3.5" />,
      badge: `${calPassCount}/${data.benchmarks.length}`,
    },
    {
      id: "provenance",
      label: "Provenance & Release",
      icon: <Archive className="h-3.5 w-3.5" />,
    },
    {
      id: "methods",
      label: "Methods & Acceptance",
      icon: <HelpCircle className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <OmeilErrorBoundary>
    <div
      className={`min-h-screen transition-colors ${
        highContrast
          ? "bg-white text-black"
          : observatoryTheme
          ? "bg-[#060B16] text-slate-100 [&_div.bg-white]:bg-[#0E1729] [&_div.bg-white]:text-slate-100 [&_div.bg-white]:border-slate-800 [&_form.bg-white]:bg-[#0E1729] [&_form.bg-white]:text-slate-100 [&_form.bg-white]:border-slate-800 [&_.bg-slate-50]:bg-[#131F36] [&_.text-slate-900]:text-slate-100 [&_.text-slate-800]:text-slate-200 [&_.text-slate-700]:text-slate-300 [&_.text-slate-600]:text-slate-400 [&_.border-slate-200]:border-slate-700"
          : "bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50/40 text-slate-900"
      }`}
    >
      {/* MISSION-CONTROL TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B1120] text-slate-100 shadow-md">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-inner">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">
                  OMEIL SCIENTIFIC OS
                </span>
                <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                  {data.softwareVersion}
                </span>
                <span className="hidden items-center gap-1 rounded border border-emerald-800 bg-emerald-950/80 px-2 py-0.5 font-mono text-[10px] text-emerald-300 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {controls?.activeCapabilityTier ?? "TIER 1 — CORE LOCAL LAB"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Counterfactual Causal Lab · Adversarial Red-Team · Dynamical Phase Space · Immutable Provenance
              </p>
            </div>
          </div>

          {/* Search & Human Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center gap-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter runs, claims, hashes..."
                  className="w-40 rounded-lg border border-slate-700 bg-slate-900 py-1.5 pr-2.5 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none sm:w-48"
                />
              </div>
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-[10.5px] text-sky-300 hover:bg-slate-800"
                title="Open Command Palette (Ctrl+K)"
              >
                ⌘K
              </button>
            </div>

            <button
              type="button"
              onClick={() => setObservatoryTheme((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                observatoryTheme
                  ? "border-violet-500 bg-violet-950 text-violet-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
              title="Toggle Obsidian Observatory Dark Theme vs Daylight Scientific Theme"
            >
              {observatoryTheme ? (
                <Moon className="h-3.5 w-3.5 text-violet-300" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-amber-300" />
              )}
              <span className="hidden xl:inline">
                {observatoryTheme ? "Obsidian" : "Daylight"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAdvancedMode((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                advancedMode
                  ? "border-sky-500 bg-sky-950 text-sky-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {advancedMode ? "Advanced" : "Overview"}
            </button>

            <button
              type="button"
              onClick={() =>
                updateControl(
                  {
                    externalProvidersDisabled:
                      !controls?.externalProvidersDisabled,
                    rationale: `Human toggled external providers lock -> ${!controls?.externalProvidersDisabled}`,
                  },
                  controls?.externalProvidersDisabled
                    ? "External providers unlocked by human"
                    : "External providers locked (Local-only)"
                )
              }
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                controls?.externalProvidersDisabled
                  ? "border-slate-700 bg-slate-900 text-emerald-300"
                  : "border-amber-600 bg-amber-950 text-amber-200"
              }`}
            >
              {controls?.externalProvidersDisabled ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}
              <span className="hidden md:inline">
                {controls?.externalProvidersDisabled
                  ? "Local-Only"
                  : "Ext Allowed"}
              </span>
            </button>

            <button
              type="button"
              disabled={
                Boolean(controls?.emergencyStopActive) ||
                Boolean(controls?.swarmPaused)
              }
              onClick={async () => {
                const nextState = !controls?.autonomousModeEnabled;
                await updateControl(
                  {
                    autonomousModeEnabled: nextState,
                    resetCycleCount:
                      nextState &&
                      (controls?.autonomousCycleCount ?? 0) >=
                        (controls?.maxAutonomousCycles ?? 40),
                    rationale: nextState
                      ? "Human turned ON Continuous Autonomous Research Mode"
                      : "Human turned OFF Continuous Autonomous Research Mode",
                  },
                  nextState
                    ? "AUTOPILOT ON — Continuous scientific discovery loop active"
                    : "AUTOPILOT OFF — Returned to manual researcher control"
                );
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-45 ${
                controls?.autonomousModeEnabled
                  ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 shadow-sm hover:bg-emerald-400"
                  : "border border-sky-500/70 bg-sky-950/90 text-sky-200 hover:bg-sky-900"
              }`}
              title="Toggle continuous autonomous research (simulations, counterfactuals, replications, QD search, red-teaming & calibration)"
            >
              <Zap
                className={`h-3.5 w-3.5 ${
                  controls?.autonomousModeEnabled ? "animate-pulse fill-current" : ""
                }`}
              />
              <span>
                {controls?.autonomousModeEnabled
                  ? `AUTOPILOT ON (${controls.autonomousCycleCount}/${controls.maxAutonomousCycles})`
                  : "AUTOPILOT OFF"}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                updateControl(
                  {
                    swarmPaused: !controls?.swarmPaused,
                    rationale: `Human toggled swarm pause -> ${!controls?.swarmPaused}`,
                  },
                  controls?.swarmPaused
                    ? "Research swarm resumed"
                    : "Research swarm paused"
                )
              }
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                controls?.swarmPaused
                  ? "border-amber-500 bg-amber-950 text-amber-200"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {controls?.swarmPaused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
              <span>{controls?.swarmPaused ? "Resume" : "Pause"}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                updateControl(
                  {
                    emergencyStopActive: !controls?.emergencyStopActive,
                    lastStopReason: !controls?.emergencyStopActive
                      ? "Emergency Stop engaged by human researcher"
                      : null,
                    rationale: !controls?.emergencyStopActive
                      ? "EMERGENCY STOP ACTIVATED"
                      : "Emergency Stop cleared",
                  },
                  !controls?.emergencyStopActive
                    ? "EMERGENCY STOP ENGAGED — New runs blocked"
                    : "Emergency Stop released"
                )
              }
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                controls?.emergencyStopActive
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "border border-red-800 bg-red-950/90 text-red-200 hover:bg-red-900"
              }`}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {controls?.emergencyStopActive ? "E-STOP ACTIVE" : "E-STOP"}
            </button>
          </div>
        </div>

        {/* 8-Workspace Navigation Ribbon */}
        <div className="mx-auto flex max-w-[1480px] gap-1 overflow-x-auto border-t border-slate-800/80 bg-[#0F172A] px-4 py-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                activeTab === tab.id
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                    activeTab === tab.id
                      ? "bg-sky-800 text-white"
                      : tab.badge.includes("CRIT")
                      ? "bg-red-900/90 text-red-200"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Banners */}
      <div className="mx-auto max-w-[1480px] px-4 pt-3">
        {controls?.emergencyStopActive && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs text-red-900 shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertOctagon className="h-4 w-4 text-red-600" />
              <span>
                EMERGENCY STOP ENGAGED: All execution paths locked. Stored experiments and provenance remain immutable.
              </span>
            </div>
            <span className="font-mono text-[11px]">{controls.lastStopReason}</span>
          </div>
        )}
        {busyMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-900">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600" />
            <span>{busyMsg}</span>
          </div>
        )}
        {errorBanner && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="font-mono text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {successBanner && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="font-mono text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* MAIN WORKSPACE */}
      <main className="mx-auto max-w-[1480px] px-4 py-3 pb-16">
        {/* ================================================================
            1. COMMAND & LIFECYCLE OVERVIEW
           ================================================================ */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* AUTONOMOUS RESEARCH PILOT & CONTINUOUS WORKFLOW ENGINE (Part LXXXVII) */}
            <div
              className={`rounded-xl border p-4 shadow-xs transition ${
                controls?.autonomousModeEnabled
                  ? "border-emerald-300 bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/80"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                        controls?.emergencyStopActive || controls?.swarmPaused
                          ? "bg-red-100 text-red-800"
                          : controls?.autonomousModeEnabled
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          controls?.autonomousModeEnabled
                            ? "animate-ping bg-white"
                            : "bg-slate-500"
                        }`}
                      />
                      {controls?.emergencyStopActive
                        ? "HALTED BY E-STOP"
                        : controls?.swarmPaused
                        ? "PAUSED BY HUMAN"
                        : controls?.autonomousModeEnabled
                        ? "AUTONOMOUS SCIENTIST RUNNING"
                        : "STANDBY (MANUAL)"}
                    </span>
                    <h2 className="text-sm font-bold text-slate-950">
                      Autonomous Research Pilot & Discovery Loop (Part LXXXVII)
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Turn on Autopilot and OMEIL continuously plans preregistrations, executes bounded simulations &amp; null controls, runs matched-seed counterfactuals, performs independent-seed replications, maps QD &amp; phase-space sweeps, formulates claims, and dispatches blind red-team critics — respecting E-Stop &amp; Resource Caps at all times.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                    <span className="text-[11px] text-slate-500">Pace:</span>
                    <select
                      value={controls?.autonomousIntervalSec ?? 5}
                      onChange={(e) =>
                        updateControl(
                          {
                            autonomousIntervalSec: Number(e.target.value),
                            rationale: `Updated autopilot interval to ${e.target.value}s`,
                          },
                          `Autopilot pace set to ${e.target.value}s`
                        )
                      }
                      className="bg-transparent font-mono text-xs font-semibold text-slate-900 focus:outline-none"
                    >
                      <option value={3}>3s (Fast)</option>
                      <option value={5}>5s (Standard)</option>
                      <option value={10}>10s (Deliberate)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                    <span className="text-[11px] text-slate-500">Cap:</span>
                    <select
                      value={controls?.maxAutonomousCycles ?? 40}
                      onChange={(e) =>
                        updateControl(
                          {
                            maxAutonomousCycles: Number(e.target.value),
                            rationale: `Updated autonomous cycle cap to ${e.target.value}`,
                          },
                          `Cycle budget cap set to ${e.target.value}`
                        )
                      }
                      className="bg-transparent font-mono text-xs font-semibold text-slate-900 focus:outline-none"
                    >
                      <option value={20}>20 cycles</option>
                      <option value={40}>40 cycles</option>
                      <option value={100}>100 cycles</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={
                      Boolean(controls?.emergencyStopActive) ||
                      Boolean(controls?.swarmPaused)
                    }
                    onClick={() => executeAutonomousCycle(true)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-45"
                  >
                    Step 1 Cycle
                  </button>

                  <button
                    type="button"
                    disabled={
                      Boolean(controls?.emergencyStopActive) ||
                      Boolean(controls?.swarmPaused)
                    }
                    onClick={async () => {
                      const nextState = !controls?.autonomousModeEnabled;
                      await updateControl(
                        {
                          autonomousModeEnabled: nextState,
                          resetCycleCount:
                            nextState &&
                            (controls?.autonomousCycleCount ?? 0) >=
                              (controls?.maxAutonomousCycles ?? 40),
                        },
                        nextState
                          ? "Autonomous Research Pilot STARTED"
                          : "Autonomous Research Pilot STOPPED"
                      );
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-45 ${
                      controls?.autonomousModeEnabled
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {controls?.autonomousModeEnabled
                      ? "Turn OFF Autopilot"
                      : "Turn ON Autopilot"}
                  </button>
                </div>
              </div>

              {/* 8-Stage Autonomous Scientific Pipeline Stepper */}
              <AutonomousPipelineStepper
                cycleCount={controls?.autonomousCycleCount ?? 0}
                isAutonomous={Boolean(controls?.autonomousModeEnabled)}
                lastActionType={data.autonomousLogs?.[0]?.actionType}
              />

              {/* Cycle Progress & Live Autonomous Decision Feed */}
              <div className="mt-3 grid gap-3 lg:grid-cols-12">
                <div className="rounded-lg border border-slate-200 bg-white/90 p-3 lg:col-span-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">
                      Session Cycle Budget
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {controls?.autonomousCycleCount ?? 0} /{" "}
                      {controls?.maxAutonomousCycles ?? 40}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          ((controls?.autonomousCycleCount ?? 0) /
                            Math.max(1, controls?.maxAutonomousCycles ?? 40)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600">
                    <strong>Last Action:</strong>{" "}
                    {controls?.lastAutonomousAction ??
                      "Ready — click 'Turn ON Autopilot' or 'Step 1 Cycle'."}
                  </div>
                  {(controls?.autonomousCycleCount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateControl(
                          { resetCycleCount: true },
                          "Reset autonomous session cycle counter"
                        )
                      }
                      className="mt-2 text-[10.5px] font-medium text-blue-700 underline"
                    >
                      Reset Cycle Counter
                    </button>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/90 p-3 lg:col-span-8">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Live Autonomous Scientist Decision Feed (Latest{" "}
                      {data.autonomousLogs?.length ?? 0})
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      8-Phase Scientific Curriculum
                    </span>
                  </div>
                  {!data.autonomousLogs || data.autonomousLogs.length === 0 ? (
                    <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                      No autonomous cycles executed yet. Turn ON Autopilot above to watch OMEIL continuously run experiments, counterfactuals, replications, and red-team reviews.
                    </div>
                  ) : (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                      {data.autonomousLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">
                                #{log.cycleNumber}
                              </span>
                              <span className="rounded bg-slate-200 px-1.5 py-0.2 font-mono text-[9.5px] font-semibold text-slate-800">
                                {log.stageName}
                              </span>
                              <span className="font-mono font-bold text-blue-700">
                                {log.targetEntityCode}
                              </span>
                            </div>
                            <div className="mt-0.5 text-slate-700">
                              {log.outcomeSummary}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold ${
                              log.scientificDisposition === "replicated" ||
                              log.scientificDisposition === "instrument_calibrated"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.scientificDisposition ===
                                  "redteam_objection_filed"
                                ? "bg-red-100 text-red-800"
                                : log.scientificDisposition ===
                                  "inconclusive_underpowered"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {log.scientificDisposition}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Telemetry KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {[
                {
                  label: "Immutable Runs",
                  value: data.runs.length,
                  sub: `${failedRunsCount} failed/inconclusive preserved`,
                  accent: "text-slate-900",
                },
                {
                  label: "Causal Counterfactuals",
                  value: data.interventions.length,
                  sub: "Matched-seed & DAG audited",
                  accent: "text-blue-700",
                },
                {
                  label: "QD Behavioral Archives",
                  value: data.discoveries?.length ?? 0,
                  sub: `${data.discoveries?.[0]?.coveragePct ?? 0}% repertoire coverage`,
                  accent: "text-indigo-700",
                },
                {
                  label: "Phase & Hysteresis Sweeps",
                  value: data.sweeps?.length ?? 0,
                  sub: "2D coupling×noise & loops",
                  accent: "text-teal-700",
                },
                {
                  label: "Validated Claims",
                  value: `${
                    data.claims.filter(
                      (c) => c.validationStatus === "validated_finding"
                    ).length
                  }/${data.claims.length}`,
                  sub: `${unresolvedCriticalCount} critical blocker(s)`,
                  accent:
                    unresolvedCriticalCount > 0
                      ? "text-red-700"
                      : "text-emerald-700",
                },
                {
                  label: "Instrument Self-Test",
                  value: `${calPassCount}/${data.benchmarks.length}`,
                  sub: "Known-answer calibration",
                  accent: "text-emerald-700",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
                >
                  <div className="text-[11px] font-medium text-slate-500">
                    {kpi.label}
                  </div>
                  <div
                    className={`mt-1 font-mono text-2xl font-bold ${kpi.accent}`}
                  >
                    {kpi.value}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    {kpi.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Connected Scientific Lifecycle */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-950">
                    OMEIL Connected Scientific Lifecycle (Part LIV)
                  </h2>
                  <p className="text-xs text-slate-500">
                    End-to-end traceability from research questions and preregistered protocols to 3D phase spaces, causal DAGs, adversarial red-teaming, and publication bundles.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("simulations")}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Launch Simulation →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("discovery")}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Explore Phase Space →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  {
                    s: "1. Programmes",
                    v: `${data.programmes.length} Active`,
                    t: "overview" as TabId,
                  },
                  {
                    s: "2. Power & Prereg",
                    v: `${data.designs.length} Locked`,
                    t: "calibration" as TabId,
                  },
                  {
                    s: "3. Runs & 3D Lab",
                    v: `${data.runs.length} Runs`,
                    t: "simulations" as TabId,
                  },
                  {
                    s: "4. Causal Lab",
                    v: `${data.interventions.length} DAGs`,
                    t: "counterfactuals" as TabId,
                  },
                  {
                    s: "5. QD & Phase",
                    v: `${data.sweeps?.length ?? 0} Sweeps`,
                    t: "discovery" as TabId,
                  },
                  {
                    s: "6. Red-Team",
                    v: `${data.reviews.length} Reviews`,
                    t: "redteam" as TabId,
                  },
                  {
                    s: "7. Provenance",
                    v: `${data.provenance.length} Logs`,
                    t: "provenance" as TabId,
                  },
                  {
                    s: "8. Acceptance",
                    v: "Audit Gate",
                    t: "methods" as TabId,
                  },
                ].map((item) => (
                  <button
                    key={item.s}
                    type="button"
                    onClick={() => setActiveTab(item.t)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-left transition hover:border-sky-500 hover:bg-sky-50/50"
                  >
                    <div className="text-[10.5px] font-semibold text-slate-700">
                      {item.s}
                    </div>
                    <div className="mt-1 font-mono text-xs font-bold text-blue-700">
                      {item.v}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Scientific Traceability Graph + Zero-Hallucination Evidence Query Assistant */}
            <div className="grid gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <TraceabilityGraphSvg
                  data={data}
                  onJumpToRun={(id) => {
                    setSelectedRunId(id);
                    setActiveTab("simulations");
                  }}
                  onJumpToCf={(id) => {
                    setSelectedCfId(id);
                    setActiveTab("counterfactuals");
                  }}
                  onJumpToClaim={(id) => {
                    setSelectedClaimId(id);
                    setActiveTab("redteam");
                  }}
                />
              </div>
              <div className="xl:col-span-5">
                <EvidenceQueryAssistant
                  data={data}
                  onNavigateRun={(id) => {
                    setSelectedRunId(id);
                    setActiveTab("simulations");
                  }}
                  onNavigateCf={(id) => {
                    setSelectedCfId(id);
                    setActiveTab("counterfactuals");
                  }}
                  onNavigateClaim={(id) => {
                    setSelectedClaimId(id);
                    setActiveTab("redteam");
                  }}
                />
              </div>
            </div>

            {/* Programmes + Extended Experiment Matrix + Hardware Profile */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-7">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Research Programmes (Operationalized & Scope-Bounded)
                </h3>
                {/* Create New Research Programme */}
                <form
                  onSubmit={handleCreateProgramme}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
                >
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <PlusCircle className="h-3.5 w-3.5 text-blue-600" />
                    Define New Research Programme (Part LIV)
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      value={progForm.title}
                      onChange={(e) =>
                        setProgForm((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="Programme title..."
                      className="rounded border border-slate-200 px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      required
                      value={progForm.operationalDefinition}
                      onChange={(e) =>
                        setProgForm((p) => ({
                          ...p,
                          operationalDefinition: e.target.value,
                        }))
                      }
                      placeholder="Operational metric definition..."
                      className="rounded border border-slate-200 px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      required
                      value={progForm.researchQuestion}
                      onChange={(e) =>
                        setProgForm((p) => ({
                          ...p,
                          researchQuestion: e.target.value,
                        }))
                      }
                      placeholder="Falsifiable research question..."
                      className="sm:col-span-2 rounded border border-slate-200 px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={progForm.hypothesis1}
                      onChange={(e) =>
                        setProgForm((p) => ({ ...p, hypothesis1: e.target.value }))
                      }
                      placeholder="Competing Hypothesis H1 (optional)..."
                      className="rounded border border-slate-200 px-2.5 py-1.5"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
                    >
                      Register Programme
                    </button>
                  </div>
                </form>

                {data.programmes.map((prog) => (
                  <div
                    key={prog.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                          {prog.code}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {prog.title}
                        </h4>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Ethics Verified
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-700">
                      <strong>Question:</strong> {prog.researchQuestion}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      <strong>Operational Definition:</strong>{" "}
                      {prog.operationalDefinition}
                    </p>
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">
                      <ul className="list-disc space-y-0.5 pl-4">
                        {prog.competingHypotheses.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span>
                        <strong>Scope Limits:</strong> {prog.limitations}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 lg:col-span-5">
                {/* Executable Experiment Matrix (Part XLVIII & LXXXVI) */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Executable Experiment Matrix (Part XLVIII & LXXXVI)
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    One-click load real experiment templates into the bounded simulation launcher.
                  </p>
                  <div className="mt-2.5 space-y-2">
                    {EXPERIMENT_MATRIX_TEMPLATES.map((tpl) => (
                      <div
                        key={tpl.code}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            <span className="font-mono text-blue-700">
                              {tpl.code}
                            </span>{" "}
                            · {tpl.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {tpl.env} | {tpl.memory} | {tpl.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSimForm((p) => ({
                              ...p,
                              title: `${tpl.code}: ${tpl.name}`,
                              environmentFamily: tpl.env,
                              commNoise: tpl.noise,
                              couplingStrength: tpl.coupling,
                              memoryPolicy: tpl.memory,
                            }));
                            setActiveTab("simulations");
                          }}
                          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Load →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hardware & Capability Tier Monitor (Part XXXIX & XCI) */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Cpu className="h-3.5 w-3.5 text-slate-700" />
                      Resource Governor & Capability Tier
                    </h3>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                      TIER 1 ACTIVE
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="rounded bg-slate-50 p-2">
                      <div className="text-[10px] text-slate-500">
                        Max Agents/Run
                      </div>
                      <div className="font-bold text-slate-900">
                        {controls?.maxAgentsPerRun ?? 48} bounded
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 p-2">
                      <div className="text-[10px] text-slate-500">
                        Max Steps/Run
                      </div>
                      <div className="font-bold text-slate-900">
                        {controls?.maxStepsPerRun ?? 180} bounded
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 p-2">
                      <div className="text-[10px] text-slate-500">
                        External Models
                      </div>
                      <div className="font-bold text-slate-900">
                        {controls?.externalProvidersDisabled
                          ? "LOCKED (Offline)"
                          : "UNLOCKED"}
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 p-2">
                      <div className="text-[10px] text-slate-500">
                        GPU Required?
                      </div>
                      <div className="font-bold text-emerald-700">
                        No (CPU Safe)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            2. SIMULATIONS, 3D VOLUMETRIC PHASE SPACE & REPLAY DEBUGGER
           ================================================================ */}
        {activeTab === "simulations" && (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left: Launcher & Immutable Run List */}
            <div className="space-y-4 lg:col-span-4">
              <form
                onSubmit={handleRunSimulation}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Environment Factory Launcher
                  </h3>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                    Cap {controls?.maxAgentsPerRun ?? 48}ag/{controls?.maxStepsPerRun ?? 180}st
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <input
                    type="text"
                    value={simForm.title}
                    onChange={(e) =>
                      setSimForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Optional experiment run title..."
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />

                  <div>
                    <label className="mb-1 block font-medium text-slate-700">
                      Environment Family (Part LVI)
                    </label>
                    <select
                      value={simForm.environmentFamily}
                      onChange={(e) =>
                        setSimForm((p) => ({
                          ...p,
                          environmentFamily: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="CoupledOscillatorSwarm">
                        CoupledOscillatorSwarm
                      </option>
                      <option value="ResourceForagingCommons">
                        ResourceForagingCommons
                      </option>
                      <option value="ConventionEmergenceGrid">
                        ConventionEmergenceGrid
                      </option>
                      <option value="NullStochasticBaseline">
                        NullStochasticBaseline (Null Control)
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Memory Policy
                      </label>
                      <select
                        value={simForm.memoryPolicy}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            memoryPolicy: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="stateless">stateless</option>
                        <option value="short_memory">short_memory</option>
                        <option value="persistent_episodic">
                          persistent_episodic
                        </option>
                        <option value="shared_memory">shared_memory</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Run Classification
                      </label>
                      <select
                        value={simForm.runType}
                        onChange={(e) =>
                          setSimForm((p) => ({ ...p, runType: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="exploratory">exploratory</option>
                        <option value="pilot">pilot</option>
                        <option value="confirmatory">confirmatory</option>
                        <option value="null_control">null_control</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Seed
                      </label>
                      <input
                        type="number"
                        value={simForm.seed}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            seed: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Agents
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={48}
                        value={simForm.agentCount}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            agentCount: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Steps
                      </label>
                      <input
                        type="number"
                        min={12}
                        max={180}
                        value={simForm.steps}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            steps: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Coupling ({simForm.couplingStrength})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1.2}
                        step={0.05}
                        value={simForm.couplingStrength}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            couplingStrength: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-slate-700">
                        Noise ({simForm.commNoise})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={0.6}
                        step={0.02}
                        value={simForm.commNoise}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            commNoise: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        checked={simForm.commChannelEnabled}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            commChannelEnabled: e.target.checked,
                          }))
                        }
                        className="accent-blue-600"
                      />
                      Comm Channel
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-amber-800">
                      <input
                        type="checkbox"
                        checked={simForm.injectLoggingDefect}
                        onChange={(e) =>
                          setSimForm((p) => ({
                            ...p,
                            injectLoggingDefect: e.target.checked,
                          }))
                        }
                        className="accent-amber-600"
                      />
                      Inject Logging Defect
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                  >
                    Execute Bounded Simulation
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Immutable Run Registry ({filteredRuns.length})
                </h3>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {filteredRuns.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRunId(r.id)}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        activeRun?.id === r.id
                          ? "border-blue-600 bg-blue-50/70"
                          : "border-slate-200 bg-slate-50/60 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {r.runCode}{" "}
                          <span className="font-normal text-slate-500">
                            · {r.runType}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            r.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "inconclusive"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-800">
                        {r.title}
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
                        <span>
                          {r.environmentFamily.slice(0, 15)} | s={r.seed}
                        </span>
                        <span>R={r.finalOrderParameter}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: 3D Volumetric Field, Debugger, Charts, Recurrence & PID */}
            <div className="space-y-4 lg:col-span-8">
              {activeRun && (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            {activeRun.runCode}
                          </span>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {activeRun.title}
                          </h3>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          {activeRun.environmentFamily} · {activeRun.memoryPolicy}{" "}
                          · seed {activeRun.seed} · sha256:{activeRun.datasetHash}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={compareRunId ?? ""}
                          onChange={(e) =>
                            setCompareRunId(
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
                          title="Overlay a second run in 3D Phase Space and Trajectory Charts"
                        >
                          <option value="">Compare Overlay: None</option>
                          {data.runs
                            .filter((r) => r.id !== activeRun.id)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                vs {r.runCode} (R={r.finalOrderParameter})
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleReplicateRun(activeRun.id)}
                          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          title="Run an independent-seed replication (never cached)"
                        >
                          <Repeat className="h-3.5 w-3.5" />
                          Replicate (New Seed)
                        </button>
                        <span
                          className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                            activeRun.dataQuality.passed
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          DQ:{" "}
                          {activeRun.dataQuality.passed ? "VERIFIED" : "FAILED"}
                        </span>
                      </div>
                    </div>

                    {activeRun.failureReason && (
                      <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <strong>Preserved Failure / Inconclusive Record:</strong>{" "}
                        {activeRun.failureReason}
                      </div>
                    )}

                    {advancedMode && (
                      <div className="mt-2.5 rounded-lg border border-sky-200 bg-sky-50/70 p-2.5 font-mono text-[11px] text-slate-800">
                        <div className="font-semibold text-sky-900">
                          Advanced Inspection Provenance & Telemetry
                        </div>
                        <div className="mt-1 grid gap-1 sm:grid-cols-3">
                          <span>configHash: {activeRun.configHash}</span>
                          <span>datasetHash: {activeRun.datasetHash}</span>
                          <span>software: {activeRun.softwareVersion}</span>
                          <span>coupling: {activeRun.couplingStrength}</span>
                          <span>commNoise: {activeRun.commNoise}</span>
                          <span>powerObs: {activeRun.statisticalPowerObserved}</span>
                          <span>missingSteps: {activeRun.dataQuality.missingSteps}</span>
                          <span>nanCount: {activeRun.dataQuality.nanDetected}</span>
                          <span>resErr: {activeRun.dataQuality.resourceConservationError}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[
                        { k: "Order R(T)", v: activeRun.finalOrderParameter },
                        { k: "Mean Coord", v: activeRun.meanCoordination },
                        { k: "Entropy H", v: `${activeRun.entropyBits}b` },
                        {
                          k: "Transfer Ent.",
                          v: `${activeRun.transferEntropyBits}b`,
                        },
                        { k: "Lag-1 CSD", v: activeRun.criticalSlowingLag1 },
                        { k: "Micro-Macro Δ", v: activeRun.microMacroDivergence },
                      ].map((m) => (
                        <div
                          key={m.k}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-2"
                        >
                          <div className="text-[10px] text-slate-500">{m.k}</div>
                          <div className="font-mono text-xs font-bold text-slate-900">
                            {m.v}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3D Phase Space + Event Replay Debugger */}
                  <div className="grid gap-4 xl:grid-cols-12">
                    <div className="xl:col-span-7">
                      <PhaseSpace3D
                        runCode={activeRun.runCode}
                        agents={activeRun.finalAgents}
                        trajectory={activeRun.trajectory}
                        commEnabled={activeRun.commChannelEnabled}
                        currentStep={replayStep}
                        selectedAgentId={selectedAgentId}
                        onSelectAgent={setSelectedAgentId}
                        colorBlindSafe={colorBlindSafe}
                        reducedMotion={reducedMotion}
                        comparisonAgents={compareRun?.finalAgents}
                        comparisonRunCode={compareRun?.runCode}
                      />
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs xl:col-span-5">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                            <Terminal className="h-3.5 w-3.5 text-blue-600" />
                            Event Replay & Agent State Debugger
                          </h4>
                          <span className="font-mono text-[10px] text-slate-500">
                            Seed {activeRun.seed}
                          </span>
                        </div>

                        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                          <div className="mb-1.5 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const maxS =
                                    activeRun.trajectory[
                                      activeRun.trajectory.length - 1
                                    ]?.step ?? activeRun.steps;
                                  if (replayStep >= maxS) setReplayStep(1);
                                  setIsPlaying((p) => !p);
                                }}
                                className="flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 font-medium text-white hover:bg-slate-800"
                              >
                                {isPlaying ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                {isPlaying ? "Pause" : "Replay"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setReplayStep((s) =>
                                    Math.min(activeRun.steps, s + 1)
                                  )
                                }
                                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100"
                              >
                                <SkipForward className="h-3 w-3" />
                                +1
                              </button>
                            </div>
                            <span className="font-mono font-bold text-slate-800">
                              t = {replayStep} / {activeRun.steps}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={
                              activeRun.trajectory[
                                activeRun.trajectory.length - 1
                              ]?.step ?? activeRun.steps
                            }
                            value={replayStep}
                            onChange={(e) => {
                              setIsPlaying(false);
                              setReplayStep(Number(e.target.value));
                            }}
                            className="w-full accent-blue-600"
                          />
                        </div>

                        {(() => {
                          const ag =
                            activeRun.finalAgents.find(
                              (a) => a.id === selectedAgentId
                            ) ?? activeRun.finalAgents[0];
                          if (!ag) return null;
                          return (
                            <div className="mb-3 rounded-lg border border-slate-200 p-2.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-slate-900">
                                  {ag.id} ({ag.role})
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                    ag.active
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {ag.active ? "ACTIVE" : "REMOVED"}
                                </span>
                              </div>
                              <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-600">
                                <span>Signal: {ag.signal}</span>
                                <span>Energy: {ag.energy}</span>
                                <span>Cluster: C{ag.clusterId}</span>
                                <span>Action: {ag.lastAction}</span>
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                Observable diagnostic state only.
                              </div>
                            </div>
                          );
                        })()}

                        <div className="text-[11px] font-semibold text-slate-700">
                          Captured Event Timeline (≤ step {replayStep})
                        </div>
                        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto font-mono text-[10px]">
                          {activeRun.events
                            .filter((ev) => ev.step <= replayStep)
                            .slice(-10)
                            .reverse()
                            .map((ev) => (
                              <div
                                key={ev.seq}
                                className={`rounded border px-2 py-1 ${
                                  ev.type === "anomaly_detected"
                                    ? "border-amber-200 bg-amber-50 text-amber-900"
                                    : ev.type === "agent_removed"
                                    ? "border-red-200 bg-red-50 text-red-900"
                                    : "border-slate-100 bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span className="font-bold">t={ev.step}</span> [
                                {ev.type}] {ev.summary}
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trajectory Charts (With Optional Side-by-Side Run Comparison) */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <TrajectoryChart
                      title="Collective Order Parameter R(t)"
                      primary={activeRun.trajectory}
                      primaryLabel={`${activeRun.runCode} Order R(t)`}
                      comparison={compareRun?.trajectory}
                      comparisonLabel={
                        compareRun ? `${compareRun.runCode} Order R(t)` : undefined
                      }
                      metric="orderParameter"
                      unit="dimensionless [0,1]"
                      yMax={1}
                      currentStep={replayStep}
                      colorBlindSafe={colorBlindSafe}
                      plainExplanation="Hover to inspect exact step values and rolling ±1 SD envelope."
                    />
                    <TrajectoryChart
                      title="Transfer Entropy TE(X→Y)"
                      primary={activeRun.trajectory}
                      primaryLabel={`${activeRun.runCode} Transfer Entropy`}
                      comparison={compareRun?.trajectory}
                      comparisonLabel={
                        compareRun ? `${compareRun.runCode} TE` : undefined
                      }
                      metric="transferEntropyBits"
                      unit="bits"
                      currentStep={replayStep}
                      colorBlindSafe={colorBlindSafe}
                      plainExplanation="Directional predictive flow in bits; statistical dependence ≠ semantic meaning."
                    />
                  </div>

                  {/* Interactive Agent Network Topology + Recurrence & PID */}
                  <AgentNetworkTopologySvg
                    runCode={activeRun.runCode}
                    agents={activeRun.finalAgents}
                    commEnabled={activeRun.commChannelEnabled}
                    selectedAgentId={selectedAgentId}
                    onSelectAgent={setSelectedAgentId}
                  />

                  <RecurrenceAndPidPanel
                    runCode={activeRun.runCode}
                    trajectory={activeRun.trajectory}
                  />

                  {/* Multi-Scale Cross-Level Emergence, CUSUM Change-Points & Independence Audit */}
                  <MultiScaleAndIndependencePanel run={activeRun} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ================================================================
            3. COUNTERFACTUAL & CAUSAL WORKBENCH
           ================================================================ */}
        {activeTab === "counterfactuals" && (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4">
              <form
                onSubmit={handleRunCounterfactual}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Counterfactual Intervention Lab
                </h3>
                <p className="mb-3 text-[11px] text-slate-500">
                  Original runs remain immutable; interventions generate new linked run IDs and explicit identification guards.
                </p>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">
                      Immutable Parent Run
                    </label>
                    <select
                      value={cfForm.parentRunId}
                      onChange={(e) =>
                        setCfForm((p) => ({
                          ...p,
                          parentRunId: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {data.runs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.runCode} — {r.title} (seed {r.seed})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-slate-700">
                      Counterfactual Operator (Part XXIX)
                    </label>
                    <select
                      value={cfForm.interventionType}
                      onChange={(e) =>
                        setCfForm((p) => ({
                          ...p,
                          interventionType: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="channel_disable">
                        Disable Communication Channel
                      </option>
                      <option value="agent_removal">
                        Remove Particular Agent
                      </option>
                      <option value="variable_change">
                        Change Variable (Noise / Coupling)
                      </option>
                      <option value="resource_relax">
                        Relax Resource Constraint
                      </option>
                      <option value="timing_shift">
                        Shift Intervention Timing
                      </option>
                      <option value="mechanism_ablation">
                        Ablate Feedback Mechanism
                      </option>
                      <option value="environment_transfer">
                        Transfer Population to Another Environment
                      </option>
                    </select>
                  </div>

                  {cfForm.interventionType === "agent_removal" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-slate-700">
                          Agent Index
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={cfForm.removedAgentIndex}
                          onChange={(e) =>
                            setCfForm((p) => ({
                              ...p,
                              removedAgentIndex: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-slate-700">
                          Removal Step
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={cfForm.interventionStep}
                          onChange={(e) =>
                            setCfForm((p) => ({
                              ...p,
                              interventionStep: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {cfForm.interventionType === "timing_shift" && (
                    <div>
                      <label className="mb-1 block text-slate-700">
                        Perturbation Step
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={cfForm.interventionStep}
                        onChange={(e) =>
                          setCfForm((p) => ({
                            ...p,
                            interventionStep: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                  )}

                  {cfForm.interventionType === "variable_change" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-slate-700">
                          New Noise
                        </label>
                        <input
                          type="number"
                          step={0.05}
                          min={0}
                          max={0.8}
                          value={cfForm.commNoise}
                          onChange={(e) =>
                            setCfForm((p) => ({
                              ...p,
                              commNoise: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-slate-700">
                          New Coupling
                        </label>
                        <input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1.2}
                          value={cfForm.couplingStrength}
                          onChange={(e) =>
                            setCfForm((p) => ({
                              ...p,
                              couplingStrength: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {cfForm.interventionType === "resource_relax" && (
                    <div>
                      <label className="mb-1 block text-slate-700">
                        Resource Multiplier
                      </label>
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={5}
                        value={cfForm.resourceMultiplier}
                        onChange={(e) =>
                          setCfForm((p) => ({
                            ...p,
                            resourceMultiplier: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                  )}

                  {cfForm.interventionType === "environment_transfer" && (
                    <div>
                      <label className="mb-1 block text-slate-700">
                        Target Environment
                      </label>
                      <select
                        value={cfForm.targetEnvironment}
                        onChange={(e) =>
                          setCfForm((p) => ({
                            ...p,
                            targetEnvironment: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <option value="ResourceForagingCommons">
                          ResourceForagingCommons
                        </option>
                        <option value="ConventionEmergenceGrid">
                          ConventionEmergenceGrid
                        </option>
                        <option value="NullStochasticBaseline">
                          NullStochasticBaseline
                        </option>
                      </select>
                    </div>
                  )}

                  <input
                    type="text"
                    value={cfForm.question}
                    onChange={(e) =>
                      setCfForm((p) => ({ ...p, question: e.target.value }))
                    }
                    placeholder="Counterfactual research question..."
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />

                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={cfForm.matchedSeed}
                      onChange={(e) =>
                        setCfForm((p) => ({
                          ...p,
                          matchedSeed: e.target.checked,
                        }))
                      }
                      className="accent-blue-600"
                    />
                    Matched PRNG Seed
                  </label>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
                  >
                    Run Counterfactual Intervention
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Counterfactual Ledger ({data.interventions.length})
                </h3>
                <div className="space-y-2">
                  {data.interventions.map((cf) => (
                    <button
                      key={cf.id}
                      type="button"
                      onClick={() => setSelectedCfId(cf.id)}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        activeCf?.id === cf.id
                          ? "border-blue-600 bg-blue-50/70"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {cf.code} ({cf.interventionType})
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] ${
                            cf.identificationStatus ===
                            "identified_matched_counterfactual"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {cf.identificationStatus ===
                          "identified_matched_counterfactual"
                            ? "IDENTIFIED"
                            : "ASSOCIATIVE"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-700">
                        {cf.question}
                      </p>
                      <div className="mt-1 font-mono text-[10px] text-slate-500">
                        ΔCoord={cf.deltaCoordination} | d={cf.effectSizeD} | Γ=
                        {cf.sensitivityGammaBound}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:col-span-8">
              {activeCf && (() => {
                const parentRun = data.runs.find(
                  (r) => r.id === activeCf.parentRunId
                );
                const cfRun = data.runs.find(
                  (r) => r.id === activeCf.counterfactualRunId
                );
                return (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-blue-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                              {activeCf.code}
                            </span>
                            <span className="font-mono text-xs text-slate-600">
                              {parentRun?.runCode} → {cfRun?.runCode}
                            </span>
                          </div>
                          <h3 className="mt-1.5 text-sm font-semibold text-slate-900">
                            {activeCf.question}
                          </h3>
                        </div>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800">
                          {activeCf.conclusionLabel}
                        </span>
                      </div>

                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                        <strong>Identification Rationale:</strong>{" "}
                        {activeCf.identificationRationale}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          { k: "Δ Coordination", v: activeCf.deltaCoordination },
                          { k: "Δ Order R(t)", v: activeCf.deltaOrderParameter },
                          { k: "Cohen's d", v: activeCf.effectSizeD },
                          {
                            k: "95% CI",
                            v: `[${activeCf.ci95Low}, ${activeCf.ci95High}]`,
                          },
                          {
                            k: "Sensitivity Γ",
                            v: activeCf.sensitivityGammaBound,
                          },
                        ].map((m) => (
                          <div
                            key={m.k}
                            className="rounded-lg border border-slate-100 bg-slate-50 p-2"
                          >
                            <div className="text-[10px] text-slate-500">
                              {m.k}
                            </div>
                            <div className="font-mono text-xs font-bold text-slate-900">
                              {m.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <CausalDagSvg
                        nodes={activeCf.causalDag.nodes}
                        edges={activeCf.causalDag.edges}
                        identificationStatus={activeCf.identificationStatus}
                      />
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-xs">
                        <h4 className="font-semibold text-slate-900">
                          Documented Confounders & Alternative Explanations
                        </h4>
                        <div className="mt-2">
                          <div className="font-medium text-red-800">
                            Confounders Tracked:
                          </div>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                            {activeCf.confounders.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3">
                          <div className="font-medium text-amber-800">
                            Alternative Explanations:
                          </div>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-700">
                            {activeCf.alternativeExplanations.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {parentRun && cfRun && (
                      <TrajectoryChart
                        title="Baseline vs Counterfactual Trajectory Overlay"
                        primary={parentRun.trajectory}
                        primaryLabel={`Parent ${parentRun.runCode} (Control)`}
                        comparison={cfRun.trajectory}
                        comparisonLabel={`Counterfactual ${cfRun.runCode} (${activeCf.interventionType})`}
                        metric="meanCoordination"
                        unit="coordination [0,1]"
                        yMax={1}
                        colorBlindSafe={colorBlindSafe}
                      />
                    )}

                    {/* Multi-Seed Monte Carlo Paired Comparison Lab (Part XXXI & XCVI) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                            Multi-Seed Monte Carlo Paired Comparison Lab (Part XXXI &amp; XCVI)
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Executes K matched-seed trials across two policies to compute Cohen&apos;s d, paired t-test, 95% CI, and Statistical Power Verdict.
                          </p>
                        </div>
                      </div>

                      <form
                        onSubmit={handleRunBatchMonteCarlo}
                        className="grid gap-2 text-xs sm:grid-cols-5"
                      >
                        <select
                          value={batchForm.environmentFamily}
                          onChange={(e) =>
                            setBatchForm((p) => ({
                              ...p,
                              environmentFamily: e.target.value,
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1.5"
                        >
                          <option value="ConventionEmergenceGrid">
                            ConventionEmergenceGrid
                          </option>
                          <option value="CoupledOscillatorSwarm">
                            CoupledOscillatorSwarm
                          </option>
                          <option value="ResourceForagingCommons">
                            ResourceForagingCommons
                          </option>
                        </select>
                        <select
                          value={batchForm.memoryA}
                          onChange={(e) =>
                            setBatchForm((p) => ({
                              ...p,
                              memoryA: e.target.value,
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1.5"
                        >
                          <option value="shared_memory">A: shared_memory</option>
                          <option value="persistent_episodic">
                            A: persistent_episodic
                          </option>
                          <option value="short_memory">A: short_memory</option>
                          <option value="stateless">A: stateless</option>
                        </select>
                        <select
                          value={batchForm.memoryB}
                          onChange={(e) =>
                            setBatchForm((p) => ({
                              ...p,
                              memoryB: e.target.value,
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1.5"
                        >
                          <option value="stateless">B: stateless</option>
                          <option value="short_memory">B: short_memory</option>
                          <option value="persistent_episodic">
                            B: persistent_episodic
                          </option>
                          <option value="shared_memory">B: shared_memory</option>
                        </select>
                        <select
                          value={batchForm.numSeeds}
                          onChange={(e) =>
                            setBatchForm((p) => ({
                              ...p,
                              numSeeds: Number(e.target.value),
                            }))
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1.5 font-mono"
                        >
                          <option value={4}>4 seeds (Pilot)</option>
                          <option value={6}>6 seeds</option>
                          <option value={10}>10 seeds</option>
                          <option value={12}>12 seeds</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
                        >
                          Run Paired Batch
                        </button>
                      </form>

                      {batchResult && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              Verdict: {batchResult.verdict}
                            </span>
                            <span className="font-mono text-[11px] text-blue-700">
                              ΔCoord={batchResult.meanDeltaCoord} | d=
                              {batchResult.cohensD} | t={batchResult.tStat} | p≈
                              {batchResult.pValueApprox} | Power=
                              {batchResult.observedPower}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10.5px] sm:grid-cols-6">
                            {batchResult.trials.map((tr) => (
                              <div
                                key={tr.seed}
                                className="rounded border border-slate-200 bg-white p-1.5"
                              >
                                <div className="text-slate-500">s={tr.seed}</div>
                                <div className="font-bold text-slate-900">
                                  Δ={tr.deltaCoord >= 0 ? "+" : ""}
                                  {tr.deltaCoord}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ================================================================
            4. OPEN-ENDED DISCOVERY (MAP-ELITES) & PHASE-SPACE / HYSTERESIS
           ================================================================ */}
        {activeTab === "discovery" && (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-12">
              {/* Controls for QD Search & Parameter Sweeps */}
              <div className="space-y-4 lg:col-span-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Open-Ended MAP-Elites Search (Part LVII)
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Maps behavioral space (Order R × Entropy H), preserving both high-coordination and unusual unstable niches.
                  </p>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <select
                      value={qdEnv}
                      onChange={(e) => setQdEnv(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <option value="CoupledOscillatorSwarm">
                        CoupledOscillatorSwarm
                      </option>
                      <option value="ResourceForagingCommons">
                        ResourceForagingCommons
                      </option>
                      <option value="ConventionEmergenceGrid">
                        ConventionEmergenceGrid
                      </option>
                      <option value="NullStochasticBaseline">
                        NullStochasticBaseline
                      </option>
                    </select>
                    <button
                      type="button"
                      onClick={handleRunQdSearch}
                      className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                    >
                      Run 20-Eval MAP-Elites Search
                    </button>
                  </div>

                  {data.discoveries?.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
                      {data.discoveries.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelectedArchiveId(d.id)}
                          className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs ${
                            activeArchive?.id === d.id
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <span className="font-mono font-bold">
                            {d.archiveCode} · {d.environmentFamily.slice(0, 14)}
                          </span>
                          <span className="font-mono text-[11px] text-emerald-700">
                            {d.coveragePct}% cov
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Phase-Space & Hysteresis Sweeper (Part XXXIV)
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Run a 6×6 parameter-space heatmap or forward-vs-reverse hysteresis loop.
                  </p>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <select
                      value={sweepForm.environmentFamily}
                      onChange={(e) =>
                        setSweepForm((p) => ({
                          ...p,
                          environmentFamily: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <option value="CoupledOscillatorSwarm">
                        CoupledOscillatorSwarm
                      </option>
                      <option value="ConventionEmergenceGrid">
                        ConventionEmergenceGrid
                      </option>
                      <option value="ResourceForagingCommons">
                        ResourceForagingCommons
                      </option>
                      <option value="NullStochasticBaseline">
                        NullStochasticBaseline
                      </option>
                    </select>
                    <select
                      value={sweepForm.sweepMode}
                      onChange={(e) =>
                        setSweepForm((p) => ({
                          ...p,
                          sweepMode: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <option value="2d_phase_diagram">
                        2D Phase Diagram (Coupling × Noise)
                      </option>
                      <option value="hysteresis_loop">
                        Hysteresis Loop (Forward vs Reverse)
                      </option>
                    </select>
                    <button
                      type="button"
                      onClick={handleRunSweep}
                      className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
                    >
                      Execute Parameter Sweep
                    </button>
                  </div>

                  {data.sweeps?.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
                      {data.sweeps.map((sw) => (
                        <button
                          key={sw.id}
                          type="button"
                          onClick={() => setSelectedSweepId(sw.id)}
                          className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs ${
                            activeSweep?.id === sw.id
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <span className="font-mono font-bold">
                            {sw.sweepCode} ·{" "}
                            {sw.sweepMode === "hysteresis_loop"
                              ? "Hysteresis"
                              : "2D Phase"}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {sw.environmentFamily.slice(0, 12)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Visuals */}
              <div className="space-y-4 lg:col-span-8">
                {activeArchive && (
                  <QualityDiversityGrid archive={activeArchive} />
                )}
                {activeSweep && (
                  <PhaseDiagramHeatmap
                    sweep={activeSweep}
                    colorBlindSafe={colorBlindSafe}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            5. RED-TEAM LEDGER, SWARM FAILURE AUDIT & LITERATURE GRAPH
           ================================================================ */}
        {activeTab === "redteam" && (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-12">
              {/* Claims Ledger */}
              <div className="space-y-4 lg:col-span-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Claim-Evidence Ledger ({filteredClaims.length})
                  </h3>
                  <div className="space-y-2.5">
                    {filteredClaims.map((clm) => {
                      const revs = data.reviews.filter(
                        (r) => r.claimId === clm.id
                      );
                      const critOpen = revs.filter(
                        (r) =>
                          r.severity === "critical" && r.status === "unresolved"
                      ).length;
                      return (
                        <button
                          key={clm.id}
                          type="button"
                          onClick={() => setSelectedClaimId(clm.id)}
                          className={`w-full rounded-lg border p-3 text-left transition ${
                            activeClaim?.id === clm.id
                              ? "border-blue-600 bg-blue-50/50"
                              : "border-slate-200 bg-slate-50/60 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {clm.claimCode} · {clm.claimType}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                clm.validationStatus === "validated_finding"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : clm.validationStatus ===
                                    "blocked_by_objection"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {clm.validationStatus.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-800">
                            {clm.claimText}
                          </p>
                          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
                            <span>
                              Runs: [{clm.supportingRunIds.join(", ")}]
                            </span>
                            <span
                              className={
                                critOpen > 0 ? "font-bold text-red-700" : ""
                              }
                            >
                              {revs.length} reviews ({critOpen} crit open)
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form
                  onSubmit={handleCreateClaim}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Register Candidate Claim
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={claimForm.claimType}
                        onChange={(e) =>
                          setClaimForm((p) => ({
                            ...p,
                            claimType: e.target.value,
                          }))
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <option value="Pattern">Pattern</option>
                        <option value="Anomaly">Anomaly</option>
                        <option value="CausalEffect">CausalEffect</option>
                        <option value="Mechanism">Mechanism</option>
                        <option value="Speculation">Speculation</option>
                      </select>
                      <select
                        value={claimForm.supportingRunId}
                        onChange={(e) =>
                          setClaimForm((p) => ({
                            ...p,
                            supportingRunId: Number(e.target.value),
                          }))
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1.5"
                      >
                        {data.runs.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.runCode} ({r.status})
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={claimForm.claimText}
                      onChange={(e) =>
                        setClaimForm((p) => ({ ...p, claimText: e.target.value }))
                      }
                      placeholder="Exact falsifiable scientific claim..."
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                    >
                      Submit Claim for Red-Team Review
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Claim Red-Team Reviews */}
              <div className="space-y-4 lg:col-span-7">
                {activeClaim && (() => {
                  const claimReviews = data.reviews.filter(
                    (r) => r.claimId === activeClaim.id
                  );
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                              {activeClaim.claimCode}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                              {activeClaim.claimType}
                            </span>
                            <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700">
                              {activeClaim.independenceClassification}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-slate-900">
                            {activeClaim.claimText}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleClaimTransition(
                                activeClaim,
                                "validated_finding"
                              )
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Promote to Validated Finding
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleClaimTransition(activeClaim, "falsified")
                            }
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Falsify
                          </button>
                        </div>
                      </div>

                      {activeClaim.humanOverrideApproved && (
                        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <strong>Documented Human Review Override:</strong>{" "}
                          {activeClaim.humanOverrideNote}
                        </div>
                      )}

                      <div className="mt-3 grid gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                        <div>
                          <strong>Measurement:</strong>{" "}
                          {activeClaim.uncertainty.measurement}
                        </div>
                        <div>
                          <strong>Sampling:</strong>{" "}
                          {activeClaim.uncertainty.sampling}
                        </div>
                        <div>
                          <strong>Model:</strong> {activeClaim.uncertainty.model}
                        </div>
                        <div>
                          <strong>Mechanism:</strong>{" "}
                          {activeClaim.uncertainty.mechanism}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {claimReviews.map((rev) => (
                          <div
                            key={rev.id}
                            className={`rounded-lg border p-3 text-xs ${
                              rev.severity === "critical" &&
                              rev.status === "unresolved"
                                ? "border-red-300 bg-red-50/70"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {rev.reviewerRole}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                    rev.severity === "critical"
                                      ? "bg-red-600 text-white"
                                      : rev.severity === "major"
                                      ? "bg-amber-200 text-amber-900"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {rev.severity}
                                </span>
                                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                  {rev.explanationCategory}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-mono text-[10px] font-semibold ${
                                    rev.status === "unresolved"
                                      ? "text-red-700"
                                      : "text-emerald-700"
                                  }`}
                                >
                                  {rev.status.toUpperCase()}
                                </span>
                                {rev.status === "unresolved" && (
                                  <button
                                    type="button"
                                    onClick={() => handleResolveReview(rev.id)}
                                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium hover:bg-slate-100"
                                  >
                                    Resolve
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="mt-1 text-slate-800">
                              {rev.objectionText}
                            </p>
                          </div>
                        ))}
                      </div>

                      <form
                        onSubmit={handleAddReview}
                        className="mt-3 border-t border-slate-200 pt-3 text-xs"
                      >
                        <div className="grid gap-2 sm:grid-cols-3">
                          <select
                            value={reviewForm.reviewerRole}
                            onChange={(e) =>
                              setReviewForm((p) => ({
                                ...p,
                                reviewerRole: e.target.value,
                              }))
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1.5"
                          >
                            {RED_TEAM_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <select
                            value={reviewForm.explanationCategory}
                            onChange={(e) =>
                              setReviewForm((p) => ({
                                ...p,
                                explanationCategory: e.target.value,
                              }))
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1.5"
                          >
                            {EXPLANATION_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={reviewForm.severity}
                            onChange={(e) =>
                              setReviewForm((p) => ({
                                ...p,
                                severity: e.target.value,
                              }))
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1.5"
                          >
                            <option value="critical">critical (blocks)</option>
                            <option value="major">major</option>
                            <option value="minor">minor</option>
                          </select>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            required
                            value={reviewForm.objectionText}
                            onChange={(e) =>
                              setReviewForm((p) => ({
                                ...p,
                                objectionText: e.target.value,
                              }))
                            }
                            placeholder="Document objection (bug, random variation, confounder, etc.)..."
                            className="flex-1 rounded border border-slate-200 px-2.5 py-1.5"
                          />
                          <button
                            type="submit"
                            className="rounded bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
                          >
                            File Objection
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Empirical Multi-Agent Swarm Failure-Mode Audit (Part XL) & Literature Graph (Part LXXV) */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Users className="h-4 w-4 text-blue-600" />
                      Multi-Agent Swarm Failure-Mode Audit (Part XL)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Empirical comparison: 1 agent vs isolated vs shared memory vs blind critic vs mixed-family swarm.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunSwarmAudit}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Re-Run Benchmark
                  </button>
                </div>

                {data.swarmAudits?.[0] && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
                            <th className="px-2 py-1.5">Swarm Architecture</th>
                            <th className="px-2 py-1.5 font-mono">Prec</th>
                            <th className="px-2 py-1.5 font-mono">Groupthink</th>
                            <th className="px-2 py-1.5 font-mono">Dissent</th>
                            <th className="px-2 py-1.5 font-mono">FalseCons</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.swarmAudits[0].entries.map((row) => (
                            <tr key={row.configuration}>
                              <td className="px-2 py-1.5 font-medium text-slate-800">
                                {row.configuration}
                              </td>
                              <td className="px-2 py-1.5 font-mono font-bold text-blue-700">
                                {row.discoveryPrecision}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-red-700">
                                {row.groupthinkRate}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-emerald-700">
                                {row.dissentPreservation}
                              </td>
                              <td className="px-2 py-1.5 font-mono">
                                {row.falseConsensusCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2.5 rounded bg-slate-50 p-2.5 text-[11px] text-slate-700">
                      <strong>Empirical Conclusion:</strong>{" "}
                      {data.swarmAudits[0].empiricalConclusion}
                    </p>
                  </>
                )}
              </div>

              {/* Verified Literature Source Graph (Part LXXV) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-6">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <BookOpen className="h-4 w-4 text-emerald-700" />
                  Verified Literature Evidence Network (Part LXXV)
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Strictly distinguishes open-access full-text inspection from abstract-only metadata. Never fabricates DOIs.
                </p>

                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {(data.literature ?? []).map((lit) => (
                    <div
                      key={lit.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-mono font-bold text-slate-900">
                          {lit.litCode} ({lit.year}) · {lit.relatedProgrammeCode}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            lit.inspectedFullText
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {lit.inspectedFullText
                            ? "FULL TEXT CHECKED"
                            : "ABSTRACT ONLY"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900">
                        {lit.title}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {lit.authors} — {lit.venue} · DOI:{" "}
                        <span className="font-mono">{lit.doiOrId}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-700">
                        {lit.keyClaimChecked}
                      </p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleAddLiterature}
                  className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs"
                >
                  <input
                    type="text"
                    required
                    value={litForm.title}
                    onChange={(e) =>
                      setLitForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Paper title..."
                    className="rounded border border-slate-200 px-2 py-1"
                  />
                  <input
                    type="text"
                    required
                    value={litForm.doiOrId}
                    onChange={(e) =>
                      setLitForm((p) => ({ ...p, doiOrId: e.target.value }))
                    }
                    placeholder="Verified DOI / arXiv ID..."
                    className="rounded border border-slate-200 px-2 py-1 font-mono"
                  />
                  <input
                    type="text"
                    value={litForm.keyClaimChecked}
                    onChange={(e) =>
                      setLitForm((p) => ({
                        ...p,
                        keyClaimChecked: e.target.value,
                      }))
                    }
                    placeholder="Exact claim checked..."
                    className="col-span-2 rounded border border-slate-200 px-2 py-1"
                  />
                  <select
                    value={litForm.accessStatus}
                    onChange={(e) =>
                      setLitForm((p) => ({
                        ...p,
                        accessStatus: e.target.value,
                        inspectedFullText:
                          e.target.value === "open_access_fulltext",
                      }))
                    }
                    className="rounded border border-slate-200 bg-white px-2 py-1"
                  >
                    <option value="abstract_only">abstract_only</option>
                    <option value="open_access_fulltext">
                      open_access_fulltext
                    </option>
                  </select>
                  <button
                    type="submit"
                    className="rounded bg-slate-900 py-1.5 font-semibold text-white hover:bg-slate-800"
                  >
                    Add Verified Citation
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            6. CALIBRATION, POWER & MULTI-SCALE
           ================================================================ */}
        {activeTab === "calibration" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    12-Test Known-Answer Calibration & Self-Test Suite (Part XXXII & LXVI)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tests synchronization recovery, null-world false positives, PID boundaries, replication stability, hysteresis symmetry, and swarm groupthink.{" "}
                    <strong className="text-amber-700">
                      Validates software instruments only.
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunCalibration}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Run Full 12-Test Suite
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Benchmark Test</th>
                      <th className="px-3 py-2">Injected Ground Truth</th>
                      <th className="px-3 py-2 font-mono">Sens</th>
                      <th className="px-3 py-2 font-mono">FPR</th>
                      <th className="px-3 py-2 font-mono">Prec/Rec</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.benchmarks.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-mono font-bold text-slate-800">
                          {b.testCode}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {b.testName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {b.notes}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {b.injectedGroundTruth}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {b.sensitivity.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {b.falsePositiveRate.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {b.precisionScore.toFixed(2)} /{" "}
                          {b.recallScore.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                              b.status === "PASS"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <form
                onSubmit={handleCreateDesign}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  Statistical Power & Preregistration Planner (Part XXXI)
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Flags underpowered designs (&lt;80%) so non-significance is reported as inconclusive rather than null.
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={designForm.title}
                      onChange={(e) =>
                        setDesignForm((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="Protocol title..."
                      className="rounded border border-slate-200 px-2.5 py-1.5"
                    />
                    <select
                      value={designForm.analysisMode}
                      onChange={(e) =>
                        setDesignForm((p) => ({
                          ...p,
                          analysisMode: e.target.value,
                        }))
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1.5"
                    >
                      <option value="confirmatory">confirmatory</option>
                      <option value="pilot">pilot</option>
                      <option value="exploratory">exploratory</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-slate-700">
                        SESOI (Effect)
                      </label>
                      <input
                        type="number"
                        step={0.01}
                        min={0.01}
                        value={designForm.smallestEffectInterest}
                        onChange={(e) =>
                          setDesignForm((p) => ({
                            ...p,
                            smallestEffectInterest: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-700">
                        Pilot Variance
                      </label>
                      <input
                        type="number"
                        step={0.005}
                        min={0.001}
                        value={designForm.pilotVarianceEstimate}
                        onChange={(e) =>
                          setDesignForm((p) => ({
                            ...p,
                            pilotVarianceEstimate: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-slate-700">
                        Planned N
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={200}
                        value={designForm.plannedTrials}
                        onChange={(e) =>
                          setDesignForm((p) => ({
                            ...p,
                            plannedTrials: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 font-mono"
                      />
                    </div>
                  </div>

                  <div
                    className={`rounded-lg border p-3 ${
                      livePowerPreview.underpowered
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs font-bold">
                      <span>
                        Power: {(livePowerPreview.power * 100).toFixed(1)}%
                      </span>
                      <span>Required N (80%): {livePowerPreview.reqN}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                  >
                    Lock Timestamped Preregistration
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-2.5">
                  {data.designs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-medium text-slate-900">
                        {d.title}
                      </span>
                      <span className="font-mono text-blue-700">
                        P={d.estimatedPower} | {d.preregistrationHash}
                      </span>
                    </div>
                  ))}
                </div>
              </form>

              <div className="space-y-4">
                <PowerCurveAndAlphaPanel
                  sesoi={designForm.smallestEffectInterest}
                  pilotVariance={designForm.pilotVarianceEstimate}
                  plannedTrials={designForm.plannedTrials}
                />
                {activeRun && (
                  <TrajectoryChart
                    title={`Multi-Scale Micro-Macro Divergence — ${activeRun.runCode}`}
                    primary={activeRun.trajectory}
                    primaryLabel="Micro-Macro Divergence"
                    metric="macroDivergence"
                    unit="divergence"
                    colorBlindSafe={colorBlindSafe}
                    plainExplanation="Quantifies whether collective synchronization R(t) diverges from simple additive individual activity (Part XXXIII)."
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            7. PROVENANCE, FAILURES & EXPORT
           ================================================================ */}
        {activeTab === "provenance" && (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Publication Readiness & Export Bundle (Part XLIV & LXXVI)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Artifacts generated strictly from stored PostgreSQL data. Automated checks verify seeds, versions, and open objections.
                </p>

                <div className="mt-3 space-y-2 text-xs">
                  {[
                    {
                      label: "All runs include random seeds & SHA-256 hashes",
                      ok: data.runs.every((r) => r.seed && r.configHash),
                    },
                    {
                      label: "Failed & inconclusive runs explicitly preserved",
                      ok: failedRunsCount > 0,
                    },
                    {
                      label: "Literature inspection state recorded",
                      ok: (data.literature?.length ?? 0) > 0,
                    },
                    {
                      label: `Critical red-team objections resolved (${unresolvedCriticalCount} open)`,
                      ok: unresolvedCriticalCount === 0,
                    },
                  ].map((chk, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <span className="text-slate-700">{chk.label}</span>
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          chk.ok ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {chk.ok ? "PASS" : "WARNING"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => exportResearchRelease("markdown")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => exportResearchRelease("html")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    HTML Paper
                  </button>
                  <button
                    type="button"
                    onClick={() => exportResearchRelease("notebook")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-blue-700 px-2 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    .ipynb
                  </button>
                  <button
                    type="button"
                    onClick={() => exportResearchRelease("json")}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => exportResearchRelease("csv")}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Failure & Negative Knowledge Archive (Part XLVI & XCVIII)
                </h3>
                <div className="space-y-2 text-xs">
                  {data.runs
                    .filter(
                      (r) =>
                        r.status === "failed" ||
                        r.status === "inconclusive" ||
                        !r.dataQuality.passed
                    )
                    .map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px] font-bold text-amber-900">
                          <span>
                            {r.runCode} · {r.failureCategory ?? r.status}
                          </span>
                          <span>{r.status.toUpperCase()}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-amber-900">
                          {r.failureReason ?? "Data quality check failed."}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-7">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Append-Only Cryptographic Provenance Chain (Part XXXVIII)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Every simulation, counterfactual, replication, red-team review, and human control change is hashed and logged.
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                  {data.provenance.length} events
                </span>
              </div>

              <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                {data.provenance.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {ev.eventCode}
                        </span>
                        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
                          {ev.action}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          by {ev.actor}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        sha256:{ev.contentHash} · {ev.softwareVersion}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-700">
                      {ev.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            8. ACCESSIBILITY, METHODS GLOSSARY & LIVE ACCEPTANCE MATRIX
           ================================================================ */}
        {activeTab === "methods" && (
          <div className="space-y-5">
            {/* Accessibility & Usability Preferences (Part LXXVIII) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900">
                Accessibility & Ergonomics Preferences (Part LXXVIII)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Customize chart palettes, contrast, and motion for extended research sessions.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={colorBlindSafe}
                    onChange={(e) => setColorBlindSafe(e.target.checked)}
                    className="accent-blue-600"
                  />
                  Color-Blind-Safe Okabe-Ito / Viridis Palette
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    className="accent-blue-600"
                  />
                  High-Contrast Surface Mode
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="accent-blue-600"
                  />
                  Reduced-Motion Replay Step Timing
                </label>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Plain-Language Scientific Methods Glossary (Part XLIII & LXXXIX) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Plain-Language Scientific Methods Glossary
                </h3>
                <div className="mt-3 space-y-2.5 text-xs">
                  {GLOSSARY_TERMS.map((g) => (
                    <div
                      key={g.term}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                    >
                      <div className="font-semibold text-slate-900">
                        {g.term}
                      </div>
                      <p className="mt-0.5 text-slate-600">{g.plain}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Honest Live Acceptance Matrix (Part LII & XC) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900">
                  Live OMEIL Acceptance & Integrity Matrix (Part LII & XC)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Honest audit distinguishing verified live capabilities from external-hardware / Tier-4 boundaries.
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    {
                      req: "Deterministic seeded runs & PostgreSQL persistence",
                      status: "VERIFIED",
                      ev: `${data.runs.length} runs persisted with sha256 hashes`,
                    },
                    {
                      req: "Matched-seed counterfactuals & causal DAG identification guard",
                      status: "VERIFIED",
                      ev: `${data.interventions.length} counterfactual(s) + associative guard`,
                    },
                    {
                      req: "Adversarial red-team gate blocking critical unresolved claims",
                      status: "VERIFIED",
                      ev: `Enforced via 409 state gate + documented human override`,
                    },
                    {
                      req: "12-test known-answer calibration suite (instruments only)",
                      status: calPassCount === data.benchmarks.length ? "VERIFIED" : "PARTIAL",
                      ev: `${calPassCount}/${data.benchmarks.length} PASS`,
                    },
                    {
                      req: "Open-ended MAP-Elites QD search & 2D phase/hysteresis sweeps",
                      status: "VERIFIED",
                      ev: `${data.discoveries?.length ?? 0} QD archives, ${data.sweeps?.length ?? 0} sweeps`,
                    },
                    {
                      req: "Local Tier-1 CPU execution + Human E-Stop",
                      status: "VERIFIED",
                      ev: "Resource governor & E-Stop active",
                    },
                    {
                      req: "Tier-2..4 Hosted LLM / Multi-GPU Cluster Inference",
                      status: "DEFERRED / LOCKED",
                      ev: "Locked offline by default (Part LXXIII); mathematical simulation core operational",
                    },
                  ].map((row) => (
                    <div
                      key={row.req}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {row.req}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.ev}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                          row.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Searchable Command Palette Modal (Part LXXVIII) */}
      {commandPaletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-20 backdrop-blur-xs"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0B1120] p-4 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-sky-400">
                OMEIL COMMAND PALETTE (Esc to close)
              </span>
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="font-mono text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-1.5 text-xs">
              {[
                {
                  label: "Execute 1 Autonomous Scientist Cycle",
                  action: () => executeAutonomousCycle(true),
                },
                {
                  label: "Run 12-Test Known-Answer Calibration Suite",
                  action: () => handleRunCalibration(),
                },
                {
                  label: "Jump to Simulations, 3D Phase Space & Multi-Scale",
                  action: () => setActiveTab("simulations"),
                },
                {
                  label: "Jump to Causal & Counterfactual Lab",
                  action: () => setActiveTab("counterfactuals"),
                },
                {
                  label: "Jump to QD Search & Phase Diagrams",
                  action: () => setActiveTab("discovery"),
                },
                {
                  label: "Jump to Adversarial Red-Team & Swarm Audit",
                  action: () => setActiveTab("redteam"),
                },
                {
                  label: "Export Reproducible Jupyter Notebook (.ipynb)",
                  action: () => exportResearchRelease("notebook"),
                },
                {
                  label: "Export Full JSON Reproduction Bundle",
                  action: () => exportResearchRelease("json"),
                },
              ].map((cmd) => (
                <button
                  key={cmd.label}
                  type="button"
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    cmd.action();
                  }}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-left text-slate-200 hover:border-sky-500 hover:bg-slate-800"
                >
                  <span>{cmd.label}</span>
                  <span className="font-mono text-[10px] text-sky-400">RUN →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Human Override Modal */}
      {overrideTargetClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">
              Critical Red-Team Objection Override Required
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {overrideTargetClaim.claimCode} has unresolved critical red-team objections. Document a Principal Investigator justification to override.
            </p>
            <textarea
              rows={3}
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Document scientific justification (>= 10 characters)..."
              className="mt-3 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOverrideTargetClaim(null);
                  setOverrideNote("");
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideNote.trim().length < 10}
                onClick={() =>
                  handleClaimTransition(
                    overrideTargetClaim,
                    "validated_finding",
                    true,
                    overrideNote.trim()
                  )
                }
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Record Human Override & Promote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </OmeilErrorBoundary>
  );
}
