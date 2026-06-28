"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiGrid,
  FiMenu,
  FiSettings,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUser,
  FiX,
} from "react-icons/fi";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/logout-button";

export type ShellIconKey =
  | "dashboard"
  | "matches"
  | "predictions"
  | "bets"
  | "history"
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
  bets: FiTrendingUp,
  history: FiClock,
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
        <p className="mt-1 text-xs text-blue-100">Bolao Copa 2026</p>
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
                  ? "border border-white/35 bg-white text-[var(--wb-primary)] shadow-[0_10px_24px_rgba(7,29,73,0.22)]"
                  : "border border-transparent text-blue-100 hover:border-white/20 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "text-base transition-transform duration-200 group-hover:scale-110",
                  active ? "text-[var(--wb-red)]" : "text-blue-100",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 px-5 py-4">
        <p className="text-xs text-blue-100">Sessao ativa</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {viewerName?.trim() ? viewerName : "Convidado"}
        </p>
        <p className="mt-2 inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-blue-100">
          {modeLabel}
        </p>

        <div className="mt-3">
          {viewerId ? (
            <LogoutButton className="w-full justify-center py-2.5 text-sm" />
          ) : (
            <Link
              href="/login"
              onClick={onNavigate}
              className="inline-flex w-full items-center justify-center rounded-lg border border-white/25 bg-white px-3 py-2.5 text-sm font-semibold text-[var(--wb-primary)] transition-colors hover:bg-blue-50"
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-[var(--wb-primary-dark)] bg-[linear-gradient(180deg,var(--wb-primary),var(--wb-primary-dark))] lg:block">
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
          "fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-[var(--wb-primary)] text-white shadow-[0_10px_24px_rgba(7,29,73,0.28)] lg:hidden",
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
              className="fixed inset-y-0 left-0 z-50 w-[min(88vw,22rem)] border-r border-[var(--wb-primary-dark)] bg-[linear-gradient(180deg,var(--wb-primary),var(--wb-primary-dark))] lg:hidden"
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
