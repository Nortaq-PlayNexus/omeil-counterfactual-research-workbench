import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  claimsLedger,
  provenanceEvents,
  redTeamReviews,
} from "@/db/schema";
import { sha256Hex, SOFTWARE_VERSION } from "@/lib/omeil-engine";
import { and, count, eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "add_review") {
      const claimId = Number(body.claimId);
      const [claim] = await db
        .select()
        .from(claimsLedger)
        .where(eq(claimsLedger.id, claimId));
      if (!claim) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }

      const [review] = await db
        .insert(redTeamReviews)
        .values({
          claimId,
          reviewerIdentity: String(
            body.reviewerIdentity ?? "RT-Specialist-Reviewer"
          ),
          reviewerRole: String(body.reviewerRole ?? "Hypothesis Falsifier"),
          explanationCategory: String(
            body.explanationCategory ?? "random_variation"
          ),
          severity: String(body.severity ?? "major"),
          objectionText: String(body.objectionText ?? "").trim(),
          evidenceRef: String(body.evidenceRef ?? "Manual inspection"),
          status: "unresolved",
          blindReview: body.blindReview !== false,
          sharedModelWarning: Boolean(body.sharedModelWarning ?? false),
          softwareVersion: SOFTWARE_VERSION,
        })
        .returning();

      if (review.severity === "critical") {
        await db
          .update(claimsLedger)
          .set({
            validationStatus: "blocked_by_objection",
            confidenceLabel: "blocked_contested",
          })
          .where(eq(claimsLedger.id, claimId));
      }

      const [{ value: prvCount }] = await db
        .select({ value: count() })
        .from(provenanceEvents);
      await db.insert(provenanceEvents).values({
        eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
        entityType: "review",
        entityId: review.id,
        action: "RED_TEAM_OBJECTION_FILED",
        actor: `${review.reviewerRole} (${review.reviewerIdentity})`,
        rationale: review.objectionText,
        contentHash: sha256Hex(review),
        softwareVersion: SOFTWARE_VERSION,
        metadata: { claimId, severity: review.severity },
      });

      return NextResponse.json({ review }, { status: 201 });
    }

    // Create a new Claim in Ledger
    const supportingRunIds = Array.isArray(body.supportingRunIds)
      ? body.supportingRunIds.map(Number)
      : [];
    if (supportingRunIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Ontology violation: A scientific claim cannot be registered without at least one supporting run ID.",
        },
        { status: 400 }
      );
    }

    const [{ value: clmCount }] = await db
      .select({ value: count() })
      .from(claimsLedger);
    const claimCode = `CLM-${String(clmCount + 1).padStart(3, "0")}`;

    const [created] = await db
      .insert(claimsLedger)
      .values({
        claimCode,
        programmeId: Number(body.programmeId ?? 1),
        claimText: String(body.claimText ?? "").trim(),
        claimType: String(body.claimType ?? "Pattern"),
        operationalDefinition: String(
          body.operationalDefinition ?? "Defined per experimental protocol."
        ),
        supportingRunIds,
        contradictingRunIds: Array.isArray(body.contradictingRunIds)
          ? body.contradictingRunIds.map(Number)
          : [],
        assumptions: Array.isArray(body.assumptions)
          ? body.assumptions.map(String)
          : ["Finite deterministic simulation horizon"],
        alternativeExplanations: Array.isArray(body.alternativeExplanations)
          ? body.alternativeExplanations.map(String)
          : ["Sampling variation or parameter boundary effect"],
        scopeConditions: String(
          body.scopeConditions ?? "Bounded Tier-1 simulation family"
        ),
        uncertainty: body.uncertainty ?? {
          measurement: "Verified by DataQualityValidator",
          sampling: "Pending multi-seed replication",
          model: "Abstract mechanistic dynamics",
          mechanism: "Provisional",
          novelty: "Requires literature & calibration audit",
        },
        confidenceLabel: "low_exploratory",
        validationStatus: "under_red_team",
        independenceClassification: String(
          body.independenceClassification ?? "partially_independent"
        ),
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "claim",
      entityId: created.id,
      action: "CLAIM_REGISTERED",
      actor: "OMEIL Evidence Ledger",
      rationale: `Registered ${claimCode} (${created.claimType}) linked to runs [${supportingRunIds.join(",")}].`,
      contentHash: sha256Hex(created),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { claimCode },
    });

    return NextResponse.json({ claim: created }, { status: 201 });
  } catch (error) {
    console.error("Claims POST error:", error);
    return NextResponse.json(
      { error: "Failed to process claim or review" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "resolve_review") {
      const reviewId = Number(body.reviewId);
      const [updatedReview] = await db
        .update(redTeamReviews)
        .set({
          status: String(body.status ?? "resolved"),
          resolutionNote: String(
            body.resolutionNote ?? "Resolved with supporting evidence."
          ),
        })
        .where(eq(redTeamReviews.id, reviewId))
        .returning();

      if (!updatedReview) {
        return NextResponse.json({ error: "Review not found" }, { status: 404 });
      }

      const [{ value: prvCount }] = await db
        .select({ value: count() })
        .from(provenanceEvents);
      await db.insert(provenanceEvents).values({
        eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
        entityType: "review",
        entityId: updatedReview.id,
        action: "RED_TEAM_OBJECTION_RESOLVED",
        actor: "Lead Researcher",
        rationale: updatedReview.resolutionNote ?? "Resolved",
        contentHash: sha256Hex(updatedReview),
        softwareVersion: SOFTWARE_VERSION,
        metadata: { claimId: updatedReview.claimId },
      });

      return NextResponse.json({ review: updatedReview });
    }

    // Lifecycle upgrade/transition gate
    const claimId = Number(body.claimId);
    const targetStatus = String(body.validationStatus);
    const humanOverride = Boolean(body.humanOverrideApproved ?? false);
    const humanOverrideNote = String(body.humanOverrideNote ?? "").trim();

    const [claim] = await db
      .select()
      .from(claimsLedger)
      .where(eq(claimsLedger.id, claimId));
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Enforce Part XXX state machine: cannot promote to validated_finding with critical unresolved objections
    const unresolvedCritical = await db
      .select()
      .from(redTeamReviews)
      .where(
        and(
          eq(redTeamReviews.claimId, claimId),
          eq(redTeamReviews.severity, "critical"),
          eq(redTeamReviews.status, "unresolved")
        )
      );

    if (targetStatus === "validated_finding" && unresolvedCritical.length > 0) {
      if (!humanOverride || humanOverrideNote.length < 10) {
        return NextResponse.json(
          {
            error: `Promotion BLOCKED: ${unresolvedCritical.length} critical unresolved red-team objection(s) remain. Resolve the objection or provide a documented human review override (>= 10 chars rationale).`,
          },
          { status: 409 }
        );
      }
    }

    const newConfidence =
      targetStatus === "validated_finding"
        ? humanOverride
          ? "moderate_provisional"
          : "high_replicated"
        : targetStatus === "falsified"
        ? "blocked_contested"
        : targetStatus === "inconclusive"
        ? "inconclusive_underpowered"
        : claim.confidenceLabel;

    const [updatedClaim] = await db
      .update(claimsLedger)
      .set({
        validationStatus: targetStatus,
        confidenceLabel: newConfidence,
        humanOverrideApproved: humanOverride || claim.humanOverrideApproved,
        humanOverrideNote:
          humanOverrideNote || claim.humanOverrideNote,
      })
      .where(eq(claimsLedger.id, claimId))
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "claim",
      entityId: claimId,
      action: humanOverride
        ? "HUMAN_OVERRIDE_PROMOTION"
        : "CLAIM_STATUS_TRANSITION",
      actor: humanOverride ? "Human Principal Investigator" : "OMEIL Gate",
      rationale: humanOverride
        ? `Human override approved for ${claim.claimCode}: ${humanOverrideNote}`
        : `Transitioned ${claim.claimCode} -> ${targetStatus}`,
      contentHash: sha256Hex(updatedClaim),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { targetStatus, humanOverride },
    });

    return NextResponse.json({ claim: updatedClaim });
  } catch (error) {
    console.error("Claims PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update claim or review" },
      { status: 500 }
    );
  }
}
