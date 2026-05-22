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
  live: "bg-red-500/20 text-red-300 border border-red-400/40",
  finished: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40",
  upcoming: "bg-blue-500/20 text-blue-200 border border-blue-400/40",
  bet_open: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/50",
  bet_closed: "bg-red-500/20 text-red-200 border border-red-400/50",
  game_finished: "bg-blue-500/20 text-blue-200 border border-blue-400/50",
  admin: "bg-indigo-500/20 text-indigo-200 border border-indigo-400/40",
  champion: "bg-amber-500/20 text-amber-200 border border-amber-300/60",
  mvp: "bg-violet-500/20 text-violet-200 border border-violet-400/40",
  neutral: "bg-white/10 text-slate-200 border border-white/15",
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
