"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  CloudOff,
  RefreshCw,
  PlayIcon,
  PlusIcon,
  TerminalSquareIcon,
  Trash2Icon,
  FilePlus,
  FolderPlus,
  SquareIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
  GlobeIcon,
} from "lucide-react";
import { toast } from "sonner";

import FileTree from "@/components/editor/FileTree";
import EditorPanel from "@/components/editor/EditorPannel";
import SideChat from "@/components/Ai/SideChat";
import WebPreview from "@/components/preview/WebPreview";
import PreviewPopup from "@/components/preview/PreviewPopup";
import BrowserPreview from "@/components/preview/BrowserPreview";
import { buildSimpleWebHtml } from "@/utils/simpleWebBuilder";

import { useAssessmentStore } from "@/store/assessmentStore";
import { useProjectStore } from "@/store/projectStore";
import { assessmentService } from "@/services/assessmentService";
import { allServices } from "@/services/allServices";
import { useAssessmentTimer } from "@/hooks/useAssessmentTimer";
import { useAutoSync } from "@/hooks/useAutoSync";

import { FileNode } from "@/types/types";
import { AssessmentCandidate, AssessmentRound } from "@/types/assessment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type EditorFile = { path: string; node: FileNode };

// ---------------------------------------------------------------------------
// Main page export
// ---------------------------------------------------------------------------
export default function Page() {
  const pathname = usePathname();
  const prefix = "/project-assessment/token=";
  const token = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null;

  if (!token) {
    return <NoTokenScreen />;
  }

  return <AssessmentShell token={token} />;
}

// ---------------------------------------------------------------------------
// Shell: verify token → render IDE or status screen
// ---------------------------------------------------------------------------
function AssessmentShell({ token }: { token: string }) {
  const store = useAssessmentStore();

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      store.setToken(token);
      store.setStatus("loading");
      try {
        const data = await assessmentService.verifyToken(token);
        if (!cancelled) {
          store.initFromVerification(data);
        }
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401) {
          store.setStatus("expired");
        } else if (status === 410) {
          store.setStatus("already_submitted");
        } else {
          store.setError(
            err?.response?.data?.detail ||
              err?.response?.data?.message ||
              "Failed to verify assessment token"
          );
        }
      }
    };

    verify();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  switch (store.status) {
    case "loading":
      return <LoadingScreen />;
    case "expired":
      return <ExpiredScreen />;
    case "already_submitted":
      return <AlreadySubmittedScreen />;
    case "error":
      return <ErrorScreen message={store.errorMessage} />;
    case "submitted":
      return <SubmittedScreen submittedAt={store.submittedAt} syncCount={store.syncCount} />;
    case "ready":
      return <AssessmentIDE />;
    default:
      return <LoadingScreen />;
  }
}

