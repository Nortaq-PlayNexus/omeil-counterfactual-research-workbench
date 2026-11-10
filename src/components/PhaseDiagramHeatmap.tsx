"use client";

import React, { useState } from "react";
import type { ParameterSweepRecord } from "@/components/types";
import type { SweepPoint } from "@/db/schema";

interface PhaseDiagramHeatmapProps {
  sweep: ParameterSweepRecord;
  colorBlindSafe?: boolean;
}

export function PhaseDiagramHeatmap({
  sweep,
  colorBlindSafe = false,
}: PhaseDiagramHeatmapProps) {
  const [selectedPoint, setSelectedPoint] = useState<SweepPoint | null>(
    sweep.gridPoints[0] ?? null
  );

  const isHysteresis = sweep.sweepMode === "hysteresis_loop";

  // Color scale for R(T) in [0, 1]
  const getCellColor = (r: number) => {
    const clamped = Math.max(0, Math.min(1, r));
    if (colorBlindSafe) {
      // Viridis-inspired blue -> teal -> gold
      if (clamped > 0.75) return "#FDE725";
      if (clamped > 0.55) return "#5EC962";
      if (clamped > 0.35) return "#21918C";
      if (clamped > 0.18) return "#3B528B";
      return "#440154";
    }
    if (clamped > 0.75) return "#059669";
    if (clamped > 0.55) return "#10B981";
    if (clamped > 0.35) return "#38BDF8";
    if (clamped > 0.18) return "#3B82F6";
    return "#1E293B";
  };

  if (isHysteresis) {
    const forward = sweep.gridPoints
      .filter((p) => p.direction === "forward")
      .sort((a, b) => a.xVal - b.xVal);
    const reverse = sweep.gridPoints
      .filter((p) => p.direction === "reverse")
      .sort((a, b) => a.xVal - b.xVal);

    const w = 520;
    const h = 230;
    const padL = 48;
    const padR = 20;
    const padT = 20;
    const padB = 34;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    const toX = (k: number) => padL + ((k - 0.05) / 1.05) * pw;
    const toY = (r: number) => padT + ph - Math.min(1, Math.max(0, r)) * ph;

    const fPath = forward
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.xVal).toFixed(1)},${toY(p.orderParameter).toFixed(1)}`)
      .join(" ");
    const rPath = reverse
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.xVal).toFixed(1)},${toY(p.orderParameter).toFixed(1)}`)
      .join(" ");

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                {sweep.sweepCode}
              </span>
              <h4 className="text-xs font-semibold text-slate-900">
                Hysteresis & Regime Persistence Loop — {sweep.environmentFamily}
              </h4>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {sweep.criticalTransitionEstimate}
            </p>
          </div>
          <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800 border border-amber-200">
            Hysteresis Gap ΔR = {sweep.hysteresisGap}
          </span>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={padL}
                y1={toY(t)}
                x2={w - padR}
                y2={toY(t)}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 6}
                y={toY(t) + 3}
                textAnchor="end"
                className="fill-slate-500 text-[9px] font-mono"
              >
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          <line x1={padL} y1={padT + ph} x2={w - padR} y2={padT + ph} stroke="#94A3B8" />
          <line x1={padL} y1={padT} x2={padL} y2={padT + ph} stroke="#94A3B8" />

          {fPath && (
            <path d={fPath} fill="none" stroke="#2563EB" strokeWidth={2.4} />
          )}
          {rPath && (
            <path
              d={rPath}
              fill="none"
              stroke="#D97706"
              strokeWidth={2.4}
              strokeDasharray="6 3"
            />
          )}

          {forward.map((pt, i) => (
            <circle
              key={`f-${i}`}
              cx={toX(pt.xVal)}
              cy={toY(pt.orderParameter)}
              r={4}
              fill="#2563EB"
              className="cursor-pointer"
              onClick={() => setSelectedPoint(pt)}
            />
          ))}
          {reverse.map((pt, i) => (
            <circle
              key={`r-${i}`}
              cx={toX(pt.xVal)}
              cy={toY(pt.orderParameter)}
              r={4}
              fill="#D97706"
              className="cursor-pointer"
              onClick={() => setSelectedPoint(pt)}
            />
          ))}

          <text x={padL + pw / 2} y={h - 8} textAnchor="middle" className="fill-slate-600 text-[9.5px] font-mono">
            Coupling Strength k (0.05 → 1.10 Forward | 1.10 → 0.05 Reverse)
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-blue-600" /> Forward Ramp (Short Memory)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-600" /> Reverse Ramp (Persistent Memory)
            </span>
          </div>
          {selectedPoint && (
            <span className="font-mono text-[10px] text-slate-700">
              Selected k={selectedPoint.xVal}: R={selectedPoint.orderParameter}, Lag1={selectedPoint.lag1Autocorr}
            </span>
          )}
        </div>
        <p className="mt-2 rounded bg-slate-50 p-2 text-[10.5px] text-slate-600">
          <strong>Method Warning:</strong> {sweep.assumptionsWarning}
        </p>
      </div>
    );
  }

  // 2D Phase Diagram Heatmap
  const xVals = Array.from(new Set(sweep.gridPoints.map((p) => p.xVal))).sort(
    (a, b) => a - b
  );
  const yVals = Array.from(new Set(sweep.gridPoints.map((p) => p.yVal))).sort(
    (a, b) => b - a
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              {sweep.sweepCode}
            </span>
            <h4 className="text-xs font-semibold text-slate-900">
              2D Parameter Phase Diagram ({sweep.xParam} × {sweep.yParam})
            </h4>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {sweep.criticalTransitionEstimate}
          </p>
        </div>
        <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] text-blue-700">
          {sweep.gridPoints.length} Runs Evaluated
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="inline-block min-w-full">
          {yVals.map((y) => (
            <div key={y} className="flex items-center gap-1 mb-1">
              <div className="w-16 shrink-0 text-right font-mono text-[10px] text-slate-500 pr-2">
                σ={y.toFixed(2)}
              </div>
              {xVals.map((x) => {
                const pt = sweep.gridPoints.find(
                  (p) => p.xVal === x && p.yVal === y
                );
                if (!pt) return null;
                const isSel =
                  selectedPoint?.xVal === x && selectedPoint?.yVal === y;
                const bg = getCellColor(pt.orderParameter);
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onClick={() => setSelectedPoint(pt)}
                    style={{ backgroundColor: bg }}
                    className={`flex h-10 flex-1 min-w-[54px] flex-col items-center justify-center rounded font-mono text-[10px] font-bold transition ${
                      pt.orderParameter > 0.65 && colorBlindSafe
                        ? "text-slate-950"
                        : "text-white"
                    } ${isSel ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                    title={`k=${x}, noise=${y} -> R=${pt.orderParameter}, H=${pt.entropyBits}b`}
                  >
                    <span>{pt.orderParameter.toFixed(2)}</span>
                    <span className="text-[8.5px] opacity-80">
                      H:{pt.entropyBits.toFixed(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            <div className="w-16 shrink-0" />
            {xVals.map((x) => (
              <div
                key={x}
                className="flex-1 min-w-[54px] text-center font-mono text-[10px] text-slate-600"
              >
                k={x.toFixed(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedPoint && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-800">
          <span>
            Cell (k={selectedPoint.xVal}, σ={selectedPoint.yVal}):
          </span>
          <span>R(T)={selectedPoint.orderParameter}</span>
          <span>Coord={selectedPoint.meanCoordination}</span>
          <span>Entropy={selectedPoint.entropyBits}b</span>
          <span>Lag1-AC={selectedPoint.lag1Autocorr}</span>
        </div>
      )}

      <p className="mt-2 text-[10.5px] text-slate-500">
        <strong>Operational Criteria Warning:</strong> {sweep.assumptionsWarning}
      </p>
    </div>
  );
}
