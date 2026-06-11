import { useEffect, useState } from "react";
import { Folder, FileText, ChevronRight, Search, X, BookOpen } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";

interface DocItem {
  name: string;
  type: "file" | "directory";
  size?: number;
  path?: string;
  children?: DocItem[];
}

export default function DocumentsPage() {
  const [rootItems, setRootItems] = useState<DocItem[]>([]);
  const [currentItems, setCurrentItems] = useState<DocItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; items: DocItem[] }[]>([
    { name: "Root", items: [] },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Fetch file list
  useEffect(() => {
    fetch("/api/custom/docs")
      .then((res) => res.json())
      .then((data) => {
        setRootItems(data);
        setCurrentItems(data);
        setBreadcrumbs([{ name: "Root", items: data }]);
      })
      .catch((err) => console.error("Failed to load documents:", err));
  }, []);

  const handleFolderClick = (item: DocItem) => {
    if (item.type === "directory" && item.children) {
      setCurrentItems(item.children);
      setBreadcrumbs((prev) => [...prev, { name: item.name, items: item.children! }]);
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    const target = breadcrumbs[idx];
    setCurrentItems(target.items);
    setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
  };

  const handleFileClick = (item: DocItem) => {
    if (item.type === "file" && item.path) {
      setSelectedFileName(item.name);
      setSelectedFile(item.path);
      setIsLoadingContent(true);
      fetch(`/api/custom/docs/read?file=${encodeURIComponent(item.path)}`)
        .then((res) => res.text())
        .then((text) => {
          setFileContent(text);
          setIsLoadingContent(false);
        })
        .catch((err) => {
          console.error("Failed to read file:", err);
          setFileContent("Error: Failed to load file content.");
          setIsLoadingContent(false);
        });
    }
  };

  // Determine folder cover woodcut
  const getFolderCover = (name: string): string => {
    const lc = name.toLowerCase();
    if (lc.includes("task") || lc.includes("todo") || lc.includes("job")) {
      return "/images/abacus.png";
    }
    if (lc.includes("tool") || lc.includes("mcp") || lc.includes("config")) {
      return "/images/astrolabe.png";
    }
    return "/images/book_quill.png";
  };

  // Filter items based on search query
  const filteredItems = currentItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border bg-muted/10 p-4">
        <div>
          <h2 className="font-serif-display text-display text-lg tracking-[0.1em] text-primary">
            LOCAL DOCUMENTS EXPLORER
          </h2>
          <span className="text-[10px] text-text-tertiary font-mono">
            Reading Coding/docs recursive file tree
          </span>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 pr-7 text-xs rounded-none border-pantheon-single bg-transparent text-text-primary"
            placeholder="Search document names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs font-mono bg-muted/5 p-2 border border-border/40">
        {breadcrumbs.map((bc, idx) => (
          <div key={idx} className="flex items-center">
            {idx > 0 && <ChevronRight className="h-3 w-3 mx-1 text-text-tertiary" />}
            <button
              onClick={() => handleBreadcrumbClick(idx)}
              className={`hover:text-primary ${
                idx === breadcrumbs.length - 1 ? "text-text-primary font-bold" : "text-text-secondary"
              }`}
            >
              {bc.name}
            </button>
          </div>
        ))}
      </div>

      {/* File & Folder Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredItems.map((item, idx) => {
          if (item.type === "directory") {
            const cover = getFolderCover(item.name);
            return (
              <div
                key={idx}
                onClick={() => handleFolderClick(item)}
                className="card-engraving p-3 cursor-pointer flex flex-col justify-between border-pantheon hover:border-primary"
              >
                {/* Folder cover image */}
                <div className="w-full h-32 overflow-hidden mb-2 border border-border/20 bg-muted/10">
                  <img
                    src={cover}
                    alt={item.name}
                    className="woodcut-img w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-serif-display text-xs font-bold text-text-secondary truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-text-tertiary">
                    {item.children?.length || 0} items
                  </span>
                </div>
              </div>
            );
          } else {
            return (
              <div
                key={idx}
                onClick={() => handleFileClick(item)}
                className="card-engraving p-3 cursor-pointer flex flex-col justify-between border-pantheon hover:border-primary"
              >
                <div className="w-full h-32 flex items-center justify-center mb-2 border border-border/20 bg-muted/10 relative">
                  <FileText className="h-12 w-12 text-text-tertiary" />
                  <div className="absolute top-1 right-1 text-[8px] font-mono text-text-tertiary">
                    Markdown
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                    <span className="font-serif-display text-xs text-text-secondary truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-text-tertiary">
                    {(item.size || 0).toLocaleString()} bytes
                  </span>
                </div>
              </div>
            );
          }
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-16 text-center text-xs text-text-tertiary">
            No folders or files found matching your query.
          </div>
        )}
      </div>

      {/* Markdown Preview Drawer Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-background-base/80 flex items-center justify-end z-50">
          <div className="bg-background-base border-l border-border h-full max-w-2xl w-full flex flex-col shadow-2xl relative border-pantheon">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-serif-display text-xs font-bold tracking-wider text-primary">
                  {selectedFileName.toUpperCase()}
                </span>
              </div>
              <button
                className="p-1 border border-pantheon-single hover:text-primary transition-colors text-text-secondary"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Document Reading Pane */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-background-base via-background-base to-midground/5">
              {isLoadingContent ? (
                <div className="flex items-center justify-center h-full">
                  <span className="font-mono text-xs text-text-tertiary">Reading scroll...</span>
                </div>
              ) : (
                <div className="font-serif-display text-sm leading-relaxed text-text-secondary select-text whitespace-pre-wrap">
                  {fileContent}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
