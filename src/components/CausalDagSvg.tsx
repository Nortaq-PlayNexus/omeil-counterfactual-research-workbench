"use client";

import React from "react";
import type { CausalEdge, CausalNode } from "@/db/schema";

interface CausalDagSvgProps {
  nodes: CausalNode[];
  edges: CausalEdge[];
  identificationStatus: string;
}

export function CausalDagSvg({
  nodes,
  edges,
  identificationStatus,
}: CausalDagSvgProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const roleStyles: Record<
    string,
    { fill: string; stroke: string; text: string }
  > = {
    instrument: { fill: "#EFF6FF", stroke: "#2563EB", text: "#1E40AF" },
    exposure: { fill: "#FEF3C7", stroke: "#D97706", text: "#92400E" },
    mediator: { fill: "#F1F5F9", stroke: "#475569", text: "#0F172A" },
    confounder: { fill: "#FEF2F2", stroke: "#DC2626", text: "#991B1B" },
    outcome: { fill: "#ECFDF5", stroke: "#059669", text: "#065F46" },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-900">
          Structural Causal DAG & Identification Path
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
            identificationStatus === "identified_matched_counterfactual"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {identificationStatus === "identified_matched_counterfactual"
            ? "IDENTIFIED (Matched Seed)"
            : "ASSOCIATIVE ONLY (Confounded)"}
        </span>
      </div>

      <svg viewBox="0 0 490 235" className="h-52 w-full">
        <defs>
          <marker
            id="arrow-causal"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L7,3 z" fill="#334155" />
          </marker>
          <marker
            id="arrow-confound"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L7,3 z" fill="#DC2626" />
          </marker>
        </defs>

        {edges.map((edge, idx) => {
          const src = nodeMap.get(edge.from);
          const dst = nodeMap.get(edge.to);
          if (!src || !dst) return null;

          const x1 = src.x + 64;
          const y1 = src.y + 18;
          const x2 = dst.x + 12;
          const y2 = dst.y + 18;
          const isConfound = edge.type === "confounding";
          const isAblated = edge.type === "ablated";

          return (
            <line
              key={idx}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={
                isConfound ? "#DC2626" : isAblated ? "#94A3B8" : "#334155"
              }
              strokeWidth={isConfound ? 2 : 1.7}
              strokeDasharray={isAblated ? "4 4" : isConfound ? "6 3" : undefined}
              markerEnd={
                isConfound ? "url(#arrow-confound)" : "url(#arrow-causal)"
              }
            />
          );
        })}

        {nodes.map((node) => {
          const st = roleStyles[node.role] ?? roleStyles.mediator;
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <rect
                width={118}
                height={36}
                rx={7}
                fill={st.fill}
                stroke={st.stroke}
                strokeWidth={1.5}
              />
              <text
                x={59}
                y={14}
                textAnchor="middle"
                className="text-[8.5px] font-mono uppercase"
                fill={st.text}
              >
                {node.role}
              </text>
              <text
                x={59}
                y={27}
                textAnchor="middle"
                className="text-[9.5px] font-semibold"
                fill={st.text}
              >
                {node.label.length > 21
                  ? node.label.slice(0, 20) + "…"
                  : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-slate-700" /> Causal Link
        </span>
        <span className="flex items-center gap-1 text-red-700">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-red-600" />{" "}
          Confounding Path
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-slate-400" />{" "}
          Ablated Mechanism
        </span>
      </div>
    </div>
  );
}
