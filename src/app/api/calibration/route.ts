import { NextResponse } from "next/server";
import { db } from "@/db";
import { calibrationBenchmarks, provenanceEvents } from "@/db/schema";
import {
  runCalibrationSuite,
  sha256Hex,
  SOFTWARE_VERSION,
} from "@/lib/omeil-engine";
import { count } from "drizzle-orm";

export async function POST() {
  try {
    const suite = runCalibrationSuite();

    await db.delete(calibrationBenchmarks);
    const inserted = await db
      .insert(calibrationBenchmarks)
      .values(
        suite.map((item) => ({
          ...item,
          softwareVersion: SOFTWARE_VERSION,
        }))
      )
      .returning();

    const passed = inserted.filter((i) => i.status === "PASS").length;
    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);

    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "benchmark",
      entityId: inserted[0]?.id ?? 1,
      action: "CALIBRATION_SUITE_EXECUTED",
      actor: "OMEIL Self-Test Runner",
      rationale: `Executed synthetic known-answer suite (${passed}/${inserted.length} PASS). Validates software instruments only.`,
      contentHash: sha256Hex(suite),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { passed, total: inserted.length },
    });

    return NextResponse.json({ benchmarks: inserted });
  } catch (error) {
    console.error("Calibration POST error:", error);
    return NextResponse.json(
      { error: "Failed to run calibration suite" },
      { status: 500 }
    );
  }
}
