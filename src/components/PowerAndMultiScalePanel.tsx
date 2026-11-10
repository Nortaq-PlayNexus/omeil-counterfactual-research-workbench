"use client";

import React, { useMemo } from "react";
import type { ExperimentRun } from "@/components/types";
import {
  computeAgentIndependenceAudit,
  computeMultiScaleAnalysis,
  computePowerCurve,
  computeSequentialAlphaBoundaries,
  detectChangePointsAndMotifs,
} from "@/lib/omeil-engine";

export function PowerCurveAndAlphaPanel({
  sesoi,
  pilotVariance,
  plannedTrials,
}: {
  sesoi: number;
  pilotVariance: number;
  plannedTrials: number;
}) {
  const curve = useMemo(
    () => computePowerCurve(sesoi, pilotVariance, 0.05),
    [sesoi, pilotVariance]
  );
  const alphaTable = useMemo(() => computeSequentialAlphaBoundaries(4, 0.05), []);

  const w = 460;
  const h = 165;
  const padL = 42;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  const toX = (n: number) => padL + ((n - 4) / (96 - 4)) * pw;
  const toY = (p: number) => padT + ph - Math.min(1, Math.max(0, p)) * ph;

  const path = curve
    .map((pt, i) => `${i === 0 ? "M" : "L"}${toX(pt.n).toFixed(1)},${toY(pt.power).toFixed(1)}`)
    .join(" ");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-900">
            Statistical Power Curve (SESOI={sesoi}, σ²={pilotVariance})
          </h4>
          <span className="font-mono text-[10px] text-slate-500">
            80% Target Dashed
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
          {[0.2, 0.5, 0.8, 1.0].map((v) => (
            <g key={v}>
              <line
                x1={padL}
                y1={toY(v)}
                x2={w - padR}
                y2={toY(v)}
                stroke={v === 0.8 ? "#059669" : "#E2E8F0"}
                strokeDasharray={v === 0.8 ? "5 3" : "2 2"}
              />
              <text
                x={padL - 5}
                y={toY(v) + 3}
                textAnchor="end"
                className="fill-slate-500 text-[8.5px] font-mono"
              >
                {(v * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke="#2563EB" strokeWidth={2.2} />
          {curve.map((pt) => (
            <circle
              key={pt.n}
              cx={toX(pt.n)}
              cy={toY(pt.power)}
              r={3}
              fill="#2563EB"
            >
              <title>N={pt.n} -&gt; Power={(pt.power * 100).toFixed(1)}%</title>
            </circle>
          ))}
          {plannedTrials >= 4 && plannedTrials <= 96 && (
            <line
              x1={toX(plannedTrials)}
              y1={padT}
              x2={toX(plannedTrials)}
              y2={padT + ph}
              stroke="#D97706"
              strokeWidth={1.6}
            />
          )}
          <text x={padL + pw / 2} y={h - 6} textAnchor="middle" className="fill-slate-500 text-[8.5px] font-mono">
            Sample Size N per Group (Orange Line = Planned N={plannedTrials})
          </text>
        </svg>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <h4 className="text-xs font-semibold text-slate-900">
          O&apos;Brien-Fleming Sequential Alpha-Spending Guard (Part XXXI)
        </h4>
        <p className="mb-2 text-[11px] text-slate-500">
          Prevents naive p-hacking when inspecting sequential trials early.
        </p>
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-500">
              <th className="px-2 py-1">Look</th>
              <th className="px-2 py-1">Info %</th>
              <th className="px-2 py-1">|Z| Cutoff</th>
              <th className="px-2 py-1">α Spent</th>
              <th className="px-2 py-1">Rule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alphaTable.map((row) => (
              <tr key={row.look}>
                <td className="px-2 py-1 font-mono font-bold">#{row.look}</td>
                <td className="px-2 py-1 font-mono">
                  {(row.infoFraction * 100).toFixed(0)}%
                </td>
                <td className="px-2 py-1 font-mono text-blue-700 font-semibold">
                  {row.obfZBoundary}
                </td>
                <td className="px-2 py-1 font-mono">{row.obfAlphaSpent}</td>
                <td className="px-2 py-1 text-slate-600">{row.naiveWarning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MultiScaleAndIndependencePanel({
  run,
}: {
  run: ExperimentRun;
}) {
  const multiScale = useMemo(
    () => computeMultiScaleAnalysis(run.finalAgents, run.trajectory),
    [run.finalAgents, run.trajectory]
  );

  const temporal = useMemo(
    () => detectChangePointsAndMotifs(run.trajectory),
    [run.trajectory]
  );

  const independence = useMemo(
    () =>
      computeAgentIndependenceAudit(
        run.memoryPolicy,
        run.modelHeterogeneity,
        run.commChannelEnabled,
        run.seed
      ),
    [
      run.memoryPolicy,
      run.modelHeterogeneity,
      run.commChannelEnabled,
      run.seed,
    ]
  );

  return (
    <div className="space-y-4">
      {/* Multi-Scale Cross-Level Emergence Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-900">
              Multi-Scale Cross-Level Emergence Analysis — {run.runCode} (Part XXXIII)
            </h4>
            <p className="text-[11px] text-slate-500">
              Compares individual dispersion, dyadic alignment, subgroup concentration, and macro population order.
            </p>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
            Short R={multiScale.shortHorizonR} → Long R={multiScale.longHorizonR} (
            {multiScale.temporalDrift >= 0 ? "+" : ""}
            {multiScale.temporalDrift})
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {multiScale.levels.map((lvl) => (
            <div
              key={lvl.level}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
            >
              <div className="font-semibold text-slate-900">{lvl.level}</div>
              <div className="text-[10.5px] text-slate-500">{lvl.metricName}</div>
              <div className="mt-1 font-mono text-base font-bold text-blue-700">
                {lvl.value}
                <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                  ±{lvl.dispersion}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                {lvl.uncertaintyNote}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-2.5 rounded bg-blue-50/70 px-3 py-2 text-[11px] text-blue-950">
          <strong>Cross-Level Synthesis:</strong> {multiScale.crossLevelConclusion}
        </p>
      </div>

      {/* Temporal Change-Points + Agent Independence Audit */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-900">
              Temporal Change-Points (CUSUM) & Motifs (Part LX)
            </h4>
            <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-800">
              {temporal.dominantMotif}
            </span>
          </div>
          {temporal.changePoints.length === 0 ? (
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              No CUSUM structural change-points exceeding Δ&gt;0.85 detected in {run.runCode}.
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              {temporal.changePoints.map((cp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px]"
                >
                  <span className="font-bold text-slate-900">
                    Step t={cp.step}
                  </span>
                  <span
                    className={
                      cp.direction === "up"
                        ? "text-emerald-700"
                        : "text-red-700"
                    }
                  >
                    {cp.direction === "up" ? "▲ UPWARD SHIFT" : "▼ DOWNWARD SHIFT"}
                  </span>
                  <span className="text-slate-600">
                    CUSUM={cp.cusumMagnitude}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-slate-600">
            {Object.entries(temporal.motifCounts).map(([k, v]) => (
              <span key={k} className="rounded bg-slate-100 px-2 py-0.5">
                {k}: {v}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-900">
              Model & Agent Independence Audit (Part XXXVII & LXIV)
            </h4>
            <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800 border border-amber-200">
              {independence.overallLabel}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            {independence.dimensions.map((d) => (
              <div
                key={d.dimension}
                className="rounded border border-slate-100 bg-slate-50 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {d.dimension}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${
                      d.classification === "demonstrably_independent"
                        ? "bg-emerald-100 text-emerald-800"
                        : d.classification === "partially_independent"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {d.classification}
                  </span>
                </div>
                <p className="mt-0.5 text-[10.5px] text-slate-600">
                  {d.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
