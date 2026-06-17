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
  { href: "/palpites-fechados", label: "Palpites Fechados", icon: "predictions" },
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
    <div className="min-h-screen bg-[var(--wb-bg)] text-[var(--wb-text)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(18,59,122,0.12),transparent_38%),radial-gradient(circle_at_90%_18%,rgba(60,172,59,0.12),transparent_34%),radial-gradient(circle_at_50%_120%,rgba(245,183,0,0.14),transparent_36%)]" />

      <ShellNav
        items={visibleNavItems}
        viewerId={viewer?.id}
        viewerName={viewer?.displayName}
        modeLabel={modeLabel}
      />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 hidden border-b border-[var(--wb-border)] bg-white/88 backdrop-blur-xl md:block">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-4 pt-5 pl-16 md:px-7 md:pl-16 lg:pl-7">
            <div>
              <h1 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl md:text-4xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="max-w-3xl text-sm text-[var(--wb-muted)] md:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <main className="wb-app-content mx-auto w-full max-w-[1600px] px-4 pb-10 pt-16 md:px-7 md:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
