"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { isAuthenticated } from "@/lib/auth";

const BARE_ROUTES = ["/login", "/register"];

/**
 * Client providers for the CONVIA app: data layer, toast host and app shell.
 * Auth routes (login/register) and the landing page render without the app shell.
 */
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  useServiceWorker();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const isBare =
    BARE_ROUTES.includes(pathname) ||
    pathname === "/" ||
    pathname.startsWith("/_not-found");

  useEffect(() => {
    if (isBare) {
      setAuthReady(true);
      return;
    }
    if (!isAuthenticated()) {
      setAuthReady(false);
      router.replace("/login");
      return;
    }
    setAuthReady(true);
  }, [isBare, pathname, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {isBare ? children : authReady ? <AppShell>{children}</AppShell> : (
          <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-sm text-ink-secondary" role="status">
            Checking your CONVIA session…
          </div>
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
};
