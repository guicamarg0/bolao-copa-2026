import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeTone =
  | "live"
  | "finished"
  | "upcoming"
  | "bet_open"
  | "bet_closed"
  | "game_finished"
  | "admin"
  | "champion"
  | "mvp"
  | "neutral";

const toneClass: Record<BadgeTone, string> = {
  live: "bg-red-50 text-[var(--wb-red)] border border-red-200",
  finished: "bg-green-50 text-[var(--wb-green)] border border-green-200",
  upcoming: "bg-blue-50 text-[var(--wb-primary)] border border-blue-200",
  bet_open: "bg-green-50 text-[var(--wb-green)] border border-green-200",
  bet_closed: "bg-red-50 text-[var(--wb-red)] border border-red-200",
  game_finished: "bg-blue-50 text-[var(--wb-primary)] border border-blue-200",
  admin: "bg-blue-50 text-[var(--wb-primary)] border border-blue-200",
  champion: "bg-amber-50 text-[#9A6B00] border border-amber-200",
  mvp: "bg-amber-50 text-[#9A6B00] border border-amber-200",
  neutral: "bg-slate-50 text-[var(--wb-muted)] border border-[var(--wb-border)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
