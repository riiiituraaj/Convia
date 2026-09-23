"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        source = new EventSource(`${API_BASE}/activity/stream`);
      } catch {
        scheduleRetry();
        return;
      }

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; payload?: unknown };
          invalidateForEvent(queryClient, data.type, data.payload);
        } catch {
          // Malformed event — ignore.
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (disposed || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, 5000);
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
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
    // Unknown event type — refresh everything lightweight.
    queryClient.invalidateQueries();
  }
}
