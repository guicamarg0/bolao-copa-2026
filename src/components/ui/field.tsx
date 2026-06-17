import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldState = "default" | "error" | "success";

const stateClass: Record<FieldState, string> = {
  default:
    "border-[var(--wb-border)] bg-white text-[var(--wb-text)] placeholder:text-slate-400 focus:border-[var(--wb-primary)]",
  error:
    "border-red-300 bg-red-50 text-[var(--wb-text)] placeholder:text-red-300 focus:border-[var(--wb-red)]",
  success:
    "border-green-300 bg-green-50 text-[var(--wb-text)] placeholder:text-green-400 focus:border-[var(--wb-green)]",
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
        "h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
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
        "h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        stateClass[state],
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
