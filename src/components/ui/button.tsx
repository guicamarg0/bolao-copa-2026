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
    "bg-[var(--wb-red)] text-white shadow-[0_10px_24px_rgba(230,29,37,0.24)] hover:bg-[#c9161d]",
  secondary:
    "bg-white text-[var(--wb-primary)] border border-[var(--wb-border)] hover:bg-[var(--wb-surface-alt)]",
  success:
    "bg-[var(--wb-green)] text-white shadow-[0_10px_24px_rgba(60,172,59,0.24)] hover:bg-[#2f9630]",
  danger:
    "bg-[var(--wb-red)] text-white shadow-[0_10px_24px_rgba(230,29,37,0.24)] hover:bg-[#c9161d]",
  ghost:
    "text-[var(--wb-primary)] border border-[var(--wb-border)] bg-transparent hover:bg-[#eef4ff]",
  icon: "bg-white text-[var(--wb-primary)] border border-[var(--wb-border)] hover:bg-[var(--wb-surface-alt)]",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}
