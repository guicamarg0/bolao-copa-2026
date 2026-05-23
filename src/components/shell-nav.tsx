"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiGrid,
  FiMenu,
  FiSettings,
  FiShield,
  FiTarget,
  FiUser,
  FiX,
} from "react-icons/fi";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/logout-button";

export type ShellIconKey =
  | "dashboard"
  | "matches"
  | "predictions"
  | "rankings"
  | "profile"
  | "settings"
  | "admin";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: ShellIconKey;
}

interface ShellNavProps {
  items: ShellNavItem[];
  viewerId?: string;
  viewerName?: string;
  modeLabel: string;
}

const iconMap: Record<ShellIconKey, React.ComponentType<{ className?: string }>> = {
  dashboard: FiGrid,
  matches: FiCalendar,
  predictions: FiTarget,
  rankings: FiBarChart2,
  profile: FiUser,
  settings: FiSettings,
  admin: FiShield,
};

function NavContent({
  items,
  pathname,
  viewerId,
  viewerName,
  modeLabel,
  onNavigate,
}: {
  items: ShellNavItem[];
  pathname: string;
  viewerId?: string;
  viewerName?: string;
  modeLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <p className="font-display text-3xl uppercase tracking-[0.12em] text-[var(--wb-ice)]">
          WorldBet 26
        </p>
        <p className="mt-1 text-xs text-slate-300">Plataforma premium de bolao Copa 2026</p>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                active
                  ? "border border-blue-300/45 bg-[linear-gradient(135deg,rgba(29,78,216,0.42),rgba(11,30,58,0.8))] text-white shadow-[0_12px_26px_rgba(29,78,216,0.25)]"
                  : "border border-transparent text-slate-300 hover:border-white/12 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "text-base transition-transform duration-200 group-hover:scale-110",
                  active ? "text-[var(--wb-ice)]" : "text-slate-400",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 px-5 py-4">
        <p className="text-xs text-slate-400">Sessao ativa</p>
        <p className="mt-1 text-sm font-semibold text-slate-200">
          {viewerName?.trim() ? viewerName : "Convidado"}
        </p>
        <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
          {modeLabel}
        </p>

        <div className="mt-3">
          {viewerId ? (
            <LogoutButton className="w-full justify-center py-2.5 text-sm" />
          ) : (
            <Link
              href="/login"
              onClick={onNavigate}
              className="inline-flex w-full items-center justify-center rounded-xl border border-blue-300/35 bg-blue-500/20 px-3 py-2.5 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-500/30"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShellNav({ items, viewerId, viewerName, modeLabel }: ShellNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-[linear-gradient(180deg,#0B1E3A,#102347,#0F1F3A)] lg:block">
        <NavContent
          items={items}
          pathname={pathname}
          viewerId={viewerId}
          viewerName={viewerName}
          modeLabel={modeLabel}
        />
      </aside>

      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-[#0b1e3adf] text-white shadow-[0_10px_24px_rgba(3,9,22,0.4)] lg:hidden",
          open ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <FiMenu className="text-lg" />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Fechar menu"
              className="fixed inset-0 z-50 bg-black/65 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[min(88vw,22rem)] border-r border-white/10 bg-[linear-gradient(180deg,#0B1E3A,#102347,#0F1F3A)] lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 340, damping: 35 }}
            >
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white"
              >
                <FiX />
              </button>
              <NavContent
                items={items}
                pathname={pathname}
                viewerId={viewerId}
                viewerName={viewerName}
                modeLabel={modeLabel}
                onNavigate={() => setOpen(false)}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
