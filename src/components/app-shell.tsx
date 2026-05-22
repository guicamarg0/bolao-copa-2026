import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { ShellNav, type ShellNavItem } from "@/components/shell-nav";
import { getStorageMode } from "@/lib/storage-mode";
import type { Viewer } from "@/lib/types";

interface AppShellProps {
  title: string;
  subtitle?: string;
  viewer?: Viewer;
  children: React.ReactNode;
}

const navItems: ShellNavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/jogos", label: "Jogos", icon: "matches" },
  { href: "/palpites", label: "Palpites", icon: "predictions" },
  { href: "/ranking", label: "Rankings", icon: "rankings" },
  { href: "/perfil", label: "Meu Perfil", icon: "profile" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
  { href: "/admin", label: "Painel Admin", icon: "admin" },
];

export function AppShell({ title, subtitle, viewer, children }: AppShellProps) {
  const storageMode = getStorageMode();
  const modeLabel =
    storageMode === "supabase"
      ? "Supabase"
      : storageMode === "postgres"
        ? "PostgreSQL"
        : "SQLite";

  const visibleNavItems = navItems.filter(
    (item) => item.href !== "/admin" || Boolean(viewer?.isAdmin),
  );

  return (
    <div className="min-h-screen bg-[var(--wb-bg)] text-[var(--wb-ice)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(29,78,216,0.28),transparent_38%),radial-gradient(circle_at_90%_18%,rgba(22,163,74,0.2),transparent_34%),radial-gradient(circle_at_50%_120%,rgba(212,160,23,0.22),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(115deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(155deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px]" />

      <ShellNav
        items={visibleNavItems}
        viewerName={viewer?.displayName}
        modeLabel={modeLabel}
      />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(9,20,39,0.75)] backdrop-blur-xl">
          <div className="mx-auto w-full px-4 py-4 pl-16 md:px-7 md:pl-16 lg:pl-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="font-display text-3xl uppercase tracking-[0.08em] md:text-4xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-sm text-slate-300 md:text-base">{subtitle}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!viewer?.id ? (
                  <Link
                    href="/login"
                    className="rounded-xl border border-blue-300/40 bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/30"
                  >
                    Entrar
                  </Link>
                ) : (
                  <LogoutButton />
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full px-4 pb-10 pt-6 md:px-7">{children}</main>
      </div>
    </div>
  );
}
