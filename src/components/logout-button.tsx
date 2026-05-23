"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isSupabaseConfigured } from "@/lib/supabase-env";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();
  const supabaseEnabled = isSupabaseConfigured();

  async function handleLogout() {
    if (supabaseEnabled) {
      const client = getSupabaseBrowserClient();
      if (client) {
        await client.auth.signOut();
      }
    } else {
      await fetch("/api/local-auth/logout", {
        method: "POST",
      });
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={cn(
        "rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10",
        className,
      )}
    >
      Sair
    </button>
  );
}
