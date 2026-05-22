import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost"
  | "icon";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--wb-electric)] text-white shadow-[0_10px_30px_rgba(29,78,216,0.35)] hover:bg-[#1b44c7]",
  secondary:
    "bg-[color:var(--wb-surface-alt)] text-[var(--wb-ice)] border border-[var(--wb-border)] hover:bg-[color:var(--wb-surface)]",
  success:
    "bg-[var(--wb-green)] text-white shadow-[0_10px_30px_rgba(22,163,74,0.32)] hover:bg-[#0f9441]",
  danger:
    "bg-[var(--wb-red)] text-white shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:bg-[#bb1f1f]",
  ghost:
    "text-[var(--wb-light)] border border-[var(--wb-border)] bg-transparent hover:bg-white/5",
  icon: "bg-[color:var(--wb-surface-alt)] text-[var(--wb-ice)] border border-[var(--wb-border)] hover:bg-[color:var(--wb-surface)]",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}
