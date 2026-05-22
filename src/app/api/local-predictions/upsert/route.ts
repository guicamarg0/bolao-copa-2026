import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAppSessionCookieName,
  getAppViewerBySessionToken,
  upsertAppPrediction,
} from "@/lib/app-db";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getAppSessionCookieName())?.value;
    const viewer = await getAppViewerBySessionToken(token);

    if (!viewer?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faça login para salvar palpites.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      matchId?: string;
      homeGoals?: number;
      awayGoals?: number;
    };

    const prediction = await upsertAppPrediction({
      userId: viewer.id,
      matchId: String(body.matchId ?? ""),
      homeGoals: Number(body.homeGoals),
      awayGoals: Number(body.awayGoals),
    });

    return NextResponse.json({ ok: true, prediction });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o palpite.",
      },
      { status: 400 },
    );
  }
}
