import { NextResponse, type NextRequest } from "next/server";
import { getCurrentViewer } from "@/lib/data";
import type { QualificationBetSide } from "@/lib/qualification-bet-types";
import {
  cancelQualificationBet,
  getQualificationBetSnapshot,
  placeQualificationBet,
} from "@/lib/qualification-bets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getAuthenticatedUserId(): Promise<string | null> {
  const viewer = await getCurrentViewer();
  return viewer.id && viewer.isActive ? viewer.id : null;
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao processar aposta.",
    },
    { status: 400 },
  );
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Faca login." }, { status: 401 });
  }

  try {
    const snapshot = await getQualificationBetSnapshot(userId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Faca login." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      matchId?: string;
      selectedSide?: QualificationBetSide;
      stake?: number;
    };

    await placeQualificationBet({
      userId,
      matchId: String(body.matchId ?? ""),
      selectedSide: body.selectedSide as QualificationBetSide,
      stake: Number(body.stake),
    });

    const snapshot = await getQualificationBetSnapshot(userId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Faca login." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { matchId?: string };
    await cancelQualificationBet({
      userId,
      matchId: String(body.matchId ?? ""),
    });

    const snapshot = await getQualificationBetSnapshot(userId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}
