/**
 * GET /api/health → healthcheck para load balancers, uptime monitors e deploy gates.
 *
 * Resposta JSON estável:
 *   { status: 'ok' | 'degraded', db: 'up' | 'down' | 'unconfigured', uptime_s, timestamp }
 *
 * Códigos:
 *   200 → tudo certo (db up ou intencionalmente não configurado).
 *   503 → banco configurado porém inacessível (degraded).
 */

import { NextResponse } from "next/server";
import { sql, dbHabilitado } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db: "up" | "down" | "unconfigured" = "unconfigured";

  if (dbHabilitado) {
    try {
      await sql`select 1 as ok`;
      db = "up";
    } catch {
      db = "down";
    }
  }

  const status: "ok" | "degraded" = db === "down" ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      db,
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: db === "down" ? 503 : 200 },
  );
}
