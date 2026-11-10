"use client";

import React, { useMemo, useRef, useState } from "react";
import type { TrajectoryPoint } from "@/db/schema";

interface TrajectoryChartProps {
  title: string;
  primary: TrajectoryPoint[];
  primaryLabel: string;
  comparison?: TrajectoryPoint[];
  comparisonLabel?: string;
  metric:
    | "orderParameter"
    | "meanCoordination"
    | "entropyBits"
    | "transferEntropyBits"
    | "lag1Autocorr"
    | "macroDivergence";
  unit: string;
  yMax?: number;
  yMin?: number;
  currentStep?: number;
  plainExplanation?: string;
  colorBlindSafe?: boolean;
}

export function TrajectoryChart({
  title,
  primary,
  primaryLabel,
  comparison,
  comparisonLabel,
  metric,
  unit,
  yMax,
  yMin = 0,
  currentStep,
  plainExplanation,
  colorBlindSafe = false,
}: TrajectoryChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverStep, setHoverStep] = useState<number | null>(null);

  const width = 560;
  const height = 225;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allVals = [
    ...primary.map((p) => Number(p[metric])),
    ...(comparison ?? []).map((p) => Number(p[metric])),
  ].filter((v) => Number.isFinite(v));

  const computedMax =
    yMax ?? Math.max(1, ...(allVals.length > 0 ? allVals : [1]));
  const computedMin = yMin;
  const maxStep = Math.max(
    1,
    ...primary.map((p) => p.step),
    ...(comparison ?? []).map((p) => p.step)
  );

  const toX = (step: number) =>
    padL + ((step - 1) / Math.max(1, maxStep - 1)) * plotW;
  const toY = (val: number) => {
    const ratio =
      (val - computedMin) / Math.max(1e-6, computedMax - computedMin);
    return padT + plotH - Math.min(1, Math.max(0, ratio)) * plotH;
  };

  const buildPath = (pts: TrajectoryPoint[]) => {
    if (pts.length === 0) return "";
    return pts
      .map((pt, i) => {
        const x = toX(pt.step).toFixed(1);
        const y = toY(Number(pt[metric])).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  // Rolling +/- 1 SD uncertainty envelope around primary series
  const uncertaintyBandPath = useMemo(() => {
    if (primary.length < 3) return "";
    const upper: string[] = [];
    const lower: string[] = [];

    for (let i = 0; i < primary.length; i++) {
      const win = primary.slice(Math.max(0, i - 3), i + 1);
      const vals = win.map((w) => Number(w[metric]));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(
        vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length)
      );
      const x = toX(primary[i].step).toFixed(1);
      const val = Number(primary[i][metric]);
      upper.push(`${i === 0 ? "M" : "L"}${x},${toY(val + sd).toFixed(1)}`);
      lower.unshift(`L${x},${toY(val - sd).toFixed(1)}`);
    }

    return `${upper.join(" ")} ${lower.join(" ")} Z`;
  }, [primary, metric, computedMax, computedMin, maxStep]);

  const primaryPath = buildPath(primary);
  const compPath = comparison ? buildPath(comparison) : "";
  const anomalyPoints = primary.filter((p) => p.anomalyScore > 2.8);

  const primaryColor = colorBlindSafe ? "#0072B2" : "#2563EB";
  const compColor = colorBlindSafe ? "#D55E00" : "#DC2626";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    val: computedMin + t * (computedMax - computedMin),
    y: padT + plotH * (1 - t),
  }));

  const hoveredPoint =
    hoverStep !== null
      ? primary.find((p) => p.step === hoverStep) ?? null
      : null;
  const hoveredCompPoint =
    hoverStep !== null && comparison
      ? comparison.find((p) => p.step === hoverStep) ?? null
      : null;

  const exportSvg = () => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omeil-chart-${metric}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold tracking-tight text-slate-900">
            {title}
          </h4>
          {plainExplanation && (
            <p className="text-[11px] text-slate-500">{plainExplanation}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
            n={primary.length} | {unit}
          </span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
            SIMULATED
          </span>
          <button
            type="button"
            onClick={exportSvg}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-600 hover:bg-slate-50"
            title="Export chart SVG"
          >
            SVG
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full select-none"
        role="img"
        aria-label={title}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const ratio = Math.max(0, Math.min(1, (relX - padL) / plotW));
          const approxStep = Math.round(1 + ratio * Math.max(1, maxStep - 1));
          setHoverStep(approxStep);
        }}
        onMouseLeave={() => setHoverStep(null)}
      >
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={padL}
              y1={tick.y}
              x2={width - padR}
              y2={tick.y}
              stroke="#E2E8F0"
              strokeDasharray="3 3"
            />
            <text
              x={padL - 6}
              y={tick.y + 3}
              textAnchor="end"
              className="fill-slate-500 text-[9px] font-mono"
            >
              {tick.val.toFixed(2)}
            </text>
          </g>
        ))}

        <line
          x1={padL}
          y1={padT + plotH}
          x2={width - padR}
          y2={padT + plotH}
          stroke="#94A3B8"
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="#94A3B8"
        />

        {/* Uncertainty Envelope (+/- 1 rolling SD) */}
        {uncertaintyBandPath && (
          <path d={uncertaintyBandPath} fill={primaryColor} fillOpacity={0.12} />
        )}

        {compPath && (
          <path
            d={compPath}
            fill="none"
            stroke={compColor}
            strokeWidth={2}
            strokeDasharray="5 3"
          />
        )}

        {primaryPath && (
          <path
            d={primaryPath}
            fill="none"
            stroke={primaryColor}
            strokeWidth={2.2}
          />
        )}

        {anomalyPoints.map((pt) => (
          <circle
            key={pt.step}
            cx={toX(pt.step)}
            cy={toY(Number(pt[metric]))}
            r={4.2}
            fill="#D97706"
            stroke="#FFFFFF"
            strokeWidth={1.3}
          >
            <title>Anomaly at step {pt.step}: z={pt.anomalyScore}</title>
          </circle>
        ))}

        {currentStep !== undefined && currentStep >= 1 && (
          <line
            x1={toX(currentStep)}
            y1={padT}
            x2={toX(currentStep)}
            y2={padT + plotH}
            stroke="#059669"
            strokeWidth={1.5}
          />
        )}

        {/* Interactive Hover Crosshair */}
        {hoveredPoint && (
          <g>
            <line
              x1={toX(hoveredPoint.step)}
              y1={padT}
              x2={toX(hoveredPoint.step)}
              y2={padT + plotH}
              stroke="#475569"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={toX(hoveredPoint.step)}
              cy={toY(Number(hoveredPoint[metric]))}
              r={4}
              fill={primaryColor}
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
            {hoveredCompPoint && (
              <circle
                cx={toX(hoveredCompPoint.step)}
                cy={toY(Number(hoveredCompPoint[metric]))}
                r={4}
                fill={compColor}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            )}
          </g>
        )}

        <text
          x={padL}
          y={height - 8}
          className="fill-slate-500 text-[9px] font-mono"
        >
          t=1
        </text>
        <text
          x={padL + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          className="fill-slate-500 text-[9px] font-mono"
        >
          Simulation Step (t)
        </text>
        <text
          x={width - padR}
          y={height - 8}
          textAnchor="end"
          className="fill-slate-500 text-[9px] font-mono"
        >
          t={maxStep}
        </text>
      </svg>

      {/* Legend & Live Hover Readout */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: primaryColor }}
            />
            {primaryLabel} (±1 SD band)
          </span>
          {comparison && comparisonLabel && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: compColor }}
              />
              {comparisonLabel}
            </span>
          )}
        </div>
        {hoveredPoint && (
          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-white">
            t={hoveredPoint.step}: {Number(hoveredPoint[metric]).toFixed(3)}
            {hoveredCompPoint
              ? ` vs ${Number(hoveredCompPoint[metric]).toFixed(3)}`
              : ""}{" "}
            | z={hoveredPoint.anomalyScore}
          </span>
        )}
      </div>
    </div>
  );
}
