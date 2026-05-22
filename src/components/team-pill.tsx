import { getTeamInfoByName } from "@/lib/teams";
import { cn } from "@/lib/cn";

interface TeamPillProps {
  teamName: string;
  align?: "left" | "center" | "right";
  className?: string;
}

export function TeamPill({ teamName, align = "left", className }: TeamPillProps) {
  const team = getTeamInfoByName(teamName);
  const alignment =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";

  return (
    <div className={cn("flex items-center gap-2", alignment, className)}>
      <span className="text-base leading-none" aria-hidden>
        {team?.flag ?? "🏳️"}
      </span>
      <span className="truncate text-sm font-semibold text-[var(--wb-ice)]">
        {teamName}
      </span>
    </div>
  );
}
