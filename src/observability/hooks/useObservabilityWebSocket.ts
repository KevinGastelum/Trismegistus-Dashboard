import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { obsWsUrl, OBS_MAX_EVENTS } from "../lib/config";
import type { HookEvent, WebSocketMessage } from "../lib/types";

export function useObservabilityWebSocket() {
  const [events, setEvents] = useState<HookEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUs = useRef(false);
  // Stable ref so onclose can schedule reconnects without a self-referential closure
  const connectRef = useRef<() => void>(() => { /* populated by useLayoutEffect below */ });

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(obsWsUrl());
      wsRef.current = ws;
      ws.onopen = () => { setIsConnected(true); setError(null); };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WebSocketMessage;
          if (msg.type === "initial") {
            const arr = Array.isArray(msg.data) ? (msg.data as HookEvent[]) : [];
            setEvents(arr.slice(-OBS_MAX_EVENTS));
          } else if (msg.type === "event") {
            const incoming = msg.data as HookEvent;
            setEvents((prev) => {
              // C4: upsert by id so C2 re-broadcasts update the row
              if (incoming.id != null) {
                const idx = prev.findIndex((e) => e.id === incoming.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = incoming;
                  return next;
                }
              }
              const next = [...prev, incoming];
              return next.length > OBS_MAX_EVENTS ? next.slice(next.length - OBS_MAX_EVENTS) : next;
            });
          }
        } catch { /* ignore malformed frame */ }
      };
      ws.onerror = () => setError("event server offline");
      ws.onclose = () => {
        setIsConnected(false);
        // C4: guard by socket identity — StrictMode double-mounts create stale closures
        if (closedByUs.current || wsRef.current !== ws) return;
        reconnectRef.current = setTimeout(() => connectRef.current(), 3000);
      };
    } catch {
      setError("event server offline");
      reconnectRef.current = setTimeout(() => connectRef.current(), 3000);
    }
  }, []);

  // Keep connectRef current without touching it during render
  useLayoutEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    closedByUs.current = false;
    // Defer so setState calls inside connect() are never synchronous in the effect body
    const id = setTimeout(() => connectRef.current(), 0);
    return () => {
      clearTimeout(id);
      closedByUs.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);
  return { events, isConnected, error, clearEvents };
}
