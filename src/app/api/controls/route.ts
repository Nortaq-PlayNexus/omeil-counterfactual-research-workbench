import { NextResponse } from "next/server";
import { db } from "@/db";
import { provenanceEvents, systemControls } from "@/db/schema";
import { nextSequentialCode, withAutonomousLock } from "@/lib/db-helpers";
import { sha256Hex, SOFTWARE_VERSION } from "@/lib/omeil-engine";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const updated = await withAutonomousLock(async () => {
      const [existing] = await db.select().from(systemControls).limit(1);
      if (!existing) {
        return null;
      }

      const nextEmergencyStop =
        typeof body.emergencyStopActive === "boolean"
          ? body.emergencyStopActive
          : existing.emergencyStopActive;
      const nextPaused =
        typeof body.swarmPaused === "boolean"
          ? body.swarmPaused
          : existing.swarmPaused;
      const nextExternalDisabled =
        typeof body.externalProvidersDisabled === "boolean"
          ? body.externalProvidersDisabled
          : existing.externalProvidersDisabled;
      const nextLitDisabled =
        typeof body.literatureRetrievalDisabled === "boolean"
          ? body.literatureRetrievalDisabled
          : existing.literatureRetrievalDisabled;

      let nextAutonomous =
        typeof body.autonomousModeEnabled === "boolean"
          ? body.autonomousModeEnabled
          : existing.autonomousModeEnabled;

      if (nextEmergencyStop || nextPaused) {
        nextAutonomous = false;
      }

      const nextInterval = Math.max(
        2,
        Math.min(
          60,
          Number(body.autonomousIntervalSec ?? existing.autonomousIntervalSec)
        )
      );
      const nextMaxCycles = Math.max(
        5,
        Math.min(
          200,
          Number(body.maxAutonomousCycles ?? existing.maxAutonomousCycles)
        )
      );
      const nextCycleCount =
        body.resetCycleCount === true ? 0 : existing.autonomousCycleCount;

      const maxAgentsPerRun = Math.max(
        4,
        Math.min(64, Number(body.maxAgentsPerRun ?? existing.maxAgentsPerRun))
      );
      const maxStepsPerRun = Math.max(
        12,
        Math.min(240, Number(body.maxStepsPerRun ?? existing.maxStepsPerRun))
      );

      const stopReason =
        body.lastStopReason !== undefined
          ? body.lastStopReason
          : nextEmergencyStop
          ? "Human Emergency Stop triggered via Control Centre"
          : existing.lastStopReason;

      const [row] = await db
        .update(systemControls)
        .set({
          emergencyStopActive: nextEmergencyStop,
          swarmPaused: nextPaused,
          externalProvidersDisabled: nextExternalDisabled,
          literatureRetrievalDisabled: nextLitDisabled,
          autonomousModeEnabled: nextAutonomous,
          autonomousIntervalSec: nextInterval,
          maxAutonomousCycles: nextMaxCycles,
          autonomousCycleCount: nextCycleCount,
          maxAgentsPerRun,
          maxStepsPerRun,
          lastStopReason: stopReason,
          updatedAt: new Date(),
        })
        .where(eq(systemControls.id, existing.id))
        .returning();

      const eventCode = await nextSequentialCode(
        "provenance_events",
        "event_code",
        "PRV",
        4
      );

      await db.insert(provenanceEvents).values({
        eventCode,
        entityType: "system_control",
        entityId: row.id,
        action: nextEmergencyStop
          ? "EMERGENCY_STOP_ENGAGED"
          : typeof body.autonomousModeEnabled === "boolean"
          ? nextAutonomous
            ? "AUTONOMOUS_RESEARCH_ENABLED"
            : "AUTONOMOUS_RESEARCH_DISABLED"
          : "HUMAN_CONTROL_UPDATED",
        actor: "Human Principal Investigator",
        rationale:
          String(body.rationale ?? "").trim() ||
          `Human control update (Auto=${nextAutonomous}, E-Stop=${nextEmergencyStop}, Paused=${nextPaused}).`,
        contentHash: sha256Hex(row),
        softwareVersion: SOFTWARE_VERSION,
        metadata: {
          emergencyStopActive: nextEmergencyStop,
          swarmPaused: nextPaused,
          autonomousModeEnabled: nextAutonomous,
        },
      });

      return row;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "System controls not initialized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ controls: updated });
  } catch (error) {
    console.error("Controls PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update human oversight controls" },
      { status: 500 }
    );
  }
}
