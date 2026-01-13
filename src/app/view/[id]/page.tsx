"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import React, { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  PlayIcon,
  PlusIcon,
  TerminalSquareIcon,
  Trash2Icon,
} from "lucide-react";
import FileTree from "@/components/editor/FileTree";
import SideChat from "@/components/Ai/SideChat";
import EditorPanel from "@/components/editor/EditorPannel";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/store/projectStore";
import { FileNode } from "@/types/types";
import { useProjectFiles, useProject } from "@/contexts/ProjectFilesContext";
import WebPreview from "@/components/preview/WebPreview";
import PreviewPopup from "@/components/preview/PreviewPopup";
import BrowserPreview from "@/components/preview/BrowserPreview";
import { buildSimpleWebHtml } from "@/utils/simpleWebBuilder";
import { allServices } from "@/services/allServices";
import { SquareIcon, Loader2Icon, CopyIcon, CheckIcon, GlobeIcon } from "lucide-react";

type EditorFile = { path: string; node: FileNode };

interface ProjectViewProps {
  FILES: FileNode[];
  framework?: string;
  entrypoint?: string;
}
const ProjectView: React.FC<ProjectViewProps> = ({ FILES, framework, entrypoint }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  const {
    files: projectFiles,
    setFiles,
    updateFileContent,
    setOpenedFiles,
    addOpenedFile,
    removeOpenedFile,
    showCopilot,
    setShowCopilot,
  } = useProjectStore();

  // UI Visibility State
  const [showLeft, setShowLeft] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);

  // Editor UI State
  const [leftOpenFiles, setLeftOpenFiles] = useState<EditorFile[]>([]);
  const [rightOpenFiles, setRightOpenFiles] = useState<EditorFile[]>([]);
  const [leftActive, setLeftActive] = useState<EditorFile | null>(null);
  const [rightActive, setRightActive] = useState<EditorFile | null>(null);
  const [activeTab, setActiveTab] = useState<"left" | "right">('left');

  // Drag-and-Drop State
  const [draggedExplorerFile, setDraggedExplorerFile] = useState<EditorFile | null>(null);
  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [draggingTabPath, setDraggingTabPath] = useState<string | null>(null);

  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // Code Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [terminalCopied, setTerminalCopied] = useState(false);

  // Browser Preview State (for dev servers)
  const [devServerPort, setDevServerPort] = useState<number | null>(null);
  const [showBrowserPreview, setShowBrowserPreview] = useState(false);
  const [browserPreviewFullscreen, setBrowserPreviewFullscreen] = useState(false);

  // Find requirements.txt content for notebook package installation
  const requirementsTxt = useMemo(() => {
    const findRequirements = (files: FileNode[]): string | undefined => {
      for (const file of files) {
        if (file.name === 'requirements.txt' && file.content) {
          return file.content;
        }
        if (file.children) {
          const found = findRequirements(file.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    return findRequirements(projectFiles);
  }, [projectFiles]);

  // Always sync FILES from context to store when FILES changes
  // Also reset opened files to prevent stale tabs from previous project
  useEffect(() => {
    if (FILES.length > 0) {
      setFiles(FILES);
      // Clear opened files when project files change
      setLeftOpenFiles([]);
      setRightOpenFiles([]);
      setLeftActive(null);
      setRightActive(null);
      setOpenedFiles([]);
    }
  }, [FILES, setFiles, setOpenedFiles]);

  // Auto-open first .md file from root folder
  useEffect(() => {
    if (projectFiles.length > 0 && leftOpenFiles.length === 0) {
      const rootMdFiles = projectFiles
        .filter((node) => !node.children && node.name.endsWith(".md"))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (rootMdFiles.length > 0) {
        const firstMd = rootMdFiles[0];
        const file: EditorFile = { path: firstMd.name, node: firstMd };
        setLeftOpenFiles([file]);
        setLeftActive(file);
        addOpenedFile(file);
      }
    }
  }, [projectFiles]);

  // Sync opened files with store
  useEffect(() => {
    const allOpenFiles = [...leftOpenFiles, ...rightOpenFiles];
    const uniqueOpenFiles = allOpenFiles.filter((file, index, self) => 
      self.findIndex(f => f.path === file.path) === index
    );
    setOpenedFiles(uniqueOpenFiles);
  }, [leftOpenFiles, rightOpenFiles, setOpenedFiles]);
  
  // Auto-scroll terminal to bottom when new lines are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Helper to write to terminal
  const writeToTerminal = (text: string) => {
    // Split by actual newlines and filter empty strings at the end
    const lines = text.split(/\r?\n/);
    setTerminalLines(prev => [...prev, ...lines.filter((l, i) => i < lines.length - 1 || l !== '')]);
  };

  const writelnToTerminal = (text: string) => {
    setTerminalLines(prev => [...prev, text]);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "b") { e.preventDefault(); setShowCopilot(!showCopilot); }
      else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); setShowLeft((p) => !p); }
      else if (e.ctrlKey && e.key === "`") { e.preventDefault(); setShowTerminal((p) => !p); }
      else if (e.ctrlKey && e.key === "\\") { e.preventDefault(); setIsSplitView((p) => !p); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showCopilot, setShowCopilot]);

  // Debounce ref for live sync
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // --- *** FIXED: Central handler for content changes *** ---
  const handleContentChange = (path: string, content: string) => {
    // 1. Update the global Zustand store
    updateFileContent(path, content);

    // 2. Update the local UI state for any open tabs of the same file
    const updateNodeInPlace = (files: EditorFile[]) => {
      return files.map(file =>
        file.path === path
          ? { ...file, node: { ...file.node, content: content } }
          : file
      );
    };
    setLeftOpenFiles(updateNodeInPlace);
    setRightOpenFiles(updateNodeInPlace);

    // 3. *** THE FIX: Also update the active file objects if they match the changed file ***
    if (leftActive?.path === path) {
      setLeftActive(prev => prev ? { ...prev, node: { ...prev.node, content } } : null);
    }
    if (rightActive?.path === path) {
      setRightActive(prev => prev ? { ...prev, node: { ...prev.node, content } } : null);
    }

    // 4. Live sync: If a dev server is running, sync the file to the backend (debounced)
    if (sessionId && isRunning) {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      syncDebounceRef.current = setTimeout(() => {
        allServices.updateFile(sessionId, path, content).catch((err) => {
          console.error("[LiveSync] Failed to update file:", err);
        });
      }, 300); // 300ms debounce
    }
  };

  const openFileInPanel = (panel: "left" | "right", file: EditorFile) => {
    if (panel === "left") {
      if (!leftOpenFiles.some((f) => f.path === file.path)) setLeftOpenFiles((prev) => [...prev, file]);
      setLeftActive(file);
    } else {
      if (!rightOpenFiles.some((f) => f.path === file.path)) setRightOpenFiles((prev) => [...prev, file]);
      setRightActive(file);
    }
    // Sync with store
    addOpenedFile(file);
  };

  const selectFile = (node: FileNode, path: string) => {
    openFileInPanel( activeTab, { path, node });
  };

  const closeTab = (panel: "left" | "right", path: string) => {
    const [openFiles, setOpenFiles, setActive] = panel === "left"
        ? [leftOpenFiles, setLeftOpenFiles, setLeftActive]
        : [rightOpenFiles, setRightOpenFiles, setRightActive];
    const newFiles = openFiles.filter((f) => f.path !== path);
    setOpenFiles(newFiles);
    setActive((currentActive) => currentActive?.path === path ? newFiles[newFiles.length - 1] || null : currentActive);
    if (panel === "right" && newFiles.length === 0) setIsSplitView(false);
    
    // Sync with store - only remove if not open in other panel
    const isOpenInOtherPanel = (panel === "left" ? rightOpenFiles : leftOpenFiles).some(f => f.path === path);
    if (!isOpenInOtherPanel) {
      removeOpenedFile(path);
    }
  };

  const handleReorderTab = (panel: "left" | "right", draggedPath: string, targetPath: string) => {
    if (draggedPath === targetPath) return;
    const [files, setFiles] = panel === "left" ? [leftOpenFiles, setLeftOpenFiles] : [rightOpenFiles, setRightOpenFiles];
    const draggedIndex = files.findIndex((f) => f.path === draggedPath);
    const targetIndex = files.findIndex((f) => f.path === targetPath);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newFiles = [...files];
    const [draggedItem] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(targetIndex, 0, draggedItem);
    setFiles(newFiles);
  };

  const handleMoveTab = (fromPath: string, toPanel: "left" | "right") => {
    const fromPanel = leftOpenFiles.some((f) => f.path === fromPath) ? "left" : "right";
    if (fromPanel === toPanel) return;
    const file = (fromPanel === "left" ? leftOpenFiles : rightOpenFiles).find((f) => f.path === fromPath);
    if (!file) return;
    openFileInPanel(toPanel, file);
    closeTab(fromPanel, fromPath);
    if (toPanel === "right") setIsSplitView(true);
    setDraggingTabPath(null);
  };

  const handleFileDrop = (panel: "left" | "right", createSplit = false) => {
    if (!draggedExplorerFile) return;
    if (createSplit) {
      setIsSplitView(true);
      openFileInPanel("right", draggedExplorerFile);
    } else {
      openFileInPanel(panel, draggedExplorerFile);
    }
  };

  // Stream output from execution server
  const streamOutput = async (sid: string, signal: AbortSignal) => {
    try {
      console.log(`[Stream] Connecting to session ${sid}...`);

      const streamResponse = await fetch(
        `http://localhost:8001/api/projects/stream/${sid}`,
        {
          signal,
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          }
        }
      );

      console.log(`[Stream] Response status: ${streamResponse.status}`);

      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Failed to connect: ${streamResponse.status}`);
      }

      console.log(`[Stream] Connected, starting to read...`);

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[CONNECTED]") continue;

            if (data === "[END]") {
              setIsRunning(false);
              abortControllerRef.current = null;
              return;
            }

            if (data === "[TIMEOUT]") {
              writelnToTerminal("⚠ Execution timed out");
              setIsRunning(false);
              abortControllerRef.current = null;
              return;
            }

            // Unescape newlines and write to terminal
            const unescaped = data.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
            writeToTerminal(unescaped);

            // Auto-show browser preview when dev server is ready
            // Common indicators for various frameworks
            const lowerData = unescaped.toLowerCase();
            if (
              (lowerData.includes("ready") && lowerData.includes("localhost")) ||
              lowerData.includes("local:") ||
              lowerData.includes("started server") ||
              (lowerData.includes("compiled") && lowerData.includes("success")) ||
              lowerData.includes("➜  local:") ||
              // Uvicorn indicators
              lowerData.includes("uvicorn running on") ||
              lowerData.includes("application startup complete") ||
              // Flask indicators
              (lowerData.includes("running on") && lowerData.includes("http://"))
            ) {
              setShowBrowserPreview(true);
            }
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error("[Stream] Error:", error.name, error.message, error);

      if (error.name !== "AbortError") {
        writelnToTerminal(`✗ Stream error: ${error.message}`);
      } else {
        console.log("[Stream] Aborted by user");
      }
    } finally {
      console.log("[Stream] Cleanup");
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const runCode = async () => {
    // Clear terminal first
    setTerminalLines([]);
    writelnToTerminal("$ Running project...");

    // For simple-web framework, build combined HTML and show preview
    if (framework === "simple-web") {
      const html = buildSimpleWebHtml(projectFiles, entrypoint);
      setPreviewHtml(html);
      setShowPreview(true);
      writelnToTerminal("✓ Built successfully. Opening preview...");
      return;
    }

    // For other frameworks, use backend execution
    try {
      setIsRunning(true);

      // Call backend to start execution
      const response = await allServices.runProject(projectFiles);
      setSessionId(response.session_id);
      setDevServerPort(response.port);

      writelnToTerminal(`Detected: ${response.project_type}`);
      writelnToTerminal(`Server port: ${response.port}`);
      writelnToTerminal("");

      // Connect to SSE stream for output using fetch
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Small delay to ensure session is fully ready on backend
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start streaming in a separate async function
      streamOutput(response.session_id, abortController.signal);

    } catch (error) {
      console.error("Run project error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      writelnToTerminal(`✗ Error: ${errMsg}`);
      setIsRunning(false);
    }
  };

  const stopCode = async () => {
    if (sessionId) {
      try {
        await allServices.stopProject(sessionId);
        writelnToTerminal("⚠ Process stopped by user");
      } catch (error) {
        console.error("Failed to stop process:", error);
      }
    }

    // Abort the fetch stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsRunning(false);
    setSessionId(null);
    setDevServerPort(null);
    setShowBrowserPreview(false);
    setBrowserPreviewFullscreen(false);
  };

  const clearTerminal = () => {
    setTerminalLines([]);
  };

  const copyTerminalOutput = async () => {
    const text = terminalLines.join("\n");
    if (text) {
      await navigator.clipboard.writeText(text);
      setTerminalCopied(true);
      setTimeout(() => setTerminalCopied(false), 2000);
    }
  };

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-rebuild preview HTML when files change (for live preview)
  useEffect(() => {
    if (showPreview && framework === "simple-web") {
      const html = buildSimpleWebHtml(projectFiles, entrypoint);
      setPreviewHtml(html);
    }
  }, [projectFiles, showPreview, framework, entrypoint]);

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewFullscreen(false);
  };

  const handleToggleFullscreen = () => {
    setPreviewFullscreen((prev) => !prev);
  };

  const handleCloseBrowserPreview = () => {
    setShowBrowserPreview(false);
    setBrowserPreviewFullscreen(false);
  };

  const handleToggleBrowserFullscreen = () => {
    setBrowserPreviewFullscreen((prev) => !prev);
  };

  const dragSourcePanel =
    draggingTabPath &&
    (leftOpenFiles.some((f) => f.path === draggingTabPath)
      ? "left"
      : "right");

  return (
    <div className="h-[calc(100vh-38px)] w-screen dark:bg-[#181818]">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {showLeft && (
          <>
            <ResizablePanel defaultSize={15} minSize={10} maxSize={50}>
              <div className="h-full border-r p-2 overflow-auto dark:bg-[#181818]">
                <div className=" px-3 flex items-center justify-between">
                  <h2 className="font-normal mb-2 text-xs text-muted-foreground uppercase">FOLDERS: Demo</h2>
                  <Badge className=" !text-xs" variant={'secondary'}>Ctrl + B</Badge>
                </div>
                <FileTree
                  nodes={projectFiles}
                  onSelect={selectFile}
                  onFileDragStart={(node, path) => {
                    setDraggedExplorerFile({ node, path });
                    setShowDropOverlay(true);
                  }}
                  onFileDragEnd={() => {
                    setDraggedExplorerFile(null);
                    setShowDropOverlay(false);
                  }}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}

        <ResizablePanel defaultSize={showLeft && showCopilot ? 60 : 80}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={showCopilot ? 70 : 100} minSize={50}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={showTerminal ? 75 : 100}>
                  <ResizablePanelGroup
                    className="h-full relative"
                    direction="horizontal"
                  >
                    <ResizablePanel className="h-full">
                      <div
                        className="h-full relative"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleFileDrop("left")}
                        onClick={()=>setActiveTab('left')}
                      >
                        <EditorPanel
                          panelId="left"
                          openFiles={leftOpenFiles}
                          activeFile={leftActive}
                          onSelect={setLeftActive}
                          onClose={(path) => closeTab("left", path)}
                          onDragDrop={handleMoveTab}
                          onReorder={(drag, target) => handleReorderTab("left", drag, target)}
                          draggingPath={draggingTabPath}
                          onDragStart={setDraggingTabPath}
                          onDragEnd={() => setDraggingTabPath(null)}
                          onContentChange={handleContentChange}
                          requirementsTxt={requirementsTxt}
                        />
                        {dragSourcePanel === "right" && (
                          <div
                            className="absolute inset-0 bg-blue-500/10 z-10"
                            onDrop={(e) => {
                              e.stopPropagation();
                              if (draggingTabPath) handleMoveTab(draggingTabPath, "left");
                            }}
                          />
                        )}
                      </div>
                    </ResizablePanel>

                    {isSplitView && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel className="h-full">
                          <div
                            className="h-full relative"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleFileDrop("right")}
                            onClick={()=>setActiveTab('right')}
                          >
                            <EditorPanel
                              panelId="right"
                              openFiles={rightOpenFiles}
                              activeFile={rightActive}
                              onSelect={setRightActive}
                              onClose={(path) => closeTab("right", path)}
                              onDragDrop={handleMoveTab}
                              onReorder={(drag, target) => handleReorderTab("right", drag, target)}
                              draggingPath={draggingTabPath}
                              onDragStart={setDraggingTabPath}
                              onDragEnd={() => setDraggingTabPath(null)}
                              onContentChange={handleContentChange}
                              requirementsTxt={requirementsTxt}
                            />
                            {dragSourcePanel === "left" && (
                              <div
                                className="absolute inset-0 bg-blue-500/10 z-10"
                                onDrop={(e) => {
                                  e.stopPropagation();
                                  if (draggingTabPath) handleMoveTab(draggingTabPath, "right");
                                }}
                              />
                            )}
                          </div>
                        </ResizablePanel>
                      </>
                    )}

                    {showDropOverlay && !isSplitView && (
                      <div
                        className="absolute top-0 right-0 h-full w-1/2 bg-blue-500/10 border-l-2 border-blue-400 z-10"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleFileDrop("right", true);
                        }}
                      />
                    )}

                    {/* Preview Panel for simple-web (inline, not fullscreen) */}
                    {showPreview && !previewFullscreen && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={40} minSize={20}>
                          <WebPreview
                            htmlContent={previewHtml}
                            onClose={handleClosePreview}
                            onToggleFullscreen={handleToggleFullscreen}
                            isFullscreen={false}
                          />
                        </ResizablePanel>
                      </>
                    )}

                    {/* Browser Preview Panel for dev servers (inline, not fullscreen) */}
                    {showBrowserPreview && devServerPort && !browserPreviewFullscreen && (
                      <>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={40} minSize={20}>
                          <BrowserPreview
                            url={`http://localhost:${devServerPort}`}
                            onClose={handleCloseBrowserPreview}
                            onToggleFullscreen={handleToggleBrowserFullscreen}
                            isFullscreen={false}
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </ResizablePanel>

                {showTerminal && (
                  <>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={25} minSize={10} maxSize={100}>
                      {/* ... Terminal JSX ... */}
                      <div className="h-full flex flex-col bg-[#1e1e1e] border-t">
                        <div className="flex items-center justify-between px-2 py-1 border-b text-sm">
                          <div className="flex items-center gap-2">
                            <TerminalSquareIcon size={16} />
                            <span>Terminal</span>
                            {isRunning && <Loader2Icon size={14} className="animate-spin text-green-500" />}
                          </div>
                          <div className="flex items-center gap-2">
                            {isRunning ? (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-400" onClick={stopCode} title="Stop">
                                <SquareIcon size={14} />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={runCode} title="Run">
                                <PlayIcon size={14} />
                              </Button>
                            )}
                            {devServerPort && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-7 w-7 ${showBrowserPreview ? "text-blue-400" : ""}`}
                                onClick={() => setShowBrowserPreview(!showBrowserPreview)}
                                title={showBrowserPreview ? "Hide Browser Preview" : "Show Browser Preview"}
                              >
                                <GlobeIcon size={14} />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyTerminalOutput} title="Copy output">
                              {terminalCopied ? <CheckIcon size={14} className="text-green-500" /> : <CopyIcon size={14} />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><PlusIcon size={14} /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearTerminal} title="Clear">
                              <Trash2Icon size={14} />
                            </Button>
                          </div>
                        </div>
                        <div
                          ref={terminalRef}
                          className="flex-1 w-full overflow-auto p-2 font-mono text-xs leading-tight"
                        >
                          {terminalLines.map((line, idx) => (
                            <div key={idx} className="whitespace-pre-wrap break-all text-gray-300">
                              {line || "\u00A0"}
                            </div>
                          ))}
                        </div>
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>

            {showCopilot && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20}>
                  <SideChat onClose={()=>setShowCopilot(false)}/>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Fullscreen Preview Popup */}
      {showPreview && previewFullscreen && (
        <PreviewPopup htmlContent={previewHtml} onClose={handleClosePreview} />
      )}

      {/* Fullscreen Browser Preview */}
      {showBrowserPreview && browserPreviewFullscreen && devServerPort && (
        <div className="fixed inset-0 z-50 bg-black">
          <BrowserPreview
            url={`http://localhost:${devServerPort}`}
            onClose={handleCloseBrowserPreview}
            onToggleFullscreen={handleToggleBrowserFullscreen}
            isFullscreen={true}
          />
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const files = useProjectFiles();
  const project = useProject();
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <ProjectView
        FILES={files}
        framework={project?.metadata?.framework}
        entrypoint={project?.metadata?.entrypoint}
      />
    </Suspense>
  );
}