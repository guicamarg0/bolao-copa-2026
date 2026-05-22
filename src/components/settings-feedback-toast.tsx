"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToastStack, type ToastItem } from "@/components/ui/toast-stack";

interface SettingsFeedbackToastProps {
  successMessage?: string;
  errorMessage?: string;
}

export function SettingsFeedbackToast({
  successMessage,
  errorMessage,
}: SettingsFeedbackToastProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toasts = useMemo<ToastItem[]>(() => {
    const items: ToastItem[] = [];
    if (successMessage) {
      items.push({ id: 1, kind: "success", message: successMessage });
    }
    if (errorMessage) {
      items.push({ id: 2, kind: "error", message: errorMessage });
    }
    return items;
  }, [errorMessage, successMessage]);

  const clearQueryFlags = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cred");
    params.delete("error");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      clearQueryFlags();
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [clearQueryFlags, toasts.length]);

  if (toasts.length === 0) {
    return null;
  }

  return <ToastStack toasts={toasts} onDismiss={clearQueryFlags} />;
}
