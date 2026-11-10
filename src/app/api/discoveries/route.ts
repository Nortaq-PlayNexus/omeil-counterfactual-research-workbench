import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  discoverySearchArchives,
  provenanceEvents,
  systemControls,
} from "@/db/schema";
import {
  EnvironmentFamily,
  runQualityDiversitySearch,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const [ctrl] = await db.select().from(systemControls).limit(1);
    if (ctrl?.emergencyStopActive || ctrl?.swarmPaused) {
      return NextResponse.json(
        { error: "Execution halted by Human Oversight Controls." },
        { status: 423 }
      );
    }

    const env = (body.environmentFamily ??
      "CoupledOscillatorSwarm") as EnvironmentFamily;
    const seed = Number(body.baseSeed ?? Math.floor(Math.random() * 80000 + 10000));
    const qdOut = runQualityDiversitySearch(env, seed);

    const [{ value: qdCount }] = await db
      .select({ value: count() })
      .from(discoverySearchArchives);
    const archiveCode = `QD-${String(qdCount + 1).padStart(4, "0")}`;

    const [created] = await db
      .insert(discoverySearchArchives)
      .values({
        archiveCode,
        environmentFamily: env,
        searchObjective:
          String(body.searchObjective ?? "").trim() ||
          `MAP-Elites behavioral diversity search in ${env} (base seed ${seed})`,
        descriptorX: "Final Order Parameter R(T) [0, 1]",
        descriptorY: "Shannon Phase Entropy H(T) [0, 3 bits]",
        ...qdOut,
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "discovery_archive",
      entityId: created.id,
      action: "QD_REPERTOIRE_SEARCH_EXECUTED",
      actor: "OMEIL Open-Ended Discovery Engine",
      rationale: `Evaluated ${qdOut.totalEvaluations} bounded runs in ${env}; coverage=${qdOut.coveragePct}%, QD-score=${qdOut.qdScore}.`,
      contentHash: sha256Hex(created),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { coveragePct: qdOut.coveragePct, qdScore: qdOut.qdScore },
    });

    return NextResponse.json({ archive: created }, { status: 201 });
  } catch (error) {
    console.error("Discovery search error:", error);
    return NextResponse.json(
      { error: "Failed to run Quality-Diversity search" },
      { status: 500 }
    );
  }
}
