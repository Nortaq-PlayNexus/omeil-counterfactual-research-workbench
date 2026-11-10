import { NextResponse } from "next/server";
import { db } from "@/db";
import { provenanceEvents } from "@/db/schema";
import { nextSequentialCode } from "@/lib/db-helpers";
import {
  runEnvironmentValidationSuite,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";

export async function POST() {
  try {
    const checks = runEnvironmentValidationSuite();
    const passed = checks.filter((c) => c.status === "PASS").length;

    const eventCode = await nextSequentialCode(
      "provenance_events",
      "event_code",
      "PRV",
      4
    );
    await db.insert(provenanceEvents).values({
      eventCode,
      entityType: "environment_validation",
      entityId: 1,
      action: "ENVIRONMENT_FACTORY_VALIDATED",
      actor: "OMEIL Environment Validator",
      rationale: `Validated ${passed}/${checks.length} environment families for deterministic replay, seed sensitivity, and extreme-noise bounds.`,
      contentHash: sha256Hex(checks),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { passed, total: checks.length },
    });

    return NextResponse.json({ checks });
  } catch (error) {
    console.error("Environment validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate environments" },
      { status: 500 }
    );
  }
}
