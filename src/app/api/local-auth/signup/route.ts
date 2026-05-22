import { NextResponse } from "next/server";
import {
  createAppSession,
  createAppUser,
  getAppSessionCookieName,
} from "@/lib/app-db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      password?: string;
    };

    const user = await createAppUser({
      username: body.username ?? "",
      displayName: body.displayName ?? "",
      password: body.password ?? "",
    });
    const token = await createAppSession(user.id);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      },
    });

    response.cookies.set(getAppSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao cadastrar.",
      },
      { status: 400 },
    );
  }
}
