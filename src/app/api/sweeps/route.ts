import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  parameterSweeps,
  provenanceEvents,
  systemControls,
} from "@/db/schema";
import {
  EnvironmentFamily,
  runParameterSweep,
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
    const mode = (body.sweepMode ?? "2d_phase_diagram") as
      | "2d_phase_diagram"
      | "hysteresis_loop";
    const seed = Number(body.baseSeed ?? 84000);

    const out = runParameterSweep(env, mode, seed);
    const [{ value: swCount }] = await db
      .select({ value: count() })
      .from(parameterSweeps);
    const sweepCode = `SWP-${String(swCount + 1).padStart(4, "0")}`;

    const [created] = await db
      .insert(parameterSweeps)
      .values({
        sweepCode,
        environmentFamily: env,
        sweepMode: mode,
        ...out,
        softwareVersion: SOFTWARE_VERSION,
      })
      .returning();

    const [{ value: prvCount }] = await db
      .select({ value: count() })
      .from(provenanceEvents);
    await db.insert(provenanceEvents).values({
      eventCode: `PRV-${String(prvCount + 1).padStart(4, "0")}`,
      entityType: "parameter_sweep",
      entityId: created.id,
      action: "PHASE_SPACE_SWEEP_EXECUTED",
      actor: "OMEIL Dynamical Systems Engine",
      rationale: `Executed ${sweepCode} (${mode}) on ${env}: ${out.criticalTransitionEstimate}.`,
      contentHash: sha256Hex(created),
      softwareVersion: SOFTWARE_VERSION,
      metadata: { sweepMode: mode, hysteresisGap: out.hysteresisGap },
    });

    return NextResponse.json({ sweep: created }, { status: 201 });
  } catch (error) {
    console.error("Parameter sweep error:", error);
    return NextResponse.json(
      { error: "Failed to run parameter sweep" },
      { status: 500 }
    );
  }
}
