/**
 * Slash command execution pipeline for the web chat.
 */

import type { GatewayClient } from "@/lib/gatewayClient";

export interface SlashExecResponse {
  output?: string;
  warning?: string;
}

export type CommandDispatchResponse =
  | { type: "exec" | "plugin"; output?: string }
  | { type: "alias"; target: string }
  | { type: "skill"; name: string; message?: string }
  | { type: "send"; message: string };

export interface SlashExecCallbacks {
  sys(text: string): void;
  send(message: string): Promise<void> | void;
}

export interface SlashExecOptions {
  command: string;
  sessionId: string;
  gw: GatewayClient;
  callbacks: SlashExecCallbacks;
}

export type SlashExecResult = "done" | "sent" | "error";

export async function executeSlash({
  command,
  sessionId,
  gw,
  callbacks: { sys, send },
}: SlashExecOptions): Promise<SlashExecResult> {
  const { name, arg } = parseSlash(command);

  if (!name) {
    sys("empty slash command");
    return "error";
  }

  try {
    const r = await gw.request<SlashExecResponse>("slash.exec", {
      command: command.replace(/^\/+/, ""),
      session_id: sessionId,
    });
    const body = r?.output || `/${name}: no output`;
    sys(r?.warning ? `warning: ${r.warning}\n${body}` : body);
    return "done";
  } catch {
    /* fall through to command.dispatch */
  }

  try {
    const d = parseCommandDispatch(
      await gw.request<unknown>("command.dispatch", {
        name,
        arg,
        session_id: sessionId,
      }),
    );

    if (!d) {
      sys("error: invalid response: command.dispatch");
      return "error";
    }

    switch (d.type) {
      case "exec":
      case "plugin":
        sys(d.output ?? "(no output)");
        return "done";

      case "alias":
        return executeSlash({
          command: `/${d.target}${arg ? ` ${arg}` : ""}`,
          sessionId,
          gw,
          callbacks: { sys, send },
        });

      case "skill":
      case "send": {
        const msg = d.message?.trim() ?? "";
        if (!msg) {
          sys(
            `/${name}: ${d.type === "skill" ? "skill payload missing message" : "empty message"}`,
          );
          return "error";
        }
        if (d.type === "skill") sys(`⚡ loading skill: ${d.name}`);
        await send(msg);
        return "sent";
      }
    }
  } catch (err) {
    sys(`error: ${err instanceof Error ? err.message : String(err)}`);
    return "error";
  }
}

export function parseSlash(command: string): { name: string; arg: string } {
  const m = command.replace(/^\/+/, "").match(/^(\S+)\s*(.*)$/);
  return m ? { name: m[1], arg: m[2].trim() } : { name: "", arg: "" };
}

function parseCommandDispatch(raw: unknown): CommandDispatchResponse | null {
  if (!raw || typeof raw !== "object") return null;

  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  switch (r.type) {
    case "exec":
    case "plugin":
      return { type: r.type, output: str(r.output) };

    case "alias":
      return typeof r.target === "string"
        ? { type: "alias", target: r.target }
        : null;

    case "skill":
      return typeof r.name === "string"
        ? { type: "skill", name: r.name, message: str(r.message) }
        : null;

    case "send":
      return typeof r.message === "string"
        ? { type: "send", message: r.message }
        : null;

    default:
      return null;
  }
}
