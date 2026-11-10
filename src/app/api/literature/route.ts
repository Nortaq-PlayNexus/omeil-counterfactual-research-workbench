import { NextResponse } from "next/server";
import { db } from "@/db";
import { literatureRecords, provenanceEvents } from "@/db/schema";
import { sha256Hex, SOFTWARE_VERSION } from "@/lib/omeil-engine";
import { count } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const doiOrId = String(body.doiOrId ?? "").trim();
    if (!title || !doiOrId) {
      return NextResponse.json(
        {
          error:
            "Literature provenance requires both a verified Title and DOI/Identifier.",
        },
        { status: 400 }
      );
    }

    const [{ value: litCount }] = await db
      .select({ value: count() })
      .from(literatureRecords);
    const litCode = `LIT-${String(litCount + 1).padStart(3, "0")}`;

    const accessStatus = String(body.accessStatus ?? "abstract_only");
    const inspectedFullText =
      accessStatus === "open_access_fulltext" &&
      Boolean(body.inspectedFullText);

    const [created] = await db
      .insert(literatureRecords)
      .values({
        litCode,
        title,
        authors: String(body.authors ?? "Unspecified"),
        venue: String(body.venue ?? "Preprint / Archive"),
        year: Number(body.year ?? 2025),
        doiOrId,
        sourceUrl: String(
          body.sourceUrl ?? `https://doi.org/${encodeURIComponent(doiOrId)}`
        ),
        peerReviewStatus: String(body.peerReviewStatus ?? "peer_reviewed"),
        accessStatus,
        inspectedFullText,
        relationToProgramme: String(
          body.relationToProgramme ?? "baseline_method"
        ),
        relatedProgrammeCode: String(body.relatedProgrammeCode ?? "PROG-01"),
        keyClaimChecked: String(body.keyClaimChecked ?? "").trim(),
        limitationsNoted: String(
          body.limitationsNoted ??
            (inspectedFullText
              ? "Full text inspected."
              : "Access limited to abstract only; full-text methods not verified.")
        ),
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "literature",
      entityId: created.id,
      action: "LITERATURE_RECORD_VERIFIED",
      actor: "Research Source Graph",
      rationale: `Registered ${litCode} (${doiOrId}) [access=${accessStatus}, fullText=${inspectedFullText}].`,
      contentHash: sha256Hex(created),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { doiOrId, inspectedFullText },
    });

    return NextResponse.json({ literature: created }, { status: 201 });
  } catch (error) {
    console.error("Literature POST error:", error);
    return NextResponse.json(
      { error: "Failed to register literature record" },
      { status: 500 }
    );
  }
}
