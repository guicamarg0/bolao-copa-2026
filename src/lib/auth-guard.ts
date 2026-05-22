import { redirect } from "next/navigation";
import { getCurrentViewer } from "@/lib/data";
import type { Viewer } from "@/lib/types";

export async function requireAuthenticatedViewer(): Promise<Viewer> {
  const viewer = await getCurrentViewer();
  if (!viewer.id || !viewer.isActive) {
    redirect("/login");
  }
  return viewer;
}

export async function redirectIfAuthenticated(): Promise<void> {
  const viewer = await getCurrentViewer();
  if (viewer.id && viewer.isActive) {
    redirect("/");
  }
}
