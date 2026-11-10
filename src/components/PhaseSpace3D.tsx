"use client";

import React, { useMemo, useRef, useState } from "react";
import type { AgentSnapshot, TrajectoryPoint } from "@/db/schema";

interface PhaseSpace3DProps {
  runCode: string;
  agents: AgentSnapshot[];
  trajectory: TrajectoryPoint[];
  commEnabled: boolean;
  currentStep: number;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  colorBlindSafe?: boolean;
  reducedMotion?: boolean;
  comparisonAgents?: AgentSnapshot[];
  comparisonRunCode?: string;
}

type ColorEncoding = "cluster" | "role" | "energy" | "signal";

export function PhaseSpace3D({
  runCode,
  agents,
  trajectory,
  commEnabled,
  currentStep,
  selectedAgentId,
  onSelectAgent,
  colorBlindSafe = false,
  reducedMotion = false,
  comparisonAgents,
  comparisonRunCode,
}: PhaseSpace3DProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [yaw, setYaw] = useState(0.68);
  const [pitch, setPitch] = useState(0.42);
  const [zoom, setZoom] = useState(1.0);
  const [mode2D, setMode2D] = useState(false);
  const [colorBy, setColorBy] = useState<ColorEncoding>("cluster");
  const [showLinks, setShowLinks] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showPhaseRibbon, setShowPhaseRibbon] = useState(true);
  const [showCage, setShowCage] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [showGhost, setShowGhost] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!autoOrbit || mode2D || reducedMotion || dragging) return;
    const t = setInterval(() => {
      setYaw((y) => y + 0.025);
    }, 60);
    return () => clearInterval(t);
  }, [autoOrbit, mode2D, reducedMotion, dragging]);

  const width = 620;
  const height = 350;
  const cx = width / 2;
  const cy = height / 2;

  const project = (x: number, y: number, z: number) => {
    if (mode2D) {
      return {
        sx: cx + x * 125 * zoom,
        sy: cy - y * 125 * zoom,
        depth: z,
        scale: 1,
      };
    }
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    const y2 = y * cosP - z1 * sinP;
    const z2 = y * sinP + z1 * cosP;

    const perspective = 3.4 / Math.max(0.85, 3.4 - z2);
    return {
      sx: cx + x1 * 125 * zoom * perspective,
      sy: cy - y2 * 125 * zoom * perspective,
      depth: z2,
      scale: perspective,
    };
  };

  const stepRatio = useMemo(() => {
    if (trajectory.length === 0) return 1;
    return currentStep / Math.max(1, trajectory[trajectory.length - 1].step);
  }, [currentStep, trajectory]);

  const currentPoint = useMemo(() => {
    return (
      trajectory.find((p) => p.step === currentStep) ??
      trajectory[trajectory.length - 1]
    );
  }, [trajectory, currentStep]);

  const projectedAgents = useMemo(() => {
    return agents
      .map((a, idx) => {
        const orderScale = currentPoint
          ? 1 - currentPoint.orderParameter * 0.45
          : 1;
        const px =
          a.x * (0.4 + 0.6 * stepRatio) * orderScale +
          Math.cos(idx * 0.7 + currentStep * 0.12) * (1 - stepRatio) * 0.42;
        const py =
          a.y * (0.4 + 0.6 * stepRatio) * orderScale +
          Math.sin(idx * 0.7 + currentStep * 0.12) * (1 - stepRatio) * 0.42;
        const pz = a.z;
        const p = project(px, py, pz);
        const vEnd = project(px + a.vx * 1.4, py + a.vy * 1.4, pz);
        return { agent: a, ...p, vxEnd: vEnd.sx, vyEnd: vEnd.sy };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [agents, currentPoint, stepRatio, currentStep, yaw, pitch, zoom, mode2D]);

  // Volumetric 3D wire-frame bounding cube [-1, 1]^3
  const cageEdges = useMemo(() => {
    if (!showCage || mode2D) return [];
    const pts = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ].map(([x, y, z]) => project(x, y, z));
    const pairs = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    return pairs.map(([i, j]) => ({ a: pts[i], b: pts[j] }));
  }, [showCage, mode2D, yaw, pitch, zoom]);

  // Phase-space trajectory segments with time-step coloring & anomaly highlights
  const ribbonSegments = useMemo(() => {
    if (!showPhaseRibbon || trajectory.length < 2) return [];
    const slice = trajectory.filter((t) => t.step <= currentStep);
    const segs: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isAnomaly: boolean;
      order: number;
    }[] = [];

    for (let i = 1; i < slice.length; i++) {
      const p0 = slice[i - 1];
      const p1 = slice[i];
      const a = project(
        (p0.orderParameter - 0.5) * 1.8,
        (p0.entropyBits / 3.0 - 0.5) * 1.6,
        (p0.transferEntropyBits - 0.3) * 1.4
      );
      const b = project(
        (p1.orderParameter - 0.5) * 1.8,
        (p1.entropyBits / 3.0 - 0.5) * 1.6,
        (p1.transferEntropyBits - 0.3) * 1.4
      );
      segs.push({
        x1: a.sx,
        y1: a.sy,
        x2: b.sx,
        y2: b.sy,
        isAnomaly: p1.anomalyScore > 2.8,
        order: p1.orderParameter,
      });
    }
    return segs;
  }, [trajectory, currentStep, showPhaseRibbon, yaw, pitch, zoom, mode2D]);

  // Attractor basin ring in XY plane scaled by (1 - R(t))
  const basinRingPoints = useMemo(() => {
    const r = currentPoint ? Math.max(0.22, 0.95 - currentPoint.orderParameter * 0.55) : 0.65;
    const pts: string[] = [];
    for (let i = 0; i <= 36; i++) {
      const th = (2 * Math.PI * i) / 36;
      const p = project(Math.cos(th) * r, Math.sin(th) * r, 0);
      pts.push(`${i === 0 ? "M" : "L"}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [currentPoint, yaw, pitch, zoom, mode2D]);

  const origin = project(0, 0, 0);
  const axX = project(1.15, 0, 0);
  const axY = project(0, 1.15, 0);
  const axZ = project(0, 0, 1.15);

  const getAgentColor = (a: AgentSnapshot) => {
    if (!a.active) return "#EF4444";
    if (colorBy === "cluster") {
      const palette = colorBlindSafe
        ? ["#0072B2", "#E69F00", "#009E73"] // Okabe-Ito
        : ["#38BDF8", "#34D399", "#FBBF24"];
      return palette[a.clusterId % 3];
    }
    if (colorBy === "role") {
      const roleColors: Record<string, string> = {
        explorer: "#38BDF8",
        coordinator: "#34D399",
        validator: "#F472B6",
        aggregator: "#FBBF24",
      };
      return roleColors[a.role] ?? "#94A3B8";
    }
    if (colorBy === "energy") {
      return a.energy > 8 ? "#34D399" : a.energy > 4 ? "#FBBF24" : "#F87171";
    }
    // signal
    return a.signal > 0.25 ? "#34D399" : a.signal < -0.25 ? "#60A5FA" : "#FBBF24";
  };

  const exportSnapshotSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${runCode}-phase-space-step-${currentStep}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-slate-900">
              {mode2D
                ? `2D Accessible State Projection — ${runCode}`
                : `3D Volumetric Phase Space & Attractor Field — ${runCode}`}
            </h4>
            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[9.5px] text-sky-300">
              DATA-LINKED
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Drag to orbit 3D phase space | Click any agent node to inspect observable state & velocity
          </p>
        </div>

        {/* Camera Bookmarks & Snapshot Export */}
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => {
              setMode2D(false);
              setYaw(0.68);
              setPitch(0.42);
              setZoom(1.0);
            }}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
          >
            Iso
          </button>
          <button
            type="button"
            onClick={() => {
              setMode2D(false);
              setYaw(0.0);
              setPitch(1.48);
            }}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
          >
            Top XZ
          </button>
          <button
            type="button"
            onClick={() => {
              setMode2D(false);
              setYaw(0.0);
              setPitch(0.0);
            }}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
          >
            Front XY
          </button>
          <button
            type="button"
            onClick={() => setAutoOrbit((a) => !a)}
            disabled={mode2D || reducedMotion}
            className={`rounded border px-2 py-1 font-medium disabled:opacity-40 ${
              autoOrbit && !mode2D
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
            title="Auto-orbit 3D camera"
          >
            {autoOrbit ? "Orbiting" : "Orbit"}
          </button>
          <button
            type="button"
            onClick={() => setMode2D(!mode2D)}
            className={`rounded border px-2 py-1 font-medium ${
              mode2D
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {mode2D ? "3D View" : "2D Alt"}
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 font-mono text-slate-700 hover:bg-slate-100"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 font-mono text-slate-700 hover:bg-slate-100"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={exportSnapshotSvg}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
            title="Export 3D state SVG snapshot"
          >
            SVG
          </button>
        </div>
      </div>

      {/* Layer Controls & Color Encoding */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={showLinks}
            onChange={(e) => setShowLinks(e.target.checked)}
            className="accent-blue-600"
          />
          Links
        </label>
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={showVectors}
            onChange={(e) => setShowVectors(e.target.checked)}
            className="accent-blue-600"
          />
          Velocity
        </label>
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={showPhaseRibbon}
            onChange={(e) => setShowPhaseRibbon(e.target.checked)}
            className="accent-blue-600"
          />
          Attractor Ribbon
        </label>
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={showCage}
            onChange={(e) => setShowCage(e.target.checked)}
            className="accent-blue-600"
          />
          3D Cage
        </label>
        {comparisonAgents && comparisonAgents.length > 0 && (
          <label className="flex cursor-pointer items-center gap-1 text-rose-700">
            <input
              type="checkbox"
              checked={showGhost}
              onChange={(e) => setShowGhost(e.target.checked)}
              className="accent-rose-600"
            />
            Overlay {comparisonRunCode}
          </label>
        )}

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">Color:</span>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as ColorEncoding)}
            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
          >
            <option value="cluster">Cluster</option>
            <option value="role">Agent Role</option>
            <option value="energy">Resource Energy</option>
            <option value="signal">Signal Polarity</option>
          </select>
        </div>

        <span className="ml-auto rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
          t={currentStep} | R={currentPoint?.orderParameter.toFixed(3) ?? "0.000"}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-80 w-full cursor-grab rounded-xl border border-slate-800 bg-[#070D19] select-none active:cursor-grabbing"
        onMouseDown={(e) => {
          setDragging(true);
          setLastPos({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          if (!dragging || !lastPos || mode2D) return;
          const dx = e.clientX - lastPos.x;
          const dy = e.clientY - lastPos.y;
          setYaw((y) => y + dx * 0.01);
          setPitch((p) => Math.max(-1.48, Math.min(1.48, p + dy * 0.01)));
          setLastPos({ x: e.clientX, y: e.clientY });
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        role="img"
        aria-label="3D volumetric phase space and agent network projection"
      >
        <defs>
          <radialGradient id="omeilGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#070D19" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={width} height={height} fill="url(#omeilGlow)" />

        {/* 3D Bounding Cage */}
        {cageEdges.map((edge, idx) => (
          <line
            key={idx}
            x1={edge.a.sx}
            y1={edge.a.sy}
            x2={edge.b.sx}
            y2={edge.b.sy}
            stroke="#1E293B"
            strokeWidth={0.9}
          />
        ))}

        {/* Synchronization Attractor Basin Ring */}
        <path
          d={basinRingPoints}
          fill="none"
          stroke="#0EA5E9"
          strokeOpacity={0.32}
          strokeWidth={1.3}
          strokeDasharray="4 4"
        />

        {/* Principal Axes */}
        <line
          x1={origin.sx}
          y1={origin.sy}
          x2={axX.sx}
          y2={axX.sy}
          stroke="#475569"
          strokeWidth={1.1}
        />
        <text x={axX.sx + 4} y={axX.sy} className="fill-slate-400 text-[9px] font-mono">
          X (Phase Cos)
        </text>
        <line
          x1={origin.sx}
          y1={origin.sy}
          x2={axY.sx}
          y2={axY.sy}
          stroke="#475569"
          strokeWidth={1.1}
        />
        <text x={axY.sx + 4} y={axY.sy} className="fill-slate-400 text-[9px] font-mono">
          Y (Phase Sin)
        </text>
        {!mode2D && (
          <>
            <line
              x1={origin.sx}
              y1={origin.sy}
              x2={axZ.sx}
              y2={axZ.sy}
              stroke="#475569"
              strokeWidth={1.1}
            />
            <text x={axZ.sx + 4} y={axZ.sy} className="fill-slate-400 text-[9px] font-mono">
              Z (Signal/TE)
            </text>
          </>
        )}

        {/* Phase-space attractor trajectory ribbon */}
        {ribbonSegments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.isAnomaly ? "#F59E0B" : "#38BDF8"}
            strokeWidth={seg.isAnomaly ? 2.6 : 1.7}
            strokeOpacity={0.35 + (i / Math.max(1, ribbonSegments.length)) * 0.6}
          />
        ))}

        {/* Network Interaction Links */}
        {showLinks &&
          commEnabled &&
          projectedAgents.map((pa, i) => {
            if (!pa.agent.active) return null;
            return projectedAgents.slice(i + 1).map((pb) => {
              if (!pb.agent.active || pa.agent.clusterId !== pb.agent.clusterId)
                return null;
              return (
                <line
                  key={`${pa.agent.id}-${pb.agent.id}`}
                  x1={pa.sx}
                  y1={pa.sy}
                  x2={pb.sx}
                  y2={pb.sy}
                  stroke="#38BDF8"
                  strokeWidth={0.75}
                  strokeOpacity={0.28}
                />
              );
            });
          })}

        {/* Comparison Run Ghost Nodes */}
        {showGhost &&
          comparisonAgents &&
          comparisonAgents.map((ga) => {
            const gp = project(ga.x, ga.y, ga.z);
            return (
              <circle
                key={`ghost-${ga.id}`}
                cx={gp.sx}
                cy={gp.sy}
                r={4.2 * Math.max(0.7, gp.scale)}
                fill="none"
                stroke="#FB7185"
                strokeWidth={1.3}
                strokeDasharray="2 2"
                opacity={0.75}
              >
                <title>
                  [Overlay {comparisonRunCode}] {ga.id}: sig={ga.signal}
                </title>
              </circle>
            );
          })}

        {/* Agent Nodes & Velocity Vectors */}
        {projectedAgents.map(({ agent, sx, sy, scale, vxEnd, vyEnd }) => {
          const isSelected = selectedAgentId === agent.id;
          const color = getAgentColor(agent);
          const radius = (isSelected ? 7.8 : 5.4) * Math.max(0.72, scale);

          return (
            <g
              key={agent.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAgent(agent.id);
              }}
            >
              {showVectors && agent.active && (
                <line
                  x1={sx}
                  y1={sy}
                  x2={vxEnd}
                  y2={vyEnd}
                  stroke={color}
                  strokeWidth={1.3}
                  strokeOpacity={0.75}
                />
              )}
              {isSelected && (
                <circle
                  cx={sx}
                  cy={sy}
                  r={radius + 5}
                  fill="none"
                  stroke="#F8FAFC"
                  strokeWidth={1.6}
                  strokeDasharray="3 2"
                />
              )}
              <circle
                cx={sx}
                cy={sy}
                r={radius}
                fill={color}
                fillOpacity={agent.active ? 0.94 : 0.35}
                stroke={agent.active ? "#F8FAFC" : "#EF4444"}
                strokeWidth={agent.active ? 1.1 : 1.6}
                strokeDasharray={agent.active ? undefined : "2 2"}
              >
                <title>
                  {agent.id} ({agent.role}) | sig={agent.signal} | energy=
                  {agent.energy} | {agent.active ? "active" : "REMOVED"}
                </title>
              </circle>
              <text
                x={sx + radius + 3.5}
                y={sy + 3}
                className="fill-slate-300 text-[8.5px] font-mono"
              >
                {agent.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
