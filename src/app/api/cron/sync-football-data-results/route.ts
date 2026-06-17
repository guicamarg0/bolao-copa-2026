import { NextResponse, type NextRequest } from "next/server";
import { syncFootballDataFinalResults } from "@/lib/football-data-sync";

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

  try {
    const result = await syncFootballDataFinalResults();
    const status = result.status === "error" ? 500 : 200;
    return NextResponse.json({ ok: result.status !== "error", ...result }, { status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Falha ao sincronizar football-data.org.",
      },
      { status: 500 },
    );
  }
}