// ---------------------------------------------------------------------------
// AssessmentIDE — full IDE with assessment header
// ---------------------------------------------------------------------------
function AssessmentIDE() {
  const {
    token,
    files: assessmentFiles,
    candidate,
    round,
    project,
    startedAt,
    durationMinutes,
    syncCount,
    lastSyncedAt,
    isSyncing,
    isSubmitting,
    gptEnabled,
    showCopilot,
    setSyncState,
    setIsSyncing,
    setIsSubmitting,
    setStatus,
    markSubmitted,
    setShowCopilot,
    setFiles: setAssessmentFiles,
    aiModelId,
    aiModelConfig,
  } = useAssessmentStore();

  const framework = project?.metadata?.framework;
  const entrypoint = project?.metadata?.entrypoint;

  // Use projectStore for all IDE file operations (components read from it)
  const {
    files: projectFiles,
    setFiles,
    updateFileContent,
    setOpenedFiles,
    addOpenedFile,
    removeOpenedFile,
    createFile,
    createFolder,
    renameNode,
    deleteNode,
    setAiInfo,
    setShowCopilot: setProjectShowCopilot,
  } = useProjectStore();

  // Sync assessment data into projectStore on load
  useEffect(() => {
    if (assessmentFiles.length > 0) {
      setFiles(assessmentFiles);
      setLeftOpenFiles([]);
      setRightOpenFiles([]);
      setLeftActive(null);
      setRightActive(null);
      setOpenedFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentFiles]);

  // Sync AI config into projectStore so SideChat works
  useEffect(() => {
    setAiInfo(aiModelId, aiModelConfig);
  }, [aiModelId, aiModelConfig, setAiInfo]);

  // Keep projectStore copilot state in sync
  useEffect(() => {
    setProjectShowCopilot(showCopilot);
  }, [showCopilot, setProjectShowCopilot]);

  // -------------------------------------------------------------------------
  // Terminal state
  // -------------------------------------------------------------------------
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  // -------------------------------------------------------------------------
  // UI Visibility State
  // -------------------------------------------------------------------------
  const [showLeft, setShowLeft] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);

  // -------------------------------------------------------------------------
  // Editor UI State
  // -------------------------------------------------------------------------
  const [leftOpenFiles, setLeftOpenFiles] = useState<EditorFile[]>([]);
  const [rightOpenFiles, setRightOpenFiles] = useState<EditorFile[]>([]);
  const [leftActive, setLeftActive] = useState<EditorFile | null>(null);
  const [rightActive, setRightActive] = useState<EditorFile | null>(null);
  const [activeTab, setActiveTab] = useState<"left" | "right">("left");

  // -------------------------------------------------------------------------
  // Drag-and-Drop State
  // -------------------------------------------------------------------------
  const [draggedExplorerFile, setDraggedExplorerFile] = useState<EditorFile | null>(null);
  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [draggingTabPath, setDraggingTabPath] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Preview State
  // -------------------------------------------------------------------------
  const [showPreview, setShowPreview] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // -------------------------------------------------------------------------
  // Code Execution State
  // -------------------------------------------------------------------------
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [terminalCopied, setTerminalCopied] = useState(false);

  // -------------------------------------------------------------------------
  // Browser Preview State
  // -------------------------------------------------------------------------
  const [devServerPort, setDevServerPort] = useState<number | null>(null);
  const [showBrowserPreview, setShowBrowserPreview] = useState(false);
  const [browserPreviewFullscreen, setBrowserPreviewFullscreen] = useState(false);

  // -------------------------------------------------------------------------
  // Notebook kernel session
  // -------------------------------------------------------------------------
  const [notebookSessionId, setNotebookSessionId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Root-level file/folder creation
  // -------------------------------------------------------------------------
  const [isCreatingRootFile, setIsCreatingRootFile] = useState(false);
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);

  // -------------------------------------------------------------------------
  // Submit dialog
  // -------------------------------------------------------------------------
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const requirementsTxt = useMemo(() => {
    const findReqs = (files: FileNode[]): string | undefined => {
      for (const f of files) {
        if (f.name === "requirements.txt" && f.content) return f.content;
        if (f.children) { const r = findReqs(f.children); if (r) return r; }
      }
      return undefined;
    };
    return findReqs(projectFiles);
  }, [projectFiles]);

  // -------------------------------------------------------------------------
  // Auto-open first .md or editable file
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (projectFiles.length > 0 && leftOpenFiles.length === 0) {
      const rootMdFiles = projectFiles
        .filter((n) => !n.children && n.name.endsWith(".md"))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (rootMdFiles.length > 0) {
        const firstMd = rootMdFiles[0];
        const file: EditorFile = { path: firstMd.name, node: firstMd };
        setLeftOpenFiles([file]);
        setLeftActive(file);
        addOpenedFile(file);
      } else {
        const firstEditable = findFirstEditable(projectFiles);
        if (firstEditable) {
          const file: EditorFile = { path: firstEditable.path, node: firstEditable.node };
          setLeftOpenFiles([file]);
          setLeftActive(file);
          addOpenedFile(file);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFiles]);

  // Sync opened files with store
  useEffect(() => {
    const allOpen = [...leftOpenFiles, ...rightOpenFiles];
    const unique = allOpen.filter((f, i, s) => s.findIndex((x) => x.path === f.path) === i);
    setOpenedFiles(unique);
  }, [leftOpenFiles, rightOpenFiles, setOpenedFiles]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  // Terminal helpers
  const writeToTerminal = (text: string) => {
    const lines = text.split(/\r?\n/);
    setTerminalLines((prev) => [...prev, ...lines.filter((l, i) => i < lines.length - 1 || l !== "")]);
  };
  const writelnToTerminal = (text: string) => setTerminalLines((prev) => [...prev, text]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------
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

  // Debounce ref for live sync to running dev server
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // -------------------------------------------------------------------------
  // Content change handler (same as view page + assessment store sync)
  // -------------------------------------------------------------------------
  const handleContentChange = (path: string, content: string) => {
    // 1. Update projectStore
    updateFileContent(path, content);

    // 2. Update local UI state
    const updateNodeInPlace = (files: EditorFile[]) =>
      files.map((f) => (f.path === path ? { ...f, node: { ...f.node, content } } : f));
    setLeftOpenFiles(updateNodeInPlace);
    setRightOpenFiles(updateNodeInPlace);

    // 3. Update active file objects
    if (leftActive?.path === path)
      setLeftActive((prev) => (prev ? { ...prev, node: { ...prev.node, content } } : null));
    if (rightActive?.path === path)
      setRightActive((prev) => (prev ? { ...prev, node: { ...prev.node, content } } : null));

    // 4. Live sync to running dev server (debounced)
    if (sessionId && isRunning) {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        allServices.updateFile(sessionId, path, content).catch((err) =>
          console.error("[LiveSync] Failed to update file:", err)
        );
      }, 300);
    }

    // 5. Sync to notebook kernel
    if (notebookSessionId && !path.endsWith(".ipynb")) {
      allServices.notebook.updateFile(notebookSessionId, path, content)
        .catch((err) => console.warn("[Notebook] Failed to sync:", err));
    }
  };

  // -------------------------------------------------------------------------
  // File / tab management (identical to view page)
  // -------------------------------------------------------------------------
  const openFileInPanel = (panel: "left" | "right", file: EditorFile) => {
    if (panel === "left") {
      if (!leftOpenFiles.some((f) => f.path === file.path)) setLeftOpenFiles((prev) => [...prev, file]);
      setLeftActive(file);
    } else {
      if (!rightOpenFiles.some((f) => f.path === file.path)) setRightOpenFiles((prev) => [...prev, file]);
      setRightActive(file);
    }
    addOpenedFile(file);
  };

  const selectFile = (node: FileNode, path: string) => openFileInPanel(activeTab, { path, node });

  const closeTab = (panel: "left" | "right", path: string) => {
    const [openFiles, setOpenF, setActive] =
      panel === "left"
        ? [leftOpenFiles, setLeftOpenFiles, setLeftActive]
        : [rightOpenFiles, setRightOpenFiles, setRightActive];
    const newFiles = openFiles.filter((f) => f.path !== path);
    setOpenF(newFiles);
    setActive((cur) => (cur?.path === path ? newFiles[newFiles.length - 1] || null : cur));
    if (panel === "right" && newFiles.length === 0) setIsSplitView(false);
    const isOpenInOther = (panel === "left" ? rightOpenFiles : leftOpenFiles).some((f) => f.path === path);
    if (!isOpenInOther) removeOpenedFile(path);
  };

  const handleReorderTab = (panel: "left" | "right", draggedPath: string, targetPath: string) => {
    if (draggedPath === targetPath) return;
    const [files, setF] = panel === "left" ? [leftOpenFiles, setLeftOpenFiles] : [rightOpenFiles, setRightOpenFiles];
    const di = files.findIndex((f) => f.path === draggedPath);
    const ti = files.findIndex((f) => f.path === targetPath);
    if (di === -1 || ti === -1) return;
    const next = [...files];
    const [item] = next.splice(di, 1);
    next.splice(ti, 0, item);
    setF(next);
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
    if (createSplit) { setIsSplitView(true); openFileInPanel("right", draggedExplorerFile); }
    else openFileInPanel(panel, draggedExplorerFile);
  };

  // -------------------------------------------------------------------------
  // Code execution (identical to view page)
  // -------------------------------------------------------------------------
  const streamOutput = async (sid: string, signal: AbortSignal) => {
    try {
      const streamResponse = await fetch(`http://localhost:8001/api/projects/stream/${sid}`, {
//     const streamResponse = await fetch(`/workstation-api/projects/stream/${sid}`, {

        signal,
        headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
      });
      if (!streamResponse.ok || !streamResponse.body) throw new Error(`Failed to connect: ${streamResponse.status}`);
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
            if (data === "[END]") { setIsRunning(false); abortControllerRef.current = null; return; }
            if (data === "[TIMEOUT]") { writelnToTerminal("\u26a0 Execution timed out"); setIsRunning(false); abortControllerRef.current = null; return; }
            const unescaped = data.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
            writeToTerminal(unescaped);
            const lowerData = unescaped.toLowerCase();
            if (
              (lowerData.includes("ready") && lowerData.includes("localhost")) ||
              lowerData.includes("local:") ||
              lowerData.includes("started server") ||
              (lowerData.includes("compiled") && lowerData.includes("success")) ||
              lowerData.includes("\u279c  local:") ||
              lowerData.includes("uvicorn running on") ||
              lowerData.includes("application startup complete") ||
              (lowerData.includes("running on") && lowerData.includes("http://"))
            ) { setShowBrowserPreview(true); }
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      if (error.name !== "AbortError") writelnToTerminal(`\u2717 Stream error: ${error.message}`);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const runCode = async () => {
    setTerminalLines([]);
    writelnToTerminal("$ Running project...");
    if (framework === "simple-web") {
      const html = buildSimpleWebHtml(projectFiles, entrypoint);
      setPreviewHtml(html);
      setShowPreview(true);
      writelnToTerminal("\u2713 Built successfully. Opening preview...");
      return;
    }
    try {
      setIsRunning(true);
      const response = await allServices.runProject(projectFiles);
      setSessionId(response.session_id);
      setDevServerPort(response.port);
      writelnToTerminal(`Detected: ${response.project_type}`);
      writelnToTerminal(`Server port: ${response.port}`);
      writelnToTerminal("");
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      await new Promise((r) => setTimeout(r, 100));
      streamOutput(response.session_id, abortController.signal);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      writelnToTerminal(`\u2717 Error: ${errMsg}`);
      setIsRunning(false);
    }
  };

  const stopCode = async () => {
    if (sessionId) {
      try { await allServices.stopProject(sessionId); writelnToTerminal("\u26a0 Process stopped by user"); }
      catch (e) { console.error("Failed to stop:", e); }
    }
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setIsRunning(false);
    setSessionId(null);
    setDevServerPort(null);
    setShowBrowserPreview(false);
    setBrowserPreviewFullscreen(false);
  };

  const clearTerminal = () => setTerminalLines([]);

  const copyTerminalOutput = async () => {
    const text = terminalLines.join("\n");
    if (text) { await navigator.clipboard.writeText(text); setTerminalCopied(true); setTimeout(() => setTerminalCopied(false), 2000); }
  };

  // Cleanup on unmount
  useEffect(() => { return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }; }, []);

  // Auto-rebuild preview for simple-web
  useEffect(() => {
    if (showPreview && framework === "simple-web") setPreviewHtml(buildSimpleWebHtml(projectFiles, entrypoint));
  }, [projectFiles, showPreview, framework, entrypoint]);

  const handleClosePreview = () => { setShowPreview(false); setPreviewFullscreen(false); };
  const handleToggleFullscreen = () => setPreviewFullscreen((p) => !p);
  const handleCloseBrowserPreview = () => { setShowBrowserPreview(false); setBrowserPreviewFullscreen(false); };
  const handleToggleBrowserFullscreen = () => setBrowserPreviewFullscreen((p) => !p);

  const dragSourcePanel = draggingTabPath && (leftOpenFiles.some((f) => f.path === draggingTabPath) ? "left" : "right");

  // -------------------------------------------------------------------------
  // Assessment: Timer
  // -------------------------------------------------------------------------
  const handleTimeUp = useCallback(() => {
    toast.warning("Time is up! Submitting your assessment...");
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, projectFiles]);

  const timer = useAssessmentTimer({ startedAt, durationMinutes, onTimeUp: handleTimeUp });

  // -------------------------------------------------------------------------
  // Assessment: Auto-sync (reads projectFiles for latest edits)
  // -------------------------------------------------------------------------
  const { syncNow } = useAutoSync({
    token,
    files: projectFiles,
    enabled: !isSubmitting,
    onSyncStart: () => setIsSyncing(true),
    onSyncSuccess: (count, time) => { setSyncState(count, time); setIsSyncing(false); },
    onSyncError: (err) => { setIsSyncing(false); console.warn("[Assessment] Sync failed:", err); toast.error("Sync failed, will retry automatically"); },
    onAlreadySubmitted: () => { setIsSyncing(false); setStatus("already_submitted"); },
  });

  // Warn before closing tab
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // -------------------------------------------------------------------------
  // Assessment: Submit
  // -------------------------------------------------------------------------
  async function handleSubmit() {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await assessmentService.syncFiles(token, projectFiles).catch(() => {});
      const result = await assessmentService.submitAssessment(token, projectFiles);
      markSubmitted(result.submitted_at, result.sync_count);
    } catch (err: any) {
      if (err?.response?.status === 410) setStatus("already_submitted");
      else { toast.error("Submission failed. Please try again."); setIsSubmitting(false); }
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="h-screen w-screen flex flex-col dark:bg-[#181818]">
      {/* Assessment Header */}
      <AssessmentHeader
        candidate={candidate}
        round={round}
        timer={timer}
        syncCount={syncCount}
        lastSyncedAt={lastSyncedAt}
        isSyncing={isSyncing}
        isSubmitting={isSubmitting}
        gptEnabled={gptEnabled}
        showCopilot={showCopilot}
        onToggleCopilot={() => setShowCopilot(!showCopilot)}
        onSubmit={() => setShowSubmitDialog(true)}
      />

      {/* IDE Body */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* File Tree Sidebar */}
          {showLeft && (
            <>
              <ResizablePanel defaultSize={15} minSize={10} maxSize={50}>
                <div className="h-full border-r p-2 overflow-auto dark:bg-[#181818]">
                  <div className="px-3 flex items-center justify-between">
                    <h2 className="font-normal mb-2 text-xs text-muted-foreground uppercase">FILES</h2>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsCreatingRootFile(true)} title="New File">
                        <FilePlus size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsCreatingRootFolder(true)} title="New Folder">
                        <FolderPlus size={14} />
                      </Button>
                      <Badge className="!text-xs" variant="secondary">Ctrl + B</Badge>
                    </div>
                  </div>
                  <FileTree
                    nodes={projectFiles}
                    onSelect={selectFile}
                    onFileDragStart={(node, path) => { setDraggedExplorerFile({ node, path }); setShowDropOverlay(true); }}
                    onFileDragEnd={() => { setDraggedExplorerFile(null); setShowDropOverlay(false); }}
                    onCreateFile={createFile}
                    onCreateFolder={createFolder}
                    onRename={renameNode}
                    onDelete={deleteNode}
                    isCreatingRootFile={isCreatingRootFile}
                    isCreatingRootFolder={isCreatingRootFolder}
                    onRootFileCreated={() => setIsCreatingRootFile(false)}
                    onRootFolderCreated={() => setIsCreatingRootFolder(false)}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          {/* Main Content */}
          <ResizablePanel defaultSize={showLeft && showCopilot ? 60 : 80}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={showCopilot ? 70 : 100} minSize={50}>
                <ResizablePanelGroup direction="vertical">
                  {/* Editor Area */}
                  <ResizablePanel defaultSize={showTerminal ? 75 : 100}>
                    <ResizablePanelGroup className="h-full relative" direction="horizontal">
                      {/* Left Editor */}
                      <ResizablePanel className="h-full">
                        <div className="h-full relative" onDragOver={(e) => e.preventDefault()} onDrop={() => handleFileDrop("left")} onClick={() => setActiveTab("left")}>
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
                            projectFiles={projectFiles}
                            requirementsTxt={requirementsTxt}
                            onNotebookSessionReady={setNotebookSessionId}
                          />
                          {dragSourcePanel === "right" && (
                            <div className="absolute inset-0 bg-blue-500/10 z-10" onDrop={(e) => { e.stopPropagation(); if (draggingTabPath) handleMoveTab(draggingTabPath, "left"); }} />
                          )}
                        </div>
                      </ResizablePanel>

                      {/* Right Editor (Split) */}
                      {isSplitView && (
                        <>
                          <ResizableHandle withHandle />
                          <ResizablePanel className="h-full">
                            <div className="h-full relative" onDragOver={(e) => e.preventDefault()} onDrop={() => handleFileDrop("right")} onClick={() => setActiveTab("right")}>
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
                                projectFiles={projectFiles}
                                requirementsTxt={requirementsTxt}
                                onNotebookSessionReady={setNotebookSessionId}
                              />
                              {dragSourcePanel === "left" && (
                                <div className="absolute inset-0 bg-blue-500/10 z-10" onDrop={(e) => { e.stopPropagation(); if (draggingTabPath) handleMoveTab(draggingTabPath, "right"); }} />
                              )}
                            </div>
                          </ResizablePanel>
                        </>
                      )}

                      {/* Drop overlay for split creation */}
                      {showDropOverlay && !isSplitView && (
                        <div className="absolute top-0 right-0 h-full w-1/2 bg-blue-500/10 border-l-2 border-blue-400 z-10" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); handleFileDrop("right", true); }} />
                      )}

                      {/* Web Preview (simple-web) */}
                      {showPreview && !previewFullscreen && (
                        <>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={40} minSize={20}>
                            <WebPreview htmlContent={previewHtml} onClose={handleClosePreview} onToggleFullscreen={handleToggleFullscreen} isFullscreen={false} />
                          </ResizablePanel>
                        </>
                      )}

                      {/* Browser Preview (dev server) */}
                      {showBrowserPreview && devServerPort && !browserPreviewFullscreen && (
                        <>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={40} minSize={20}>
                            {/* <BrowserPreview url={`/dev-preview/${devServerPort}/`} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={false} /> */}
                            <BrowserPreview url={`http://localhost:${devServerPort}/`} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={false} />
                          </ResizablePanel>
                        </>
                      )}
                    </ResizablePanelGroup>
                  </ResizablePanel>

                  {/* Terminal */}
                  {showTerminal && (
                    <>
                      <ResizableHandle />
                      <ResizablePanel defaultSize={25} minSize={10} maxSize={100}>
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
                                <Button size="icon" variant="ghost" className={`h-7 w-7 ${showBrowserPreview ? "text-blue-400" : ""}`} onClick={() => setShowBrowserPreview(!showBrowserPreview)} title={showBrowserPreview ? "Hide Browser Preview" : "Show Browser Preview"}>
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
                          <div ref={terminalRef} className="flex-1 w-full overflow-auto p-2 font-mono text-xs leading-tight">
                            {terminalLines.map((line, idx) => (
                              <div key={idx} className="whitespace-pre-wrap break-all text-gray-300">{line || "\u00A0"}</div>
                            ))}
                          </div>
                        </div>
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>

              {/* AI Copilot */}
              {showCopilot && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <SideChat onClose={() => setShowCopilot(false)} />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Fullscreen Preview Popup */}
      {showPreview && previewFullscreen && <PreviewPopup htmlContent={previewHtml} onClose={handleClosePreview} />}

      {/* Fullscreen Browser Preview */}
      {showBrowserPreview && browserPreviewFullscreen && devServerPort && (
        <div className="fixed inset-0 z-50 bg-black">
          {/* <BrowserPreview url={`/dev-preview/${devServerPort}/`} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={true} /> */}
          <BrowserPreview url={`http://localhost:${devServerPort}/`} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={true} />
        </div>
      )}

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit? This action cannot be undone. You will not be able to edit your code after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? (<><Loader2 size={14} className="animate-spin mr-2" />Submitting...</>) : (<><Send size={14} className="mr-2" />Submit</>)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssessmentHeader
// ---------------------------------------------------------------------------
interface AssessmentHeaderProps {
  candidate: AssessmentCandidate | null;
  round: AssessmentRound | null;
  timer: { formattedTime: string; progressPercent: number; remainingSeconds: number; isExpired: boolean };
  syncCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  isSubmitting: boolean;
  gptEnabled: boolean;
  showCopilot: boolean;
  onToggleCopilot: () => void;
  onSubmit: () => void;
}

function AssessmentHeader({
  candidate, round, timer, syncCount, lastSyncedAt, isSyncing, isSubmitting,
  gptEnabled, showCopilot, onToggleCopilot, onSubmit,
}: AssessmentHeaderProps) {
  const timerColor = timer.progressPercent > 50 ? "text-green-400" : timer.progressPercent > 10 ? "text-yellow-400" : "text-red-400";
  const timerPulse = timer.remainingSeconds <= 300 && timer.remainingSeconds > 0;

  return (
    <div className="w-full border-b bg-[#252526] text-sm px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-muted-foreground text-xs">Candidate:</span>
        <span className="text-foreground font-medium text-xs truncate">{candidate?.name || "\u2014"}</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground text-xs">Round:</span>
        <span className="text-foreground font-medium text-xs truncate">{round?.name || "\u2014"}</span>
      </div>
      <div className="flex-1 flex justify-center">
        <div className={`flex items-center gap-2 font-mono text-base font-semibold ${timerColor} ${timerPulse ? "animate-pulse" : ""}`}>
          <Clock size={16} />
          <span>{timer.formattedTime}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isSyncing ? <RefreshCw size={12} className="animate-spin text-blue-400" /> : lastSyncedAt ? <div className="w-2 h-2 rounded-full bg-green-500" /> : <CloudOff size={12} className="text-gray-500" />}
          <span>{isSyncing ? "Syncing..." : lastSyncedAt ? `Saved (${syncCount})` : "Not synced"}</span>
        </div>
        {gptEnabled && !showCopilot && (
          <button onClick={onToggleCopilot} className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xs" title="Open Copilot">
            <Sparkles size={14} className="text-purple-400" /><span>Copilot</span>
          </button>
        )}
        <Button size="sm" onClick={onSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-4">
          {isSubmitting ? (<><Loader2 size={12} className="animate-spin mr-1" />Submitting</>) : (<><Send size={12} className="mr-1" />Submit</>)}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findFirstEditable(nodes: FileNode[], parentPath = ""): { path: string; node: FileNode } | null {
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.children) { const found = findFirstEditable(node.children, currentPath); if (found) return found; }
    else if (node.isEditable) return { path: currentPath, node };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Status screens
// ---------------------------------------------------------------------------
function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <p className="text-gray-400 text-sm">Verifying your assessment link...</p>
      </div>
    </div>
  );
}

function NoTokenScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center"><AlertTriangle className="text-yellow-500" size={24} /></div>
        <h2 className="text-white text-lg font-semibold">Invalid Assessment Link</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">The assessment link is invalid. Please use the link sent to your email to access the assessment.</p>
      </div>
    </div>
  );
}

function ExpiredScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><Clock className="text-red-500" size={24} /></div>
        <h2 className="text-white text-lg font-semibold">Link Expired</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">Your assessment link has expired. Please contact your recruiter for a new link.</p>
      </div>
    </div>
  );
}

function AlreadySubmittedScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center"><CheckCircle2 className="text-blue-500" size={24} /></div>
        <h2 className="text-white text-lg font-semibold">Already Submitted</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">This assessment has already been submitted. No further edits are possible.</p>
      </div>
    </div>
  );
}

function SubmittedScreen({ submittedAt, syncCount }: { submittedAt: string | null; syncCount: number }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircle2 className="text-green-500" size={32} /></div>
        <h2 className="text-white text-xl font-semibold">Assessment Submitted!</h2>
        <div className="text-gray-400 text-sm text-center space-y-1">
          <p>Your assessment has been submitted successfully.</p>
          {submittedAt && <p className="text-gray-500 text-xs">Submitted at: {new Date(submittedAt).toLocaleString()}</p>}
          <p className="text-gray-500 text-xs">Total saves: {syncCount}</p>
        </div>
        <p className="text-gray-500 text-xs mt-4">You may now close this window.</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><span className="text-red-500 text-2xl">!</span></div>
        <h2 className="text-white text-lg font-semibold">Something Went Wrong</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">{message || "An unexpected error occurred."}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">Retry</button>
      </div>
    </div>
  );
}
