"use client";
import { getPreviewUrl } from "@/utils/previewUrl";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { DiffEditor, Editor } from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Clock,
  User,
  ClipboardCheck,
  PlusCircle,
  X,
  Ban,
  ChevronRight,
  Folder,
  FolderOpen,
  FileIcon,
  Columns2,
  Rows2,
  GitCompareArrows,
  PlayIcon,
  SquareIcon,
  TerminalSquareIcon,
  Trash2Icon,
  CopyIcon,
  CheckIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useEvaluationStore } from "@/store/evaluationStore";
import { evaluationService } from "@/services/evaluationService";
import { allServices } from "@/services/allServices";
import BrowserPreview from "@/components/preview/BrowserPreview";

import { FileNode } from "@/types/types";
import {
  AssessmentCandidate,
  ExistingEvaluation,
  FeedbackCategories,
} from "@/types/assessment";

// ---------------------------------------------------------------------------
// Diff Types
// ---------------------------------------------------------------------------
type DiffStatus = "added" | "modified" | "deleted" | "unchanged";

interface DiffFileNode {
  name: string;
  path: string;
  status: DiffStatus;
  originalContent: string;
  modifiedContent: string;
  children: DiffFileNode[] | null;
}

// ---------------------------------------------------------------------------
// Diff Utilities
// ---------------------------------------------------------------------------
function buildDiffTree(
  template: FileNode[],
  submission: FileNode[],
  parentPath = ""
): DiffFileNode[] {
  const templateMap = new Map<string, FileNode>();
  const submissionMap = new Map<string, FileNode>();

  for (const node of template) templateMap.set(node.name, node);
  for (const node of submission) submissionMap.set(node.name, node);

  const allNames = new Set([...templateMap.keys(), ...submissionMap.keys()]);
  const result: DiffFileNode[] = [];

  for (const name of allNames) {
    const tNode = templateMap.get(name);
    const sNode = submissionMap.get(name);
    const path = parentPath ? `${parentPath}/${name}` : name;

    if (tNode && sNode) {
      // Exists in both
      if (tNode.children && sNode.children) {
        // Both folders → recurse
        const children = buildDiffTree(
          tNode.children,
          sNode.children,
          path
        );
        result.push({
          name,
          path,
          status: "unchanged",
          originalContent: "",
          modifiedContent: "",
          children,
        });
      } else if (!tNode.children && !sNode.children) {
        // Both files → compare content
        const status =
          (tNode.content ?? "") === (sNode.content ?? "")
            ? "unchanged"
            : "modified";
        result.push({
          name,
          path,
          status,
          originalContent: tNode.content ?? "",
          modifiedContent: sNode.content ?? "",
          children: null,
        });
      } else {
        // Type mismatch (folder ↔ file) — treat as delete + add
        if (tNode.children) {
          result.push({
            name,
            path,
            status: "deleted",
            originalContent: "",
            modifiedContent: "",
            children: markAllChildren(tNode.children, "deleted", path),
          });
        } else {
          result.push({
            name,
            path,
            status: "deleted",
            originalContent: tNode.content ?? "",
            modifiedContent: "",
            children: null,
          });
        }
        if (sNode.children) {
          result.push({
            name: name,
            path,
            status: "added",
            originalContent: "",
            modifiedContent: "",
            children: markAllChildren(sNode.children, "added", path),
          });
        } else {
          result.push({
            name,
            path,
            status: "added",
            originalContent: "",
            modifiedContent: sNode.content ?? "",
            children: null,
          });
        }
      }
    } else if (sNode && !tNode) {
      // Only in submission → added
      if (sNode.children) {
        result.push({
          name,
          path,
          status: "added",
          originalContent: "",
          modifiedContent: "",
          children: markAllChildren(sNode.children, "added", path),
        });
      } else {
        result.push({
          name,
          path,
          status: "added",
          originalContent: "",
          modifiedContent: sNode.content ?? "",
          children: null,
        });
      }
    } else if (tNode && !sNode) {
      // Only in template → deleted
      if (tNode.children) {
        result.push({
          name,
          path,
          status: "deleted",
          originalContent: "",
          modifiedContent: "",
          children: markAllChildren(tNode.children, "deleted", path),
        });
      } else {
        result.push({
          name,
          path,
          status: "deleted",
          originalContent: tNode.content ?? "",
          modifiedContent: "",
          children: null,
        });
      }
    }
  }

  // Sort: folders first, then alphabetical
  result.sort((a, b) => {
    const aIsFolder = !!a.children;
    const bIsFolder = !!b.children;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

function markAllChildren(
  nodes: FileNode[],
  status: DiffStatus,
  parentPath: string
): DiffFileNode[] {
  return nodes.map((node) => {
      const path = `${parentPath}/${node.name}`;
      if (node.children) {
        return {
          name: node.name,
          path,
          status,
          originalContent: "",
          modifiedContent: "",
          children: markAllChildren(node.children, status, path),
        };
      }
      return {
        name: node.name,
        path,
        status,
        originalContent: status === "deleted" ? (node.content ?? "") : "",
        modifiedContent: status === "added" ? (node.content ?? "") : "",
        children: null,
      };
    });
}

/** Check if a subtree has any non-unchanged files */
function subtreeHasChanges(nodes: DiffFileNode[]): boolean {
  for (const node of nodes) {
    if (node.status !== "unchanged") return true;
    if (node.children && subtreeHasChanges(node.children)) return true;
  }
  return false;
}

/** Count changes in a subtree */
function countChanges(nodes: DiffFileNode[]): {
  added: number;
  modified: number;
  deleted: number;
} {
  let added = 0;
  let modified = 0;
  let deleted = 0;
  for (const node of nodes) {
    if (!node.children) {
      if (node.status === "added") added++;
      else if (node.status === "modified") modified++;
      else if (node.status === "deleted") deleted++;
    }
    if (node.children) {
      const sub = countChanges(node.children);
      added += sub.added;
      modified += sub.modified;
      deleted += sub.deleted;
    }
  }
  return { added, modified, deleted };
}

// ---------------------------------------------------------------------------
// Language detection (mirrored from EditorPannel.tsx)
// ---------------------------------------------------------------------------
const getFileLanguage = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "m": return "matlab";
    case "f90": return "fortran";
    case "css": return "css";
    case "html": return "html";
    case "d": return "dlang";
    case "lua": return "lua";
    case "elixir": return "elixir";
    case "hs": return "haskell";
    case "perl": return "perl";
    case "php": return "php";
    case "scala": return "scala";
    case "kt": return "kotlin";
    case "swift": return "swift";
    case "rs": return "rust";
    case "go": return "go";
    case "rb": return "ruby";
    case "cpp": return "cpp";
    case "c": return "c";
    case "cs": return "csharp";
    case "java": return "java";
    case "py": return "python";
    case "js": return "javascript";
    case "ts": return "typescript";
    case "tsx": return "typescript";
    case "jsx": return "javascript";
    case "json": return "json";
    case "md": return "markdown";
    case "yml":
    case "yaml": return "yaml";
    case "xml": return "xml";
    case "sql": return "sql";
    case "sh":
    case "bash": return "shell";
    case "txt": return "text";
    default: return ext;
  }
};

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<
  DiffStatus,
  { label: string; color: string; bg: string; textColor: string }
> = {
  added: { label: "A", color: "text-green-400", bg: "bg-green-500/20", textColor: "text-green-400" },
  modified: { label: "M", color: "text-yellow-400", bg: "bg-yellow-500/20", textColor: "text-yellow-400" },
  deleted: { label: "D", color: "text-red-400", bg: "bg-red-500/20", textColor: "text-red-400" },
  unchanged: { label: "", color: "text-muted-foreground", bg: "", textColor: "text-muted-foreground" },
};

// ---------------------------------------------------------------------------
// Main page export
// ---------------------------------------------------------------------------
export default function Page() {
  const pathname = usePathname();
  const prefix = "/project-assessment/evaluate/token=";
  const token = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : null;

  if (!token) {
    return <NoTokenScreen />;
  }

  return <EvaluationShell token={token} />;
}

// ---------------------------------------------------------------------------
// Shell: verify token → render workstation or status screen
// ---------------------------------------------------------------------------
function EvaluationShell({ token }: { token: string }) {
  const store = useEvaluationStore();

  React.useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      store.setUrlToken(token);
      store.setStatus("loading");
      try {
        const data = await evaluationService.verifyEvaluationToken(token);
        if (!cancelled) {
          store.initFromSecureResponse(data);
        }
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401) {
          store.setStatus("expired");
        } else if (status === 404) {
          store.setStatus("not_found");
        } else if (status === 403) {
          store.setStatus("forbidden");
        } else {
          store.setError(
            err?.response?.data?.detail ||
              err?.response?.data?.message ||
              "Failed to verify evaluation token"
          );
        }
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  switch (store.status) {
    case "loading":
      return <LoadingScreen />;
    case "expired":
      return <ExpiredScreen />;
    case "not_found":
      return <NotFoundScreen />;
    case "forbidden":
      return <ForbiddenScreen />;
    case "error":
      return <ErrorScreen message={store.errorMessage} />;
    case "submitted":
      return (
        <SubmittedScreen
          evaluatedAt={store.reviewSubmittedAt}
          evaluatedBy={store.reviewSubmittedBy}
          score={store.formData.score}
        />
      );
    case "ready":
    case "submitting":
      return <EvaluationWorkstation />;
    default:
      return <LoadingScreen />;
  }
}

// ---------------------------------------------------------------------------
// EvaluationWorkstation — diff-based evaluation interface
// ---------------------------------------------------------------------------
function EvaluationWorkstation() {
  const store = useEvaluationStore();

  // Build the merged diff tree
  const diffTree = useMemo(
    () => buildDiffTree(store.projectFiles, store.submissionFiles),
    [store.projectFiles, store.submissionFiles]
  );

  const changeSummary = useMemo(() => countChanges(diffTree), [diffTree]);

  // Editor state
  const [openFiles, setOpenFiles] = useState<DiffFileNode[]>([]);
  const [activeFile, setActiveFile] = useState<DiffFileNode | null>(null);
  const [sideBySide, setSideBySide] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Project type detection
  const framework = store.projectMetadata?.framework;
  const isNotebook = framework === "jupyter";

  // Terminal & execution state
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [terminalCopied, setTerminalCopied] = useState(false);
  const cancelledRef = useRef(false);

  // Notebook kernel state
  const [notebookSessionId, setNotebookSessionId] = useState<string | null>(null);

  // Browser preview state (regular projects only)
  const [devServerPort, setDevServerPort] = useState<number | null>(null);
  const [showBrowserPreview, setShowBrowserPreview] = useState(false);
  const [browserPreviewFullscreen, setBrowserPreviewFullscreen] = useState(false);

  // Terminal helpers
  const writeToTerminal = useCallback((text: string) => {
    const lines = text.split(/\r?\n/);
    setTerminalLines((prev) => [...prev, ...lines.filter((l, i) => i < lines.length - 1 || l !== "")]);
  }, []);
  const writelnToTerminal = useCallback((text: string) => {
    setTerminalLines((prev) => [...prev, text]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      cancelledRef.current = true;
    };
  }, []);

  // Cleanup notebook kernel on unmount
  useEffect(() => {
    return () => {
      if (notebookSessionId) {
        allServices.notebook.deleteSession(notebookSessionId).catch(() => {});
      }
    };
  }, [notebookSessionId]);

  // Stream output from execution server
  const streamOutput = useCallback(async (sid: string, signal: AbortSignal) => {
    try {
      const streamResponse = await fetch(`/workstation-api/projects/stream/${sid}`, {
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
              (lowerData.includes("running on") && lowerData.includes("http://")) ||
              lowerData.includes("server is running") ||
              lowerData.includes("server running") ||
              lowerData.includes("listening on") ||
              lowerData.includes("app listening")
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
  }, [writeToTerminal, writelnToTerminal]);

  // ── Notebook helpers ──────────────────────────────────────────────
  /** Extract code cells from all .ipynb files in a FileNode tree */
  const extractNotebookCells = useCallback((files: FileNode[]): { path: string; index: number; source: string }[] => {
    const cells: { path: string; index: number; source: string }[] = [];
    const walk = (nodes: FileNode[], prefix: string) => {
      for (const n of nodes) {
        const p = prefix ? `${prefix}/${n.name}` : n.name;
        if (n.children) { walk(n.children, p); continue; }
        if (!n.name.endsWith(".ipynb") || !n.content) continue;
        try {
          const nb = JSON.parse(n.content);
          const nbCells: any[] = nb?.cells ?? [];
          nbCells.forEach((c, i) => {
            if (c.cell_type !== "code") return;
            const src = Array.isArray(c.source) ? c.source.join("") : (c.source ?? "");
            if (src.trim()) cells.push({ path: p, index: i, source: src });
          });
        } catch { /* skip unparseable */ }
      }
    };
    walk(files, "");
    return cells;
  }, []);

  /** Find requirements.txt in file tree */
  const findRequirementsTxt = useCallback((files: FileNode[]): string | undefined => {
    for (const f of files) {
      if (f.name === "requirements.txt" && f.content) return f.content;
      if (f.children) { const r = findRequirementsTxt(f.children); if (r) return r; }
    }
    return undefined;
  }, []);

  // ── Run (branched by project type) ─────────────────────────────
  const runCode = useCallback(async () => {
    setTerminalLines([]);
    setShowTerminal(true);
    cancelledRef.current = false;

    if (isNotebook) {
      // ── Notebook execution: create kernel → run all code cells ──
      writelnToTerminal("$ Running notebook cells...");
      setIsRunning(true);
      try {
        // Create kernel session with submission files for imports
        const requirementsTxt = findRequirementsTxt(store.submissionFiles);
        const session = await allServices.notebook.createSession(store.submissionFiles, requirementsTxt);
        setNotebookSessionId(session.session_id);
        writelnToTerminal(`Kernel started (session: ${session.session_id})`);
        writelnToTerminal("");

        // Extract code cells from all .ipynb files
        const cells = extractNotebookCells(store.submissionFiles);
        if (cells.length === 0) {
          writelnToTerminal("\u26a0 No code cells found in notebook files.");
          setIsRunning(false);
          return;
        }
        writelnToTerminal(`Found ${cells.length} code cell(s) across notebook files.`);
        writelnToTerminal("");

        let currentNotebook = "";
        for (let ci = 0; ci < cells.length; ci++) {
          if (cancelledRef.current) { writelnToTerminal("\n\u26a0 Execution cancelled by user"); break; }

          const cell = cells[ci];
          // Print notebook file header when switching notebooks
          if (cell.path !== currentNotebook) {
            currentNotebook = cell.path;
            writelnToTerminal(`\u2500\u2500 ${cell.path} \u2500\u2500`);
          }
          writelnToTerminal(`In [${ci + 1}]:`);
          // Show the source code (truncated preview)
          const preview = cell.source.split("\n").slice(0, 4).join("\n");
          writelnToTerminal(preview);
          if (cell.source.split("\n").length > 4) writelnToTerminal("  ...");
          writelnToTerminal("");

          try {
            const result = await allServices.notebook.executeCell(session.session_id, cell.source);
            // Render outputs
            if (result.outputs && result.outputs.length > 0) {
              for (const out of result.outputs) {
                if (out.text) {
                  const text = Array.isArray(out.text) ? out.text.join("") : out.text;
                  writeToTerminal(text);
                } else if (out.data?.["text/plain"]) {
                  const d = out.data["text/plain"];
                  const text = Array.isArray(d) ? (d as string[]).join("") : String(d);
                  writeToTerminal(text);
                }
                if (out.ename) {
                  writelnToTerminal(`\u2717 ${out.ename}: ${out.evalue}`);
                  if (out.traceback) {
                    for (const tb of out.traceback) {
                      // Strip ANSI codes from traceback
                      writelnToTerminal(tb.replace(/\x1b\[[0-9;]*m/g, ""));
                    }
                  }
                }
              }
            }
            if (result.status === "error") {
              writelnToTerminal(`\u2717 Cell ${ci + 1} failed.`);
            }
            writelnToTerminal("");
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            writelnToTerminal(`\u2717 Cell ${ci + 1} error: ${errMsg}`);
            writelnToTerminal("");
          }
        }

        if (!cancelledRef.current) writelnToTerminal("\u2713 All cells executed.");
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        writelnToTerminal(`\u2717 Error: ${errMsg}`);
      } finally {
        setIsRunning(false);
      }
    } else {
      // ── Regular project execution: dev server ──
      writelnToTerminal("$ Running project...");
      try {
        setIsRunning(true);
        const response = await allServices.runProject(store.submissionFiles);
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
    }
  }, [isNotebook, store.submissionFiles, writelnToTerminal, writeToTerminal, streamOutput, extractNotebookCells, findRequirementsTxt]);

  const stopCode = useCallback(async () => {
    if (isNotebook) {
      // ── Notebook: cancel running + interrupt kernel ──
      cancelledRef.current = true;
      if (notebookSessionId) {
        try { await allServices.notebook.interruptKernel(notebookSessionId); writelnToTerminal("\u26a0 Kernel interrupted"); }
        catch (e) { console.error("Failed to interrupt kernel:", e); }
      }
    } else {
      // ── Regular project: stop dev server ──
      if (sessionId) {
        try { await allServices.stopProject(sessionId); writelnToTerminal("\u26a0 Process stopped by user"); }
        catch (e) { console.error("Failed to stop:", e); }
      }
      if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
      setDevServerPort(null);
      setShowBrowserPreview(false);
      setBrowserPreviewFullscreen(false);
    }
    setIsRunning(false);
    setSessionId(null);
  }, [isNotebook, notebookSessionId, sessionId, writelnToTerminal]);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const copyTerminalOutput = useCallback(async () => {
    const text = terminalLines.join("\n");
    if (text) {
      await navigator.clipboard.writeText(text);
      setTerminalCopied(true);
      setTimeout(() => setTerminalCopied(false), 2000);
    }
  }, [terminalLines]);

  const handleCloseBrowserPreview = useCallback(() => {
    setShowBrowserPreview(false);
    setBrowserPreviewFullscreen(false);
  }, []);

  const handleToggleBrowserFullscreen = useCallback(() => {
    setBrowserPreviewFullscreen((p) => !p);
  }, []);

  // Handle file selection from diff tree
  const handleSelectFile = useCallback(
    (node: DiffFileNode) => {
      if (node.children) return;
      if (!openFiles.some((f) => f.path === node.path)) {
        setOpenFiles((prev) => [...prev, node]);
      }
      setActiveFile(node);
    },
    [openFiles]
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      const newFiles = openFiles.filter((f) => f.path !== path);
      setOpenFiles(newFiles);
      if (activeFile?.path === path) {
        setActiveFile(newFiles[newFiles.length - 1] || null);
      }
    },
    [openFiles, activeFile]
  );

  // Validate form before showing submit dialog
  const handleSubmitClick = () => {
    if (store.formData.score < 0 || store.formData.score > 100) {
      toast.error("Score must be between 0 and 100");
      return;
    }
    if (!store.formData.report.trim()) {
      toast.error("Report is required");
      return;
    }
    setShowSubmitDialog(true);
  };

  // Submit handler
  const handleSubmitReview = async () => {
    if (!store.secureToken) return;
    store.setIsSubmitting(true);
    store.setStatus("submitting");
    setShowSubmitDialog(false);
    try {
      const result = await evaluationService.submitReview(
        store.secureToken,
        store.formData.score,
        store.formData.report,
        store.formData.feedback_categories
      );
      store.markReviewSubmitted(
        result.evaluated_at,
        result.evaluated_by,
        result.score
      );
      toast.success("Evaluation submitted successfully!");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        store.setStatus("expired");
        toast.error(
          "Session expired. Please go back and click Evaluate again."
        );
      } else {
        toast.error(
          err?.response?.data?.detail ||
            err?.response?.data?.message ||
            "Failed to submit evaluation"
        );
        store.setStatus("ready");
        store.setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col dark:bg-[#181818]">
      {/* Evaluation Header */}
      <EvaluationHeader
        candidate={store.candidate}
        round={store.round}
        submittedAt={store.submittedAt}
        syncCount={store.syncCount}
        isSubmitting={store.isSubmitting}
        existingEvaluation={store.existingEvaluation}
        onSubmit={handleSubmitClick}
        isRunning={isRunning}
        showTerminal={showTerminal}
        isNotebook={isNotebook}
        onRun={runCode}
        onStop={stopCode}
        onToggleTerminal={() => setShowTerminal((p) => !p)}
      />

      {/* Main Body */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Left Panel: Diff File Tree */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
            <div className="h-full border-r dark:bg-[#181818] flex flex-col">
              {/* Tree header with change summary */}
              <div className="px-3 py-2 border-b bg-[#252526] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GitCompareArrows size={13} className="text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Changes
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {changeSummary.modified > 0 && (
                    <span className="text-[10px] font-mono text-yellow-400">
                      ~{changeSummary.modified}
                    </span>
                  )}
                  {changeSummary.added > 0 && (
                    <span className="text-[10px] font-mono text-green-400">
                      +{changeSummary.added}
                    </span>
                  )}
                  {changeSummary.deleted > 0 && (
                    <span className="text-[10px] font-mono text-red-400">
                      -{changeSummary.deleted}
                    </span>
                  )}
                </div>
              </div>

              {/* Diff file tree */}
              <ScrollArea className="flex-1">
                <div className="p-1">
                  <DiffFileTree
                    nodes={diffTree}
                    selectedPath={activeFile?.path ?? null}
                    onSelect={handleSelectFile}
                    depth={0}
                  />
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel: Diff Editor + Terminal */}
          <ResizablePanel defaultSize={52}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              {/* Diff Editor area */}
              <ResizablePanel defaultSize={showTerminal ? 70 : 100} minSize={30}>
                <div className="h-full flex flex-col">
                  {/* Tab bar */}
                  {openFiles.length > 0 && (
                    <div className="flex items-center border-b bg-[#252526] overflow-x-auto">
                      <div className="flex items-center flex-1 min-w-0">
                        {openFiles.map((file) => {
                          const isActive = activeFile?.path === file.path;
                          const cfg = STATUS_CONFIG[file.status];
                          return (
                            <div
                              key={file.path}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-[#1e1e1e] shrink-0 ${
                                isActive
                                  ? "bg-[#1e1e1e] text-foreground"
                                  : "text-muted-foreground hover:bg-[#2a2a2a]"
                              }`}
                              onClick={() => setActiveFile(file)}
                            >
                              {file.status !== "unchanged" && (
                                <span
                                  className={`text-[10px] font-bold ${cfg.color}`}
                                >
                                  {cfg.label}
                                </span>
                              )}
                              <span className="truncate max-w-[150px]">
                                {file.name}
                              </span>
                              <button
                                className="ml-1 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseTab(file.path);
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Diff mode toggle */}
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="px-2 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
                              onClick={() => setSideBySide((v) => !v)}
                            >
                              {sideBySide ? (
                                <Rows2 size={14} />
                              ) : (
                                <Columns2 size={14} />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="text-xs">
                              {sideBySide
                                ? "Switch to inline diff"
                                : "Switch to side-by-side diff"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}

                  {/* Diff viewer */}
                  <div className="flex-1 relative">
                    <ResizablePanelGroup direction="horizontal" className="h-full">
                      <ResizablePanel defaultSize={showBrowserPreview && devServerPort && !browserPreviewFullscreen ? 60 : 100} minSize={30}>
                        {activeFile ? (
                          activeFile.name.endsWith(".ipynb") ? (
                            /* Notebook side-by-side viewer */
                            <NotebookDiffViewer
                              originalJson={activeFile.originalContent}
                              modifiedJson={activeFile.modifiedContent}
                              status={activeFile.status}
                              path={activeFile.path}
                            />
                          ) : (
                            /* Standard code diff */
                            <>
                              {/* File path breadcrumb with diff labels */}
                              <div className="flex items-center justify-between px-3 py-1 bg-[#1e1e1e] border-b border-[#333] text-[11px]">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    {activeFile.path}
                                  </span>
                                  {activeFile.status !== "unchanged" && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_CONFIG[activeFile.status].bg} ${STATUS_CONFIG[activeFile.status].textColor}`}
                                    >
                                      {activeFile.status === "added" && "Added"}
                                      {activeFile.status === "modified" && "Modified"}
                                      {activeFile.status === "deleted" && "Deleted"}
                                    </span>
                                  )}
                                </div>
                                {activeFile.status === "modified" && sideBySide && (
                                  <div className="flex items-center gap-4 text-[10px]">
                                    <span className="text-red-400/70">Template (original)</span>
                                    <span className="text-green-400/70">Submission (modified)</span>
                                  </div>
                                )}
                              </div>

                              <DiffEditor
                                original={activeFile.originalContent}
                                modified={activeFile.modifiedContent}
                                language={getFileLanguage(activeFile.name)}
                                theme="vs-dark"
                                options={{
                                  readOnly: true,
                                  renderSideBySide: sideBySide,
                                  minimap: { enabled: false },
                                  scrollBeyondLastLine: false,
                                  fontSize: 13,
                                  lineHeight: 20,
                                  renderOverviewRuler: false,
                                  domReadOnly: true,
                                  enableSplitViewResizing: true,
                                }}
                              />
                            </>
                          )
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                            <GitCompareArrows size={40} className="opacity-30" />
                            <p className="text-sm">
                              Select a file to view the diff
                            </p>
                            <p className="text-xs opacity-60">
                              Template (original) vs Submission (modified)
                            </p>
                          </div>
                        )}
                      </ResizablePanel>

                      {/* Browser Preview (dev server) */}
                      {showBrowserPreview && devServerPort && !browserPreviewFullscreen && (
                        <>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={40} minSize={20}>
                            <BrowserPreview url={getPreviewUrl(devServerPort)} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={false} />
                            {/* <BrowserPreview url={`/dev-preview/${devServerPort}/`} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={false} /> */}
                          </ResizablePanel>
                        </>
                      )}
                    </ResizablePanelGroup>
                  </div>
                </div>
              </ResizablePanel>

              {/* Terminal */}
              {showTerminal && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={30} minSize={10} maxSize={70}>
                    <div className="h-full flex flex-col bg-[#1e1e1e] border-t">
                      <div className="flex items-center justify-between px-2 py-1 border-b text-sm">
                        <div className="flex items-center gap-2">
                          <TerminalSquareIcon size={16} />
                          <span>Terminal</span>
                          {isRunning && <Loader2Icon size={14} className="animate-spin text-green-500" />}
                        </div>
                        <div className="flex items-center gap-1">
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
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearTerminal} title="Clear">
                            <Trash2Icon size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowTerminal(false)} title="Close terminal">
                            <X size={14} />
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

          <ResizableHandle />

          {/* Right Panel: Evaluation Form */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
            <ScrollArea className="h-full">
              <div className="p-4">
                <EvaluationFormPanel
                  formData={store.formData}
                  onScoreChange={store.setScore}
                  onReportChange={store.setReport}
                  onCategoryChange={store.setFeedbackCategory}
                  onCategoryRemove={store.removeFeedbackCategory}
                  onCategoryAdd={store.addFeedbackCategory}
                  isSubmitting={store.isSubmitting}
                  isResubmission={store.existingEvaluation !== null}
                  onSubmit={handleSubmitClick}
                />
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {store.existingEvaluation
                ? "Update Evaluation"
                : "Submit Evaluation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {store.existingEvaluation
                ? "This will overwrite the previous evaluation. Are you sure?"
                : "Are you sure you want to submit this evaluation?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={store.isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitReview}
              disabled={store.isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {store.isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={14} className="mr-2" />
                  {store.existingEvaluation ? "Update" : "Submit"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Browser Preview */}
      {showBrowserPreview && browserPreviewFullscreen && devServerPort && (
        <div className="fixed inset-0 z-50 bg-black">
          <BrowserPreview url={getPreviewUrl(devServerPort)} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={true} />
          {/* <BrowserPreview url={`/dev-preview/${devServerPort}/`} onClose={handleCloseBrowserPreview} onToggleFullscreen={handleToggleBrowserFullscreen} isFullscreen={true} /> */}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffFileTree — recursive file tree with diff status indicators
// ---------------------------------------------------------------------------
function DiffFileTree({
  nodes,
  selectedPath,
  onSelect,
  depth,
}: {
  nodes: DiffFileNode[];
  selectedPath: string | null;
  onSelect: (node: DiffFileNode) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <DiffFileTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </>
  );
}

function DiffFileTreeNode({
  node,
  selectedPath,
  onSelect,
  depth,
}: {
  node: DiffFileNode;
  selectedPath: string | null;
  onSelect: (node: DiffFileNode) => void;
  depth: number;
}) {
  const isFolder = !!node.children;
  const hasChanges = isFolder && node.children
    ? subtreeHasChanges(node.children)
    : node.status !== "unchanged";

  // Auto-expand folders that contain changes (first 3 levels)
  const [expanded, setExpanded] = useState(
    isFolder && (depth < 2 || hasChanges)
  );

  const isSelected = !isFolder && selectedPath === node.path;
  const cfg = STATUS_CONFIG[node.status];

  const handleClick = () => {
    if (isFolder) {
      setExpanded((v) => !v);
    } else {
      onSelect(node);
    }
  };

  // Determine the effective status color for folders (based on children)
  const folderHasChanges = isFolder && node.children
    ? subtreeHasChanges(node.children)
    : false;

  return (
    <>
      <div
        className={`flex items-center gap-1 py-[2px] px-1 rounded cursor-pointer text-xs group ${
          isSelected
            ? "bg-blue-600/20 text-foreground"
            : "hover:bg-[#2a2a2a] text-muted-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
      >
        {/* Expand chevron for folders */}
        {isFolder ? (
          <ChevronRight
            size={14}
            className={`shrink-0 transition-transform duration-150 ${
              expanded ? "rotate-90" : ""
            } ${folderHasChanges ? "text-yellow-400/60" : "text-muted-foreground"}`}
          />
        ) : (
          <span className="w-[14px] shrink-0" />
        )}

        {/* Icon */}
        {isFolder ? (
          expanded ? (
            <FolderOpen size={14} className={folderHasChanges ? "text-yellow-400/60" : "text-muted-foreground"} />
          ) : (
            <Folder size={14} className={folderHasChanges ? "text-yellow-400/60" : "text-muted-foreground"} />
          )
        ) : (
          <FileIcon size={14} className={cfg.color} />
        )}

        {/* Name */}
        <span
          className={`truncate flex-1 ${
            !isFolder && node.status === "deleted"
              ? "line-through opacity-60"
              : ""
          } ${!isFolder ? cfg.color : ""}`}
        >
          {node.name}
        </span>

        {/* Status badge */}
        {!isFolder && node.status !== "unchanged" && (
          <span
            className={`text-[9px] font-bold px-1 rounded ${cfg.bg} ${cfg.textColor} shrink-0`}
          >
            {cfg.label}
          </span>
        )}

        {/* Folder change indicator dot */}
        {isFolder && folderHasChanges && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/60 shrink-0" />
        )}
      </div>

      {/* Children */}
      {isFolder && expanded && node.children && (
        <DiffFileTree
          nodes={node.children}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// NotebookDiffViewer — side-by-side cell comparison for .ipynb files
// ---------------------------------------------------------------------------
interface ParsedCell {
  cell_type: string;
  source: string;
  outputs?: string;
}

function parseNotebookCells(json: string): ParsedCell[] {
  if (!json) return [];
  try {
    const nb = JSON.parse(json);
    const cells: any[] = nb?.cells ?? [];
    return cells.map((cell) => {
      const source = Array.isArray(cell.source)
        ? cell.source.join("")
        : cell.source ?? "";
      let outputs = "";
      if (Array.isArray(cell.outputs)) {
        outputs = cell.outputs
          .map((o: any) => {
            if (o.text) return Array.isArray(o.text) ? o.text.join("") : o.text;
            if (o.data?.["text/plain"]) {
              const d = o.data["text/plain"];
              return Array.isArray(d) ? d.join("") : d;
            }
            if (o.ename) return `${o.ename}: ${o.evalue}`;
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }
      return { cell_type: cell.cell_type ?? "code", source, outputs };
    });
  } catch {
    return [];
  }
}

function NotebookDiffViewer({
  originalJson,
  modifiedJson,
  status,
  path,
}: {
  originalJson: string;
  modifiedJson: string;
  status: DiffStatus;
  path: string;
}) {
  const originalCells = useMemo(() => parseNotebookCells(originalJson), [originalJson]);
  const modifiedCells = useMemo(() => parseNotebookCells(modifiedJson), [modifiedJson]);

  const maxLen = Math.max(originalCells.length, modifiedCells.length);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#1e1e1e] border-b border-[#333] text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{path}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
            Notebook
          </span>
          {status !== "unchanged" && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].textColor}`}
            >
              {status === "added" && "Added"}
              {status === "modified" && "Modified"}
              {status === "deleted" && "Deleted"}
            </span>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 border-b border-[#333] text-[11px]">
        <div className="px-3 py-1 bg-[#1e1e1e] text-red-400/70 border-r border-[#333]">
          Template ({originalCells.length} cells)
        </div>
        <div className="px-3 py-1 bg-[#1e1e1e] text-green-400/70">
          Submission ({modifiedCells.length} cells)
        </div>
      </div>

      {/* Side-by-side cells */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-[#333]">
          {Array.from({ length: maxLen }, (_, i) => {
            const oCell = originalCells[i] ?? null;
            const mCell = modifiedCells[i] ?? null;
            const cellChanged =
              oCell?.source !== mCell?.source ||
              oCell?.cell_type !== mCell?.cell_type;

            return (
              <div key={i} className="grid grid-cols-2">
                {/* Original cell */}
                <div
                  className={`border-r border-[#333] ${
                    !oCell
                      ? "bg-[#1a1a1a]"
                      : cellChanged
                        ? "bg-red-500/5"
                        : ""
                  }`}
                >
                  {oCell ? (
                    <NotebookCellView index={i} cell={oCell} />
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground/30 italic">
                      No cell
                    </div>
                  )}
                </div>

                {/* Modified cell */}
                <div
                  className={`${
                    !mCell
                      ? "bg-[#1a1a1a]"
                      : cellChanged
                        ? "bg-green-500/5"
                        : ""
                  }`}
                >
                  {mCell ? (
                    <NotebookCellView index={i} cell={mCell} />
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground/30 italic">
                      No cell
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function NotebookCellView({ index, cell }: { index: number; cell: ParsedCell }) {
  const isMarkdown = cell.cell_type === "markdown";
  const language = isMarkdown ? "markdown" : "python";
  const lineCount = cell.source.split("\n").length;

  return (
    <div className="text-xs ">
      {/* Cell header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e]/50 rounded-t border border-[#333] border-b-0">
        <span className="text-muted-foreground/50 font-mono text-[10px]">
          [{index + 1}]
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            !isMarkdown
              ? "bg-blue-500/15 text-blue-400"
              : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          {cell.cell_type}
        </span>
      </div>

      {/* Cell source */}
      {isMarkdown ? (
        <div className="border border-[#333] bg-[#1e1e1e] px-4 py-3 prose prose-invert prose-xs max-w-none text-[12px] leading-relaxed [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mb-0.5 [&_code]:bg-[#333] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-[#252526] [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-[11px] [&_a]:text-blue-400">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {cell.source}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="border border-[#333] rounded-b overflow-hidden">
          <Editor
            height={`${Math.min(Math.max(lineCount * 19, 38), 400)}px`}
            defaultLanguage={language}
            value={cell.source}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "off",
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: 0,
              renderLineHighlight: "none",
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: { vertical: "hidden", horizontal: "auto" },
              fontSize: 12,
              padding: { top: 8, bottom: 8 },
              domReadOnly: true,
              wordWrap: "on",
            }}
          />
        </div>
      )}

      {/* Cell outputs (if any) */}
      {cell.outputs && (
        <div className="border border-t-0 border-[#333] bg-[#1a1a2e] rounded-b px-4 py-3 mt-0">
          <span className="text-[10px] text-muted-foreground/50 block mb-1.5 uppercase tracking-wide">
            Output
          </span>
          <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-all font-mono leading-relaxed">
            {cell.outputs}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvaluationHeader
// ---------------------------------------------------------------------------
interface EvaluationHeaderProps {
  candidate: AssessmentCandidate | null;
  round: { id: string; name: string | null; type: string } | null;
  submittedAt: string | null;
  syncCount: number;
  isSubmitting: boolean;
  existingEvaluation: ExistingEvaluation | null;
  onSubmit: () => void;
  isRunning: boolean;
  showTerminal: boolean;
  isNotebook: boolean;
  onRun: () => void;
  onStop: () => void;
  onToggleTerminal: () => void;
}

function EvaluationHeader({
  candidate,
  round,
  submittedAt,
  syncCount,
  isSubmitting,
  existingEvaluation,
  onSubmit,
  isRunning,
  showTerminal,
  isNotebook,
  onRun,
  onStop,
  onToggleTerminal,
}: EvaluationHeaderProps) {
  return (
    <div className="w-full border-b bg-[#252526] text-sm px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <User size={14} className="text-muted-foreground shrink-0" />
        <span className="text-muted-foreground text-xs">Candidate:</span>
        <span className="text-foreground font-medium text-xs truncate">
          {candidate?.name || "\u2014"}
        </span>
        {candidate?.email && (
          <span className="text-muted-foreground text-xs truncate">
            ({candidate.email})
          </span>
        )}
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground text-xs">Round:</span>
        <span className="text-foreground font-medium text-xs truncate">
          {round?.name || "\u2014"}
        </span>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {submittedAt && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Submitted: {new Date(submittedAt).toLocaleString()}
            </span>
          )}
          <span>Saves: {syncCount}</span>
          {existingEvaluation && (
            <Badge variant="secondary" className="text-xs">
              Previously Evaluated
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Run / Stop button */}
        {isRunning ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onStop}
            className="text-red-500 border-red-500/30 hover:bg-red-500/10 text-xs h-7 px-3"
          >
            <SquareIcon size={12} className="mr-1" />
            {isNotebook ? "Interrupt" : "Stop"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onRun}
            className="text-xs h-7 px-3"
          >
            <PlayIcon size={12} className="mr-1" />
            {isNotebook ? "Run Cells" : "Run"}
          </Button>
        )}

        {/* Terminal toggle */}
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleTerminal}
          className={`text-xs h-7 px-3 ${showTerminal ? "bg-accent" : ""}`}
        >
          <TerminalSquareIcon size={12} className="mr-1" />
          Terminal
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {/* Submit button */}
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-4"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={12} className="animate-spin mr-1" />
              Submitting
            </>
          ) : (
            <>
              <Send size={12} className="mr-1" />
              {existingEvaluation ? "Update Review" : "Submit Review"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvaluationFormPanel
// ---------------------------------------------------------------------------
interface EvaluationFormPanelProps {
  formData: {
    score: number;
    report: string;
    feedback_categories: FeedbackCategories;
  };
  onScoreChange: (score: number) => void;
  onReportChange: (report: string) => void;
  onCategoryChange: (name: string, value: number) => void;
  onCategoryRemove: (name: string) => void;
  onCategoryAdd: (name: string, value: number) => void;
  isSubmitting: boolean;
  isResubmission: boolean;
  onSubmit: () => void;
}

function EvaluationFormPanel({
  formData,
  onScoreChange,
  onReportChange,
  onCategoryChange,
  onCategoryRemove,
  onCategoryAdd,
  isSubmitting,
  isResubmission,
  onSubmit,
}: EvaluationFormPanelProps) {
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleAddCategory = () => {
    const name = newCategoryName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (name && !(name in formData.feedback_categories)) {
      onCategoryAdd(name, 0);
      setNewCategoryName("");
    }
  };

  const formatCategoryLabel = (key: string): string => {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <ClipboardCheck size={16} />
        Evaluation
      </h2>

      {/* Section: Overall Score */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Overall Score</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Slider
              value={[formData.score]}
              onValueChange={(v) => onScoreChange(v[0])}
              min={0}
              max={100}
              step={0.5}
              disabled={isSubmitting}
              className="flex-1"
            />
            <Input
              type="number"
              value={formData.score}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 100) onScoreChange(val);
              }}
              min={0}
              max={100}
              step={0.5}
              disabled={isSubmitting}
              className="w-20 text-center text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Score from 0 to 100</p>
        </div>
      </div>

      <Separator />

      {/* Section: Feedback Categories */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Feedback Categories</Label>
        <div className="space-y-3">
          {Object.entries(formData.feedback_categories).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatCategoryLabel(key)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onCategoryRemove(key)}
                  disabled={isSubmitting}
                  title={`Remove ${formatCategoryLabel(key)}`}
                >
                  <X size={10} />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[value]}
                  onValueChange={(v) => onCategoryChange(key, v[0])}
                  min={0}
                  max={10}
                  step={0.5}
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8 text-right font-mono">
                  {value.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add new category */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCategory();
              }
            }}
            disabled={isSubmitting}
            className="flex-1 text-xs h-8"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCategory}
            disabled={isSubmitting || !newCategoryName.trim()}
            className="h-8 text-xs"
          >
            <PlusCircle size={12} className="mr-1" />
            Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Section: Report */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Evaluation Report</Label>
        <Textarea
          value={formData.report}
          onChange={(e) => onReportChange(e.target.value)}
          placeholder="Write your detailed evaluation report here..."
          disabled={isSubmitting}
          className="min-h-[200px] text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {formData.report.length} characters
        </p>
      </div>

      {isResubmission && (
        <p className="text-xs text-yellow-500">
          Submitting will overwrite the previous evaluation.
        </p>
      )}

      {/* Submit button */}
      <Button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin mr-2" />
            Submitting...
          </>
        ) : (
          <>
            <Send size={14} className="mr-2" />
            {isResubmission ? "Update Review" : "Submit Review"}
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status screens
// ---------------------------------------------------------------------------
function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <p className="text-gray-400 text-sm">Loading evaluation data...</p>
      </div>
    </div>
  );
}

function NoTokenScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <AlertTriangle className="text-yellow-500" size={24} />
        </div>
        <h2 className="text-white text-lg font-semibold">
          Invalid Evaluation Link
        </h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          The evaluation link is invalid. Please use the link provided in the
          admin panel to access the evaluation.
        </p>
      </div>
    </div>
  );
}

function ExpiredScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <Clock className="text-red-500" size={24} />
        </div>
        <h2 className="text-white text-lg font-semibold">Link Expired</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          Your evaluation link has expired. Please go back to the admin panel
          and click &quot;Evaluate&quot; again to generate a new link.
        </p>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-500/20 flex items-center justify-center">
          <AlertTriangle className="text-gray-400" size={24} />
        </div>
        <h2 className="text-white text-lg font-semibold">Not Found</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          The project or submission could not be found. It may have been
          removed.
        </p>
      </div>
    </div>
  );
}

function ForbiddenScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <Ban className="text-red-500" size={24} />
        </div>
        <h2 className="text-white text-lg font-semibold">Access Denied</h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          You do not have permission to evaluate this submission.
        </p>
      </div>
    </div>
  );
}

function SubmittedScreen({
  evaluatedAt,
  evaluatedBy,
  score,
}: {
  evaluatedAt: string | null;
  evaluatedBy: string | null;
  score: number;
}) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="text-green-500" size={32} />
        </div>
        <h2 className="text-white text-xl font-semibold">
          Evaluation Submitted!
        </h2>
        <div className="text-gray-400 text-sm text-center space-y-1">
          <p>Your evaluation has been submitted successfully.</p>
          <p className="text-gray-500 text-xs">Score: {score}/100</p>
          {evaluatedAt && (
            <p className="text-gray-500 text-xs">
              Submitted at: {new Date(evaluatedAt).toLocaleString()}
            </p>
          )}
          {evaluatedBy && (
            <p className="text-gray-500 text-xs">By: {evaluatedBy}</p>
          )}
        </div>
        <p className="text-gray-500 text-xs mt-4">
          You may now close this window.
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-500 text-2xl">!</span>
        </div>
        <h2 className="text-white text-lg font-semibold">
          Something Went Wrong
        </h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          {message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
