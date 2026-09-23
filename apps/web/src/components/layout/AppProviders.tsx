"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { useServiceWorker } from "@/hooks/useServiceWorker";

const BARE_ROUTES = ["/login", "/register"];

/**
 * Client providers for the CONVIA app: data layer, toast host and app shell.
 * Auth routes (login/register) and the landing page render without the app shell.
 */
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
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

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {isBare ? children : <AppShell>{children}</AppShell>}
      </ToastProvider>
    </QueryClientProvider>
  );
};
