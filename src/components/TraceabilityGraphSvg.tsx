"use client";

import React from "react";
import type { WorkbenchSnapshot } from "@/components/types";

interface TraceabilityGraphSvgProps {
  data: WorkbenchSnapshot;
  onJumpToRun: (id: number) => void;
  onJumpToCf: (id: number) => void;
  onJumpToClaim: (id: number) => void;
}

export function TraceabilityGraphSvg({
  data,
  onJumpToRun,
  onJumpToCf,
  onJumpToClaim,
}: TraceabilityGraphSvgProps) {
  const progs = data.programmes.slice(0, 3);
  const runs = data.runs.slice(0, 5);
  const cfs = data.interventions.slice(0, 4);
  const claims = data.claims.slice(0, 4);
  const lits = (data.literature ?? []).slice(0, 3);

  const width = 920;
  const height = 270;

  // Column X positions
  const xProg = 30;
  const xRun = 235;
  const xCf = 460;
  const xClaim = 685;

  const progCoords = new Map<number, { x: number; y: number }>();
  const runCoords = new Map<number, { x: number; y: number }>();
  const cfCoords = new Map<number, { x: number; y: number }>();
  const claimCoords = new Map<number, { x: number; y: number }>();

  progs.forEach((p, i) => progCoords.set(p.id, { x: xProg, y: 42 + i * 74 }));
  runs.forEach((r, i) => runCoords.set(r.id, { x: xRun, y: 30 + i * 48 }));
  cfs.forEach((c, i) => cfCoords.set(c.id, { x: xCf, y: 38 + i * 56 }));
  claims.forEach((cl, i) =>
    claimCoords.set(cl.id, { x: xClaim, y: 38 + i * 56 })
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Interactive Scientific Traceability Graph (Part LIV & XXXVIII)
          </h3>
          <p className="text-[11px] text-slate-500">
            Click any Run, Counterfactual, or Claim node to jump directly to its raw telemetry, causal DAG, or red-team objections.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[10px]">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
            {progs.length} Programmes
          </span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">
            {runs.length} Latest Runs
          </span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
            {lits.length} Verified Lit Sources
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full rounded-lg border border-slate-100 bg-slate-50/70"
        role="img"
        aria-label="Scientific object traceability graph"
      >
        {/* Column Headers */}
        <text x={xProg + 70} y={16} textAnchor="middle" className="fill-slate-500 text-[9.5px] font-mono font-bold">
          1. PROGRAMMES
        </text>
        <text x={xRun + 75} y={16} textAnchor="middle" className="fill-slate-500 text-[9.5px] font-mono font-bold">
          2. IMMUTABLE RUNS
        </text>
        <text x={xCf + 75} y={16} textAnchor="middle" className="fill-slate-500 text-[9.5px] font-mono font-bold">
          3. COUNTERFACTUALS
        </text>
        <text x={xClaim + 95} y={16} textAnchor="middle" className="fill-slate-500 text-[9.5px] font-mono font-bold">
          4. CLAIMS & RED-TEAM GATE
        </text>

        {/* Edges: Prog -> Run */}
        {runs.map((r) => {
          const p = progCoords.get(r.programmeId);
          const rc = runCoords.get(r.id);
          if (!p || !rc) return null;
          return (
            <path
              key={`pr-${r.id}`}
              d={`M${p.x + 140},${p.y + 22} C${p.x + 185},${p.y + 22} ${
                rc.x - 45
              },${rc.y + 18} ${rc.x},${rc.y + 18}`}
              fill="none"
              stroke="#CBD5E1"
              strokeWidth={1.4}
            />
          );
        })}

        {/* Edges: Run -> Counterfactual */}
        {cfs.map((cf) => {
          const rc = runCoords.get(cf.parentRunId);
          const cc = cfCoords.get(cf.id);
          if (!rc || !cc) return null;
          return (
            <path
              key={`rc-${cf.id}`}
              d={`M${rc.x + 150},${rc.y + 18} C${rc.x + 185},${rc.y + 18} ${
                cc.x - 35
              },${cc.y + 19} ${cc.x},${cc.y + 19}`}
              fill="none"
              stroke="#60A5FA"
              strokeWidth={1.6}
            />
          );
        })}

        {/* Edges: Run -> Claim */}
        {claims.map((cl) =>
          cl.supportingRunIds.map((rid) => {
            const rc = runCoords.get(rid);
            const clc = claimCoords.get(cl.id);
            if (!rc || !clc) return null;
            return (
              <path
                key={`rcl-${rid}-${cl.id}`}
                d={`M${rc.x + 150},${rc.y + 18} C${xCf + 75},${rc.y + 18} ${
                  clc.x - 50
                },${clc.y + 19} ${clc.x},${clc.y + 19}`}
                fill="none"
                stroke={
                  cl.validationStatus === "validated_finding"
                    ? "#10B981"
                    : cl.validationStatus === "blocked_by_objection"
                    ? "#EF4444"
                    : "#F59E0B"
                }
                strokeWidth={1.5}
                strokeDasharray={
                  cl.validationStatus === "blocked_by_objection"
                    ? "4 3"
                    : undefined
                }
              />
            );
          })
        )}

        {/* Programme Nodes */}
        {progs.map((p) => {
          const pos = progCoords.get(p.id)!;
          return (
            <g key={p.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={140}
                height={44}
                rx={7}
                fill="#0F172A"
                stroke="#334155"
              />
              <text x={10} y={17} className="fill-sky-300 text-[9.5px] font-mono font-bold">
                {p.code}
              </text>
              <text x={10} y={32} className="fill-slate-200 text-[9.5px]">
                {p.title.length > 21 ? p.title.slice(0, 20) + "…" : p.title}
              </text>
            </g>
          );
        })}

        {/* Run Nodes */}
        {runs.map((r) => {
          const pos = runCoords.get(r.id)!;
          const stColor =
            r.status === "completed"
              ? "#059669"
              : r.status === "inconclusive"
              ? "#D97706"
              : "#DC2626";
          return (
            <g
              key={r.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onJumpToRun(r.id)}
            >
              <rect
                width={150}
                height={36}
                rx={7}
                fill="#FFFFFF"
                stroke={stColor}
                strokeWidth={1.5}
              />
              <text x={9} y={14} className="fill-slate-900 text-[9.5px] font-mono font-bold">
                {r.runCode} · R={r.finalOrderParameter}
              </text>
              <text x={9} y={27} className="fill-slate-500 text-[8.5px]">
                {r.environmentFamily.slice(0, 22)}
              </text>
            </g>
          );
        })}

        {/* Counterfactual Nodes */}
        {cfs.map((cf) => {
          const pos = cfCoords.get(cf.id)!;
          const identified =
            cf.identificationStatus === "identified_matched_counterfactual";
          return (
            <g
              key={cf.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onJumpToCf(cf.id)}
            >
              <rect
                width={150}
                height={38}
                rx={7}
                fill="#EFF6FF"
                stroke={identified ? "#2563EB" : "#D97706"}
                strokeWidth={1.5}
              />
              <text x={9} y={15} className="fill-blue-900 text-[9.5px] font-mono font-bold">
                {cf.code} · d={cf.effectSizeD}
              </text>
              <text x={9} y={28} className="fill-blue-700 text-[8.5px]">
                {cf.interventionType}
              </text>
            </g>
          );
        })}

        {/* Claim Nodes */}
        {claims.map((cl) => {
          const pos = claimCoords.get(cl.id)!;
          const isValid = cl.validationStatus === "validated_finding";
          const isBlocked = cl.validationStatus === "blocked_by_objection";
          return (
            <g
              key={cl.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onJumpToClaim(cl.id)}
            >
              <rect
                width={195}
                height={38}
                rx={7}
                fill={
                  isValid ? "#ECFDF5" : isBlocked ? "#FEF2F2" : "#FFFBEB"
                }
                stroke={
                  isValid ? "#059669" : isBlocked ? "#DC2626" : "#D97706"
                }
                strokeWidth={1.5}
              />
              <text
                x={9}
                y={15}
                className="text-[9.5px] font-mono font-bold"
                fill={isValid ? "#065F46" : isBlocked ? "#991B1B" : "#92400E"}
              >
                {cl.claimCode} · {cl.validationStatus}
              </text>
              <text x={9} y={28} className="fill-slate-700 text-[8.5px]">
                {cl.claimText.slice(0, 31)}…
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
