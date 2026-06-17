/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";
import { getTeamFlagAssetByName, getTeamInfoByName } from "@/lib/teams";

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
  const flag = getTeamFlagAssetByName(teamName);
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
          className="inline-flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--wb-border)] bg-white shadow-[0_6px_16px_rgba(7,29,73,0.16)] md:h-12 md:w-16"
          aria-hidden
        >
          {flag ? (
            <img
              src={flag.src}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-xs font-bold text-[var(--wb-primary)]">
              {team?.code ?? "FIFA"}
            </span>
          )}
        </span>
        <span className="min-w-0 text-base font-bold leading-tight tracking-normal text-[var(--wb-text)] sm:text-lg md:text-xl xl:text-2xl">
          {teamName}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", alignment, className)}>
      <span
        className="inline-flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--wb-border)] bg-white"
        aria-hidden
      >
        {flag ? (
          <img
            src={flag.src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-[9px] font-bold text-[var(--wb-primary)]">
            {team?.code ?? "FIFA"}
          </span>
        )}
      </span>
      <span className="truncate text-sm font-semibold text-[var(--wb-text)]">
        {teamName}
      </span>
    </div>
  );
}
