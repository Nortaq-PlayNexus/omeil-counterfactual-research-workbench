"use client";

import React, { useMemo, useState } from "react";
import type { AgentSnapshot } from "@/db/schema";
import type { WorkbenchSnapshot } from "@/components/types";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

// 1. Crash-Proof React ErrorBoundary
export class OmeilErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message ?? "Unexpected UI error" };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#070D19] p-6 text-slate-100">
          <div className="max-w-lg rounded-2xl border border-red-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-sm font-bold">
                OMEIL Recovered From a UI Render Exception
              </h2>
            </div>
            <p className="mt-2 font-mono text-xs text-slate-300">
              {this.state.message}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              All PostgreSQL research records and provenance hashes remain safe.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recover Workbench
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 2. 8-Stage Autonomous Scientific Curriculum Stepper
const CURRICULUM_STAGES = [
  { phase: 0, action: "simulation", short: "1. Simulate", desc: "Bounded Trial / Null" },
  { phase: 1, action: "counterfactual", short: "2. Counterfactual", desc: "Matched-Seed DAG" },
  { phase: 2, action: "replication", short: "3. Replicate", desc: "Independent Seed" },
  { phase: 3, action: "qd_search", short: "4. QD / Phase", desc: "Repertoire & Sweep" },
  { phase: 4, action: "claim_and_redteam", short: "5. Claim + Critic", desc: "Blind Red-Team" },
  { phase: 5, action: "preregistration", short: "6. Preregister", desc: "Power & Alpha Plan" },
  { phase: 6, action: "calibration", short: "7. Calibrate", desc: "12-Test Self-Check" },
  { phase: 7, action: "swarm_audit", short: "8. Swarm Audit", desc: "Groupthink Guard" },
];

