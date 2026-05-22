import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--wb-border)] bg-[var(--wb-surface)]/90 shadow-[0_16px_48px_rgba(3,9,22,0.35)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
