import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteAppSession, getAppSessionCookieName } from "@/lib/app-db";

export async function POST() {
  const cookieStore = await cookies();
  const cookieName = getAppSessionCookieName();
  const token = cookieStore.get(cookieName)?.value;
  await deleteAppSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
