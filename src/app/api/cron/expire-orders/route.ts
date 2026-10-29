import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";

export const dynamic = "force-dynamic";

function reply(status: number, body: Record<string, unknown> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authorized(request: NextRequest, secret: string) {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/** Scheduled job: releases stock held by orders that were never paid. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) return reply(503);
  if (!authorized(request, secret)) return reply(401);

  const service = createSupabaseServiceClient();
  if (!service) return reply(503);
  const { data, error } = await service.rpc("expire_pending_orders");
  if (error) return reply(500);
  return reply(200, { expired: typeof data === "number" ? data : 0 });
}
