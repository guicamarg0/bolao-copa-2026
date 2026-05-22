"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";
import { cn } from "@/lib/cn";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const kindStyle: Record<ToastKind, string> = {
  success: "border-emerald-300/40 bg-emerald-500/20 text-emerald-50",
  error: "border-red-400/45 bg-red-500/20 text-red-50",
  warning: "border-amber-300/45 bg-amber-500/20 text-amber-50",
  info: "border-blue-300/45 bg-blue-500/20 text-blue-50",
};

function kindIcon(kind: ToastKind) {
  if (kind === "success") {
    return <FiCheckCircle className="text-base" />;
  }
  if (kind === "error") {
    return <FiAlertTriangle className="text-base" />;
  }
  if (kind === "warning") {
    return <FiAlertTriangle className="text-base" />;
  }
  return <FiInfo className="text-base" />;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            className={cn(
              "pointer-events-auto rounded-xl border px-3 py-2 shadow-[0_16px_44px_rgba(0,0,0,0.28)] backdrop-blur",
              kindStyle[toast.kind],
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{kindIcon(toast.kind)}</div>
              <p className="flex-1 text-sm">{toast.message}</p>
              <button
                type="button"
                aria-label="Fechar toast"
                onClick={() => onDismiss(toast.id)}
                className="rounded-md p-1 hover:bg-black/15"
              >
                <FiX className="text-sm" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
