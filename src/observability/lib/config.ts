function resolveBase(): string {
  const fromEnv = import.meta.env.VITE_OBSERVABILITY_SERVER_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, "");
  return "http://127.0.0.1:4000";
}

export const OBS_SERVER_BASE = resolveBase();

export function obsWsUrl(): string {
  if (OBS_SERVER_BASE.startsWith("/")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${OBS_SERVER_BASE}/stream`;
  }
  return `${OBS_SERVER_BASE.replace(/^http/, "ws")}/stream`;
}

export const OBS_MAX_EVENTS = Number(import.meta.env.VITE_OBS_MAX_EVENTS ?? 300);
