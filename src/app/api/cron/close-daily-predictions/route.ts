import { NextResponse, type NextRequest } from "next/server";
import { processMatchPredictionLocks } from "@/lib/match-prediction-report";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return true;
  }

  const authorization = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return authorization === `Bearer ${secret}` || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Cron nao autorizado." },
      { status: 401 },
    );
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        status: "not_configured",
        error: "Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e Supabase.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await processMatchPredictionLocks(client);
    const status = result.status === "error" ? 500 : 200;
    return NextResponse.json({ ok: result.status !== "error", ...result }, { status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : "Falha ao executar cron.",
      },
      { status: 500 },
    );
  }
}
