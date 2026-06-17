import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "wb-surface rounded-xl border border-[var(--wb-border)] bg-[var(--wb-card)] shadow-[0_12px_32px_rgba(7,29,73,0.09)]",
        className,
      )}
      {...props}
    />
  );
}
