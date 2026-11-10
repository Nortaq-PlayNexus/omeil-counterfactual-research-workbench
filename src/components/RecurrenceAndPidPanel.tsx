"use client";

import React, { useMemo } from "react";
import type { TrajectoryPoint } from "@/db/schema";
import type { DiscoveryArchive } from "@/components/types";
import {
  computePartialInformationDecomposition,
  computeRecurrenceMatrix,
} from "@/lib/omeil-engine";

interface RecurrencePanelProps {
  runCode: string;
  trajectory: TrajectoryPoint[];
}

export function RecurrenceAndPidPanel({
  runCode,
  trajectory,
}: RecurrencePanelProps) {
  const rec = useMemo(
    () => computeRecurrenceMatrix(trajectory, 0.14),
    [trajectory]
  );

  const pid = useMemo(() => {
    const order = trajectory.map((t) => t.orderParameter);
    const coord = trajectory.map((t) => t.meanCoordination);
    const ent = trajectory.map((t) => t.entropyBits);
    return computePartialInformationDecomposition(order, coord, ent);
  }, [trajectory]);

  const totalPid = Math.max(
    0.0001,
    pid.redundancyBits +
      pid.uniqueSource1Bits +
      pid.uniqueSource2Bits +
      pid.synergyBits
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Dynamical Recurrence Plot */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-900">
              Phase-Space Recurrence Matrix — {runCode}
            </h4>
            <p className="text-[11px] text-slate-500">
              Dark cells indicate states returning within ε=0.14 in (R, H) space.
            </p>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
            RR={rec.recurrenceRate} | DET={rec.determinismEstimate}
          </span>
        </div>

        <div className="flex justify-center">
          <svg
            viewBox={`0 0 ${rec.size * 10} ${rec.size * 10}`}
            className="h-44 w-44 rounded border border-slate-200 bg-slate-50"
            role="img"
            aria-label="Dynamical systems recurrence plot"
          >
            {rec.matrix.map((row, i) =>
              row.map((val, j) =>
                val === 1 ? (
                  <rect
                    key={`${i}-${j}`}
                    x={j * 10}
                    y={(rec.size - 1 - i) * 10}
                    width={9.5}
                    height={9.5}
                    fill={i === j ? "#2563EB" : "#0F172A"}
                  />
                ) : null
              )
            )}
          </svg>
        </div>
        <div className="mt-2 text-[10.5px] text-slate-500">
          Diagonal lines parallel to main diagonal measure deterministic recurrence predictability (DET={rec.determinismEstimate}); not equivalent to chaos proof.
        </div>
      </div>

      {/* Partial Information Decomposition (Part XXXV) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-900">
              Partial Information Decomposition (PID) — {runCode}
            </h4>
            <p className="text-[11px] text-slate-500">
              Decomposes joint information about Entropy H(t) from Order R(t) & Coord(t).
            </p>
          </div>
          <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] text-blue-700">
            Joint MI: {pid.jointMiBits}b
          </span>
        </div>

        <div className="mt-3 space-y-2.5 text-xs">
          {[
            {
              label: "Redundancy (Shared by both)",
              val: pid.redundancyBits,
              color: "bg-blue-600",
            },
            {
              label: "Unique to Order R(t)",
              val: pid.uniqueSource1Bits,
              color: "bg-emerald-600",
            },
            {
              label: "Unique to Coordination",
              val: pid.uniqueSource2Bits,
              color: "bg-amber-500",
            },
            {
              label: "Synergy (Collective-only)",
              val: pid.synergyBits,
              color: "bg-violet-600",
            },
          ].map((item) => (
            <div key={item.label}>
              <div className="mb-0.5 flex justify-between text-[11px]">
                <span className="text-slate-700">{item.label}</span>
                <span className="font-mono font-semibold text-slate-900">
                  {item.val.toFixed(4)} bits
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${item.color}`}
                  style={{
                    width: `${Math.min(100, (item.val / totalPid) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded bg-amber-50 px-2.5 py-1.5 text-[10.5px] text-amber-900">
          <strong>Epistemic Caution:</strong> {pid.interpretationWarning}
        </p>
      </div>
    </div>
  );
}

export function QualityDiversityGrid({
  archive,
}: {
  archive: DiscoveryArchive;
}) {
  const rows = [4, 3, 2, 1, 0];
  const cols = [0, 1, 2, 3, 4];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {archive.archiveCode}
            </span>
            <h4 className="text-xs font-semibold text-slate-900">
              MAP-Elites Behavioral Repertoire — {archive.environmentFamily}
            </h4>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {archive.searchObjective}
          </p>
        </div>
        <div className="flex gap-2 font-mono text-[10px]">
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 border border-emerald-200">
            Coverage: {archive.coveragePct}%
          </span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-800 border border-blue-200">
            QD-Score: {archive.qdScore}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
            Evals: {archive.totalEvaluations}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {rows.map((r) => (
          <div key={r} className="flex items-center gap-1">
            <div className="w-20 shrink-0 pr-2 text-right font-mono text-[9.5px] text-slate-500">
              H:{(r * 0.6).toFixed(1)}-{((r + 1) * 0.6).toFixed(1)}b
            </div>
            {cols.map((c) => {
              const cell = archive.cells.find(
                (x) => x.row === r && x.col === c
              );
              if (!cell || !cell.populated) {
                return (
                  <div
                    key={`${r}-${c}`}
                    className="flex h-14 flex-1 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 font-mono text-[9px] text-slate-400"
                  >
                    Empty
                  </div>
                );
              }
              return (
                <div
                  key={`${r}-${c}`}
                  className="flex h-14 flex-1 flex-col justify-between rounded border border-blue-200 bg-gradient-to-br from-slate-900 to-blue-900 p-1.5 text-white"
                  title={`${cell.label} | Memory: ${cell.memoryPolicy} | k=${cell.couplingStrength} | noise=${cell.commNoise} | seed=${cell.seed}`}
                >
                  <div className="flex items-center justify-between font-mono text-[9px]">
                    <span className="text-sky-300">
                      C:{cell.fitnessCoord.toFixed(2)}
                    </span>
                    <span className="text-amber-300">
                      S:{cell.surpriseScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="truncate text-[9px] font-medium text-slate-200">
                    {cell.memoryPolicy.replace("_", " ")}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-1 pt-1">
          <div className="w-20 shrink-0" />
          {cols.map((c) => (
            <div
              key={c}
              className="flex-1 text-center font-mono text-[9.5px] text-slate-600"
            >
              R:{(c * 0.2).toFixed(1)}-{((c + 1) * 0.2).toFixed(1)}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2.5 rounded bg-slate-50 p-2 text-[10.5px] text-slate-600">
        <strong>Blind Spots & Rarity Caution (Part LVII):</strong> {archive.blindSpots}
      </p>
    </div>
  );
}