export function AutonomousPipelineStepper({
  cycleCount,
  isAutonomous,
  lastActionType,
}: {
  cycleCount: number;
  isAutonomous: boolean;
  lastActionType?: string;
}) {
  const nextPhase = cycleCount % 8;

  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
      {CURRICULUM_STAGES.map((st) => {
        const isNext = isAutonomous && st.phase === nextPhase;
        const isLast =
          lastActionType === st.action ||
          (st.phase === 3 && lastActionType === "phase_sweep") ||
          (st.phase === 7 && lastActionType === "redteam_audit");

        return (
          <div
            key={st.phase}
            className={`rounded-lg border px-2.5 py-1.5 text-[10.5px] transition ${
              isNext
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-400/50"
                : isLast
                ? "border-sky-400 bg-sky-50 text-sky-950"
                : "border-slate-200 bg-white/80 text-slate-600"
            }`}
          >
            <div className="flex items-center justify-between font-mono font-bold">
              <span>{st.short}</span>
              {isNext && (
                <span className="rounded bg-emerald-600 px-1 py-0.2 text-[8.5px] text-white">
                  NEXT
                </span>
              )}
              {!isNext && isLast && (
                <span className="rounded bg-sky-600 px-1 py-0.2 text-[8.5px] text-white">
                  DONE
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[9.5px] opacity-80">{st.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

// 3. Interactive Agent Interaction Network Topology Graph
export function AgentNetworkTopologySvg({
  runCode,
  agents,
  commEnabled,
  selectedAgentId,
  onSelectAgent,
}: {
  runCode: string;
  agents: AgentSnapshot[];
  commEnabled: boolean;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const width = 460;
  const height = 270;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 94;

  const nodes = useMemo(() => {
    const n = Math.max(1, agents.length);
    return agents.map((a, idx) => {
      const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
      return {
        agent: a,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
  }, [agents]);

  const roleColors: Record<string, string> = {
    explorer: "#38BDF8",
    coordinator: "#10B981",
    validator: "#F472B6",
    aggregator: "#F59E0B",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-slate-900">
            Interaction Network Topology — {runCode}
          </h4>
          <p className="text-[11px] text-slate-500">
            Edges connect active agents sharing behavioral cluster &amp; peer signal polarity.
          </p>
        </div>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
            commEnabled
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {commEnabled ? "CHANNEL ACTIVE" : "CHANNEL SEVERED"}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full rounded-lg border border-slate-800 bg-[#070D19]"
        role="img"
        aria-label="Agent interaction network graph"
      >
        {/* Edges */}
        {commEnabled &&
          nodes.map((na, i) => {
            if (!na.agent.active) return null;
            return nodes.slice(i + 1).map((nb) => {
              if (!nb.agent.active) return null;
              const sameCluster = na.agent.clusterId === nb.agent.clusterId;
              const sim = 1 - Math.abs(na.agent.signal - nb.agent.signal) / 2;
              if (!sameCluster && sim < 0.85) return null;
              return (
                <line
                  key={`${na.agent.id}-${nb.agent.id}`}
                  x1={na.x}
                  y1={na.y}
                  x2={nb.x}
                  y2={nb.y}
                  stroke={sameCluster ? "#38BDF8" : "#64748B"}
                  strokeWidth={sameCluster ? 1.2 : 0.6}
                  strokeOpacity={sameCluster ? 0.35 : 0.2}
                />
              );
            });
          })}

        {/* Nodes */}
        {nodes.map(({ agent, x, y }) => {
          const isSel = selectedAgentId === agent.id;
          const fill = !agent.active
            ? "#EF4444"
            : roleColors[agent.role] ?? "#38BDF8";
          return (
            <g
              key={agent.id}
              className="cursor-pointer"
              onClick={() => onSelectAgent(agent.id)}
            >
              {isSel && (
                <circle
                  cx={x}
                  cy={y}
                  r={12}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={1.6}
                  strokeDasharray="3 2"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={7.5}
                fill={fill}
                fillOpacity={agent.active ? 0.92 : 0.3}
                stroke={agent.active ? "#F8FAFC" : "#EF4444"}
                strokeWidth={1.2}
              >
                <title>
                  {agent.id} ({agent.role}) | cluster=C{agent.clusterId} | sig=
                  {agent.signal}
                </title>
              </circle>
              <text
                x={x}
                y={y + 2.6}
                textAnchor="middle"
                className="fill-slate-950 text-[6.5px] font-mono font-bold pointer-events-none"
              >
                {agent.id.replace("A-", "")}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
        {Object.entries(roleColors).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}

// 4. Zero-Hallucination Deterministic Evidence Query Assistant
export function EvidenceQueryAssistant({
  data,
  onNavigateRun,
  onNavigateClaim,
  onNavigateCf,
}: {
  data: WorkbenchSnapshot;
  onNavigateRun: (id: number) => void;
  onNavigateClaim: (id: number) => void;
  onNavigateCf: (id: number) => void;
}) {
  const [query, setQuery] = useState("What is the strongest counterfactual effect?");

  const answer = useMemo(() => {
    const q = query.toLowerCase();

    if (q.includes("block") || q.includes("objection") || q.includes("red")) {
      const blocked = data.claims.filter(
        (c) => c.validationStatus === "blocked_by_objection"
      );
      const openCrit = data.reviews.filter(
        (r) => r.severity === "critical" && r.status === "unresolved"
      );
      return {
        headline: `${blocked.length} claim(s) currently blocked by ${openCrit.length} critical unresolved objection(s).`,
        bullets: blocked.map((c) => ({
          label: `${c.claimCode}: ${c.claimText.slice(0, 95)}…`,
          onClick: () => onNavigateClaim(c.id),
        })),
      };
    }

    if (q.includes("fail") || q.includes("inconclusive") || q.includes("negative")) {
      const bad = data.runs.filter(
        (r) => r.status === "failed" || r.status === "inconclusive"
      );
      return {
        headline: `${bad.length} preserved failed/inconclusive run(s) stored in the Negative Knowledge Archive.`,
        bullets: bad.slice(0, 5).map((r) => ({
          label: `${r.runCode} [${r.status.toUpperCase()}]: ${r.failureReason ?? r.title}`,
          onClick: () => onNavigateRun(r.id),
        })),
      };
    }

    if (q.includes("next") || q.includes("triage") || q.includes("recommend")) {
      const blockedCount = data.claims.filter(
        (c) => c.validationStatus === "blocked_by_objection"
      ).length;
      const nullRuns = data.runs.filter(
        (r) => r.environmentFamily === "NullStochasticBaseline"
      ).length;
      return {
        headline: "Recommended next scientific actions computed from current database gaps:",
        bullets: [
          {
            label: `1. Resolve ${blockedCount} blocked claim(s) via multi-seed Monte Carlo power replication.`,
            onClick: () =>
              data.claims[0] ? onNavigateClaim(data.claims[0].id) : undefined,
          },
          {
            label: `2. Null-World coverage currently has ${nullRuns} control run(s) — expand null controls to keep FPR < 5%.`,
            onClick: () =>
              data.runs[0] ? onNavigateRun(data.runs[0].id) : undefined,
          },
        ],
      };
    }

    // Default: Strongest Counterfactual Effects
    const sorted = [...data.interventions].sort(
      (a, b) => Math.abs(b.effectSizeD) - Math.abs(a.effectSizeD)
    );
    return {
      headline: `Strongest measured causal effects across ${sorted.length} counterfactual experiment(s):`,
      bullets: sorted.slice(0, 4).map((cf) => ({
        label: `${cf.code} (${cf.interventionType}): d=${cf.effectSizeD}, ΔCoord=${cf.deltaCoordination} [${cf.identificationStatus}]`,
        onClick: () => onNavigateCf(cf.id),
      })),
    };
  }, [query, data, onNavigateCf, onNavigateClaim, onNavigateRun]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-800">
          <Sparkles className="h-3.5 w-3.5 text-sky-600" />
          Deterministic Evidence Query Assistant (PostgreSQL-Grounded)
        </h3>
        <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[9.5px] font-bold text-emerald-700">
          ZERO FABRICATION
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {[
          "What is the strongest counterfactual effect?",
          "Which claims are blocked?",
          "Show failed or inconclusive runs",
          "What should we run next?",
        ].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setQuery(preset)}
            className={`rounded-full border px-2.5 py-1 text-[10.5px] transition ${
              query === preset
                ? "border-sky-600 bg-sky-50 font-semibold text-sky-800"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask about stored runs, blocked claims, counterfactuals, or next triage..."
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
      />

      <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="font-semibold text-slate-900">{answer.headline}</div>
        <div className="mt-1.5 space-y-1">
          {answer.bullets.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={b.onClick}
              className="block w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] text-blue-800 hover:border-blue-400 hover:bg-blue-50/50"
            >
              {b.label} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
