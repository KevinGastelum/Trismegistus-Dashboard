import { useState } from "react";
import {
  MessageSquare,
  Activity,
  Cpu,
  FileText,
  Radio,
  Eye,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button } from "@nous-research/ui/ui/components/button";

// Import sub-pages
import SessionsPage from "@/pages/SessionsPage";
import ModelsPage from "@/pages/ModelsPage";
import LogsPage from "@/pages/LogsPage";
import ChannelsPage from "@/pages/ChannelsPage";
import ObservabilityPage from "@/observability/pages/ObservabilityPage";

type SubTab = "sessions" | "agents" | "observability" | "models" | "logs" | "channels";

interface TabConfig {
  id: SubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SUB_TABS: TabConfig[] = [
  { id: "sessions", label: "Active Sessions", icon: MessageSquare },
  { id: "agents", label: "Agent Status", icon: Activity },
  { id: "observability", label: "Observability", icon: Eye },
  { id: "models", label: "Models & Telemetry", icon: Cpu },
  { id: "logs", label: "System Logs", icon: FileText },
  { id: "channels", label: "Integrations", icon: Radio },
];

export default function WorkflowPage() {
  const { activeProject } = useActiveWorkspace();
  const [activeTab, setActiveTab] = useState<SubTab>("sessions");

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sub-tab Selector */}
      <div className="flex border border-border bg-muted/10 p-1 gap-1 self-start flex-wrap">
        {SUB_TABS.map((tab) => (
          <Button
            key={tab.id}
            ghost={activeTab !== tab.id}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="rounded-none border-pantheon-single flex items-center gap-1.5"
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* Content pane */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "sessions" && <SessionsPage />}
        
        {activeTab === "agents" && (
          <div className="p-4 border border-pantheon bg-muted/5 text-xs text-text-secondary">
            <h3 className="font-serif-display text-sm text-primary mb-2">Active Background Agents</h3>
            <p className="mb-2">Active daemon loops and autonomous tasks for the selected workspace ({activeProject}):</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="text-primary font-mono font-bold">Labyrinth loop-1:</span> Checking filesystem for custom configs. (Running: 3m 4s)</li>
              <li><span className="text-primary font-mono font-bold">Mercury auto-sync:</span> Pushing commits to feat/observability-tab. (Idle)</li>
            </ul>
          </div>
        )}

        {activeTab === "observability" && (
          <div className="border border-pantheon bg-[#031919]/25 p-1 h-[650px] flex flex-col min-w-0 overflow-hidden">
            <ObservabilityPage />
          </div>
        )}

        {activeTab === "models" && <ModelsPage />}
        {activeTab === "logs" && <LogsPage />}
        {activeTab === "channels" && <ChannelsPage />}
      </div>
    </div>
  );
}
