import { NextResponse } from "next/server";
import { db } from "@/db";
import { provenanceEvents, researchProgrammes } from "@/db/schema";
import { nextSequentialCode } from "@/lib/db-helpers";
import { sha256Hex, SOFTWARE_VERSION } from "@/lib/omeil-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const researchQuestion = String(body.researchQuestion ?? "").trim();
    const operationalDefinition = String(
      body.operationalDefinition ?? ""
    ).trim();

    if (!title || !researchQuestion || !operationalDefinition) {
      return NextResponse.json(
        {
          error:
            "Title, Research Question, and Operational Definition are required per Part LV ontology.",
        },
        { status: 400 }
      );
    }

    const code = await nextSequentialCode(
      "research_programmes",
      "code",
      "PROG",
      2
    );
    const h1 = String(body.hypothesis1 ?? "").trim() || "H1: Measurable collective effect under intervention.";
    const h0 = String(body.hypothesis0 ?? "").trim() || "H0: No detectable effect beyond stochastic variance.";

    const [created] = await db
      .insert(researchProgrammes)
      .values({
        code,
        title,
        researchQuestion,
        operationalDefinition,
        competingHypotheses: [h1, h0],
        status: "active",
        ethicsChecklistPassed: true,
        limitations:
          String(body.limitations ?? "").trim() ||
          "Bounded Tier-1 synthetic simulation; no external human extrapolation.",
      })
      .returning();

    const eventCode = await nextSequentialCode(
      "provenance_events",
      "event_code",
      "PRV",
      4
    );
    await db.insert(provenanceEvents).values({
      eventCode,
      entityType: "programme",
      entityId: created.id,
      action: "RESEARCH_PROGRAMME_CREATED",
      actor: "Human Principal Investigator",
      rationale: `Created ${code}: ${title}`,
      contentHash: sha256Hex(created),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { code },
    });

    return NextResponse.json({ programme: created }, { status: 201 });
  } catch (error) {
    console.error("Programme POST error:", error);
    return NextResponse.json(
      { error: "Failed to create research programme" },
      { status: 500 }
    );
  }
}
