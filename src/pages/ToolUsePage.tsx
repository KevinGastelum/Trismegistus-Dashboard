import { useState } from "react";
import {
  Clock,
  Compass,
  Cpu,
  Puzzle,
  Activity,
  Scroll,
  Ban,
  Heart,
  Terminal,
  Webhook,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

// Import original pages
import CronPage from "@/pages/CronPage";
import SkillsPage from "@/pages/SkillsPage";
import PluginsPage from "@/pages/PluginsPage";
import McpPage from "@/pages/McpPage";
import WebhooksPage from "@/pages/WebhooksPage";

type ToolTab =
  | "cron"
  | "skills"
  | "plugins"
  | "mcp"
  | "triggers"
  | "rules"
  | "constraints"
  | "heartbeats"
  | "daemons"
  | "webhooks";

interface TabConfig {
  id: ToolTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabConfig[] = [
  { id: "cron", label: "Cron Jobs", icon: Clock },
  { id: "skills", label: "Skills", icon: Compass },
  { id: "plugins", label: "Plugins", icon: Puzzle },
  { id: "mcp", label: "MCP Servers", icon: Cpu },
  { id: "triggers", label: "Triggers", icon: Activity },
  { id: "rules", label: "Rules & Guidelines", icon: Scroll },
  { id: "constraints", label: "Constraints", icon: Ban },
  { id: "heartbeats", label: "Heartbeats", icon: Heart },
  { id: "daemons", label: "Daemons", icon: Terminal },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
];

export default function ToolUsePage() {
  const [activeTab, setActiveTab] = useState<ToolTab>("cron");
  const [levelFilter, setLevelFilter] = useState<"all" | "project" | "global" | "system">("all");

  const activeIndex = TABS.findIndex((t) => t.id === activeTab);

  const handlePrev = () => {
    const nextIdx = (activeIndex - 1 + TABS.length) % TABS.length;
    setActiveTab(TABS[nextIdx].id);
  };

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % TABS.length;
    setActiveTab(TABS[nextIdx].id);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Horizontal sequential navigation at the top */}
      <div className="flex items-center justify-between border border-border bg-muted/10 p-2">
        <Button
          ghost
          size="sm"
          onClick={handlePrev}
          className="rounded-none border-pantheon-single flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous Tab</span>
        </Button>
        <span className="font-serif-display text-display text-sm font-bold tracking-[0.1em] text-primary">
          {TABS[activeIndex].label.toUpperCase()}
        </span>
        <Button
          ghost
          size="sm"
          onClick={handleNext}
          className="rounded-none border-pantheon-single flex items-center gap-1"
        >
          <span>Next Tab</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main layout: left sub-tabs + right content */}
      <div className="flex flex-col md:flex-row gap-4 flex-1">
        {/* Left Sub-Tab bar */}
        <aside aria-label="Tool category sub-tabs" className="md:w-56 md:shrink-0">
          <div className="flex md:flex-col border border-border bg-muted/20 p-2 gap-1 overflow-x-auto md:overflow-x-visible scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors rounded-none whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-background-base font-bold"
                      : "text-text-secondary hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right side content pane */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Level Filter (Project, Global, System) */}
          <div className="flex border border-border bg-muted/10 p-1 gap-1 self-start">
            {(["all", "project", "global", "system"] as const).map((lvl) => (
              <Button
                key={lvl}
                ghost={levelFilter !== lvl}
                size="xs"
                onClick={() => setLevelFilter(lvl)}
                className="rounded-none capitalize text-xs"
              >
                {lvl}
              </Button>
            ))}
          </div>

          <div className="flex-1">
            {activeTab === "cron" && <CronPage />}
            {activeTab === "skills" && <SkillsPage />}
            {activeTab === "plugins" && <PluginsPage />}
            {activeTab === "mcp" && <McpPage />}
            {activeTab === "webhooks" && <WebhooksPage />}

            {/* Mocked/rendered tabs for Daemons/Triggers/Constraints/Rules/Heartbeats */}
            {activeTab === "triggers" && (
              <Card className="rounded-none border-pantheon">
                <CardHeader>
                  <CardTitle className="text-sm font-serif-display">System Triggers</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-text-secondary">
                  <p className="mb-2">List of event triggers configured for agent activations:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-primary font-mono">on_commit:</span> Fires when a git commit occurs in the selected workspace. (Level: Project)</li>
                    <li><span className="text-primary font-mono">on_alert:</span> Fires when cpu or memory metrics breach threshold. (Level: Global)</li>
                    <li><span className="text-primary font-mono">on_user_message:</span> Fires when a message is submitted by the user. (Level: System)</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {activeTab === "rules" && (
              <Card className="rounded-none border-pantheon">
                <CardHeader>
                  <CardTitle className="text-sm font-serif-display">Rules & Constraints</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-text-secondary">
                  <p className="mb-2">System and project rules currently applied to LLM generations:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-primary font-bold">Verbatim Module Syntax:</span> Import type-only symbols with 'import type'. (Level: Project)</li>
                    <li><span className="text-primary font-bold">No Placeholders:</span> Write complete and working code demonstrations. (Level: Global)</li>
                    <li><span className="text-primary font-bold">Security Boundary:</span> Deny arbitrary filesystem access outside workspace. (Level: System)</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {activeTab === "constraints" && (
              <Card className="rounded-none border-pantheon">
                <CardHeader>
                  <CardTitle className="text-sm font-serif-display">System Constraints</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-text-secondary">
                  <p className="mb-2">Environmental boundary conditions enforced on the agent runtime:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-primary font-mono">max_token_limit:</span> 8192 tokens per execution request. (Level: System)</li>
                    <li><span className="text-primary font-mono">file_write_blacklist:</span> Excludes System directories and configuration root folders. (Level: Global)</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {activeTab === "heartbeats" && (
              <Card className="rounded-none border-pantheon">
                <CardHeader>
                  <CardTitle className="text-sm font-serif-display">Heartbeat Diagnostics</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-text-secondary">
                  <p className="mb-2">Active daemon keep-alives and ping checks:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-primary font-bold">Web Server Ping:</span> 127.0.0.1:9119 is online. (Interval: 10s)</li>
                    <li><span className="text-primary font-bold">Obs WebSocket Ping:</span> 127.0.0.1:4000 is connected. (Interval: 5s)</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {activeTab === "daemons" && (
              <Card className="rounded-none border-pantheon">
                <CardHeader>
                  <CardTitle className="text-sm font-serif-display">Background Daemons</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-text-secondary">
                  <p className="mb-2">Daemons running in background to orchestrate tasks:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><span className="text-primary font-bold">hermes-gateway:</span> Running on PID 12489 (Uptime: 4h 12m). (Level: System)</li>
                    <li><span className="text-primary font-bold">obs-collector:</span> Running on PID 13092 (Uptime: 2h 45m). (Level: Global)</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
