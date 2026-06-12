import { useEffect, useState } from "react";
import { Plus, FileText, Save } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { HERMES_BASE_PATH } from "@/lib/api";

interface DeityCard {
  id: string;
  name: string;
  role: string;
  description: string;
  image: string;
}

const DEITIES: DeityCard[] = [
  {
    id: "labyrinth",
    name: "Labyrinth",
    role: "Deep Research Loops",
    description: "Guides agents through complex, recursive search loops to unearth hidden patterns and solve deep technical queries.",
    image: "/images/labyrinth.png",
  },
  {
    id: "mercury",
    name: "Mercury",
    role: "Autopilot & Cron Tasks",
    description: "Executes automated crons, triggers, and scheduled daemons swiftly. The messenger that drives runtime workflows.",
    image: "/images/mercury.png",
  },
  {
    id: "philosopher",
    name: "Philosopher",
    role: "Deep Reasoning & Audit",
    description: "Applies logical frameworks to trace problems, review complex codebases, and maintain theoretical consistency.",
    image: "/images/philosopher.png",
  },
  {
    id: "orpheus",
    name: "Orpheus",
    role: "Creative Logic & Speech",
    description: "Orchestrates reasoning across diverse topic boundaries, translating complex data trees into human-centered wisdom.",
    image: "/images/orpheus.png",
  },
];

const AVATARS = [
  { id: "oracle", name: "Oracle", image: "/images/oracle.png", desc: "Prophetic insights and pattern recognition" },
  { id: "athena", name: "Athena", image: "/images/athena.png", desc: "Tactical coding strategies and governance" },
  { id: "alchemist", name: "Alchemist", image: "/images/alchemist.png", desc: "Data mutations and backend synthesis" },
];

export default function AgentsPage() {
  const [activeDeity, setActiveDeity] = useState<string>("labyrinth");
  const [agentsConfig, setAgentsConfig] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>("CLAUDE.md");
  const [fileContent, setFileContent] = useState<string>("");
  const [editingContent, setEditingContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("oracle");

  // Fetch agent configs from our Vite proxy middleware
  useEffect(() => {
    fetch("/api/custom/agents")
      .then((res) => res.json())
      .then((data) => {
        setAgentsConfig(data);
        if (data[selectedFile]) {
          setFileContent(data[selectedFile]);
          setEditingContent(data[selectedFile]);
        }
      })
      .catch((err) => console.error("Failed to load agent configurations:", err));
  }, [selectedFile]);

  const handleSave = () => {
    setIsSaving(true);
    // In dev mode, we can save or just simulate
    setTimeout(() => {
      setIsSaving(false);
      setFileContent(editingContent);
    }, 800);
  };

  const handleAddAgent = () => {
    if (!newAgentName) return;
    // Add new deity mock card
    alert(`Added Persona: ${newAgentName} with ${selectedAvatar} avatar.`);
    setShowAddDrawer(false);
    setNewAgentName("");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Visual Gallery of Deity Cards */}
      <div>
        <h2 className="font-serif-display text-display text-lg tracking-[0.1em] text-primary mb-4">
          THE GREEK PANTHEON OF AGENTS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEITIES.map((deity) => {
            const isActive = activeDeity === deity.id;
            return (
              <div
                key={deity.id}
                onClick={() => setActiveDeity(deity.id)}
                className={`card-engraving p-4 cursor-pointer relative flex flex-col justify-between min-h-[340px] border-pantheon ${
                  isActive ? "border-primary border-pantheon" : "border-border"
                }`}
              >
                {/* Deity Illustration */}
                <div className="w-full h-44 overflow-hidden mb-3 border border-border/20 bg-muted/10 relative">
                  <img
                    src={`${HERMES_BASE_PATH}${deity.image}`}
                    alt={deity.name}
                    className="woodcut-img w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background-base via-transparent to-transparent opacity-60" />
                </div>

                <div>
                  <div className="font-serif-display text-sm font-bold tracking-[0.08em] text-primary">
                    {deity.name.toUpperCase()}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-text-tertiary mb-2">
                    {deity.role}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {deity.description}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Add Persona Trigger Card */}
          <div
            onClick={() => setShowAddDrawer(true)}
            className="border-pantheon border border-dashed border-border/60 hover:border-primary/80 flex flex-col items-center justify-center p-6 cursor-pointer min-h-[340px] transition-colors"
          >
            <div className="p-3 border border-dashed border-border rounded-none mb-3">
              <Plus className="h-6 w-6 text-text-tertiary" />
            </div>
            <span className="font-serif-display text-sm tracking-wider text-text-secondary">
              ADD PERSONA
            </span>
            <p className="text-[10px] text-text-tertiary mt-1 text-center max-w-[150px]">
              Evoke a new deity template (Oracle, Athena, Alchemist)
            </p>
          </div>
        </div>
      </div>

      {/* Claude Code Config / Agent Guide Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Files Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          <h3 className="font-serif-display text-display text-sm tracking-wider text-primary mb-2">
            WORKSPACE GUIDES
          </h3>
          <div className="flex flex-col border border-border bg-muted/10 p-2 gap-1">
            {["AGENTS.md", "CLAUDE.md", "GEMINI.md"].map((file) => (
              <button
                key={file}
                onClick={() => {
                  setSelectedFile(file);
                  if (agentsConfig[file]) {
                    setFileContent(agentsConfig[file]);
                    setEditingContent(agentsConfig[file]);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 text-left text-xs rounded-none ${
                  selectedFile === file
                    ? "bg-primary text-background-base font-bold"
                    : "text-text-secondary hover:bg-muted/30"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>{file}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor Panel */}
        <div className="lg:col-span-2">
          <Card className="rounded-none border-pantheon">
            <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono tracking-wider text-primary">
                {selectedFile.toUpperCase()} EDITOR
              </CardTitle>
              <Button
                size="xs"
                onClick={handleSave}
                disabled={isSaving || editingContent === fileContent}
                className="rounded-none flex items-center gap-1 border-pantheon-single"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="w-full h-80 bg-transparent text-xs p-4 font-mono leading-relaxed focus-visible:outline-none placeholder:text-muted-foreground resize-none"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Persona Drawer Modal */}
      {showAddDrawer && (
        <div className="fixed inset-0 bg-background-base/80 flex items-center justify-center z-50 p-4">
          <div className="bg-background-base border border-border p-6 max-w-md w-full relative border-pantheon">
            <h3 className="font-serif-display text-sm tracking-widest text-primary mb-4">
              SUMMON NEW PERSONA
            </h3>
            
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary font-bold">NAME OF THE DEITY</label>
                <input
                  type="text"
                  placeholder="e.g. Apollo"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="bg-transparent border border-border p-2 focus:outline-none focus:border-primary text-text-primary"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-text-secondary font-bold">SELECT TEMPLATE SOUL</label>
                <div className="grid grid-cols-3 gap-2">
                  {AVATARS.map((avatar) => (
                    <div
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={`border p-2 cursor-pointer text-center hover:border-primary flex flex-col items-center justify-between ${
                        selectedAvatar === avatar.id ? "border-primary bg-muted/10" : "border-border"
                      }`}
                    >
                      <span className="font-serif-display font-bold text-[10px] mb-1">
                        {avatar.name.toUpperCase()}
                      </span>
                      <p className="text-[8px] text-text-tertiary leading-tight">
                        {avatar.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  ghost
                  size="sm"
                  onClick={() => setShowAddDrawer(false)}
                  className="rounded-none border border-pantheon-single"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddAgent}
                  disabled={!newAgentName}
                  className="rounded-none border border-pantheon-single"
                >
                  Summon
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
