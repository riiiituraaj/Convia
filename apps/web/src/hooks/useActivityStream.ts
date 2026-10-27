"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession, getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Subscribes to the backend SSE stream (`GET /activity/stream`) and
 * invalidates the relevant React Query caches when events arrive.
 *
 * Fails silently if the stream is unreachable — the app remains fully
 * usable with manual refresh / window focus refetch disabled.
 */
export function useActivityStream(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let controller: AbortController | null = null;

    const connect = async () => {
      if (disposed) return;
      const token = getToken();
      if (!token) return;
      controller = new AbortController();
      try {
        const response = await fetch(`${API_BASE}/activity/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401) {
          clearSession();
          window.location.assign("/login");
          return;
        }
        if (!response.ok || !response.body) throw new Error(`Activity stream returned ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!disposed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";
          for (const message of messages) {
            const dataLine = message.split("\n").find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const data = JSON.parse(dataLine.slice(5).trim()) as { type?: string; payload?: unknown };
              invalidateForEvent(queryClient, data.type, data.payload);
            } catch {
              // Ignore malformed events and keep the authenticated stream open.
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!disposed) scheduleRetry();
      } finally {
        controller = null;
      }
      if (!disposed) scheduleRetry();
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, 5000);
    };

    void connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
    };
  }, [queryClient]);
}

function invalidateForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  type?: string,
  _payload?: unknown
): void {
  if (!type) return;

  if (type.startsWith("commitment.") || type === "commitment.updated") {
    queryClient.invalidateQueries({ queryKey: ["commitments"] });
    queryClient.invalidateQueries({ queryKey: ["waiting"] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
  } else if (type.startsWith("mission.")) {
    queryClient.invalidateQueries({ queryKey: ["missions"] });
  } else if (type.startsWith("risk.") || type.startsWith("approval.")) {
    queryClient.invalidateQueries({ queryKey: ["risks"] });
    queryClient.invalidateQueries({ queryKey: ["actions"] });
    queryClient.invalidateQueries({ queryKey: ["commitments"] });
  } else if (type.startsWith("action.")) {
    queryClient.invalidateQueries({ queryKey: ["actions"] });
    queryClient.invalidateQueries({ queryKey: ["commitments"] });
  } else if (type.startsWith("agent.") || type.startsWith("run.")) {
    queryClient.invalidateQueries({ queryKey: ["agentRuns"] });
  } else if (type.startsWith("memory.")) {
    queryClient.invalidateQueries({ queryKey: ["memory"] });
    queryClient.invalidateQueries({ queryKey: ["memories"] });
  } else {
    queryClient.invalidateQueries();
  }
}
