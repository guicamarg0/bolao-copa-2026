import { cn } from "@/lib/cn";
import { getTeamInfoByName } from "@/lib/teams";

interface TeamPillProps {
  teamName: string;
  align?: "left" | "center" | "right";
  variant?: "compact" | "feature";
  className?: string;
}

export function TeamPill({
  teamName,
  align = "left",
  variant = "compact",
  className,
}: TeamPillProps) {
  const team = getTeamInfoByName(teamName);
  const alignment =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";

  if (variant === "feature") {
    return (
      <div className={cn("flex min-w-0 items-center gap-3", alignment, className)}>
        <span
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/25 bg-[linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))] text-3xl shadow-[0_8px_24px_rgba(10,24,47,0.45)] md:h-16 md:w-16 md:text-4xl"
          aria-hidden
        >
          {team?.flag ?? "\u{1F3F3}\u{FE0F}"}
        </span>
        <span className="text-lg font-bold leading-tight tracking-tight text-[var(--wb-ice)] md:text-[1.7rem] xl:text-[2rem]">
          {teamName}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", alignment, className)}>
      <span className="text-2xl leading-none md:text-[1.75rem]" aria-hidden>
        {team?.flag ?? "\u{1F3F3}\u{FE0F}"}
      </span>
      <span className="truncate text-sm font-semibold text-[var(--wb-ice)]">
        {teamName}
      </span>
    </div>
  );
}
