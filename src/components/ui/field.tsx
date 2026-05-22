import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldState = "default" | "error" | "success";

const stateClass: Record<FieldState, string> = {
  default:
    "border-[var(--wb-border)] bg-[var(--wb-surface-alt)] text-[var(--wb-ice)] placeholder:text-slate-400 focus:border-[var(--wb-electric)]",
  error:
    "border-red-400/70 bg-red-500/10 text-red-100 placeholder:text-red-200/80 focus:border-red-300",
  success:
    "border-emerald-400/70 bg-emerald-500/10 text-emerald-100 placeholder:text-emerald-200/90 focus:border-emerald-300",
};

interface BaseFieldProps {
  state?: FieldState;
}

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    BaseFieldProps {}

export function Input({ className, state = "default", ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border px-3 text-sm outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        stateClass[state],
        className,
      )}
      {...props}
    />
  );
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    BaseFieldProps {}

export function Select({
  className,
  state = "default",
  children,
  ...props
}: SelectProps) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border px-3 text-sm outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        stateClass[state],
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
