"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Editor } from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  XIcon,
  CodeIcon,
  FileTextIcon,
  Loader2Icon,
  RotateCcwIcon,
  StopCircleIcon,
  CircleIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PackageIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  CopyIcon,
  EraserIcon,
} from "lucide-react";
import { NotebookContent, NotebookCell, NotebookOutput } from "@/types/types";
import { allServices } from "@/services/allServices";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotebookEditorProps {
  content: string;
  isEditable: boolean;
  onContentChange?: (content: string) => void;
  requirementsTxt?: string;  // Contents of requirements.txt to install packages on kernel start
}

type KernelStatus = "disconnected" | "connecting" | "idle" | "busy" | "error";

// Parse notebook JSON safely
function parseNotebook(content: string): NotebookContent | null {
  try {
    return JSON.parse(content) as NotebookContent;
  } catch {
    return null;
  }
}

// Get cell source as string
function getCellSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

// Render cell output
function CellOutput({ output }: { output: NotebookOutput }) {
  if (output.output_type === "stream") {
    const text = output.text?.join("") || "";
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap text-gray-300 bg-[#1e1e1e] p-2 overflow-x-auto">
        {text}
      </pre>
    );
  }

  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    const data = output.data || {};

    // Render PNG image if available
    if (data["image/png"]) {
      const imgData = Array.isArray(data["image/png"])
        ? data["image/png"].join("")
        : String(data["image/png"]);
      return (
        <div className="p-2 bg-[#1e1e1e] overflow-x-auto">
          <img
            src={`data:image/png;base64,${imgData}`}
            alt="Output"
            className="max-w-full h-auto"
          />
        </div>
      );
    }

    // Render JPEG image if available
    if (data["image/jpeg"]) {
      const imgData = Array.isArray(data["image/jpeg"])
        ? data["image/jpeg"].join("")
        : String(data["image/jpeg"]);
      return (
        <div className="p-2 bg-[#1e1e1e] overflow-x-auto">
          <img
            src={`data:image/jpeg;base64,${imgData}`}
            alt="Output"
            className="max-w-full h-auto"
          />
        </div>
      );
    }

    // Render SVG if available
    if (data["image/svg+xml"]) {
      const svg = Array.isArray(data["image/svg+xml"])
        ? data["image/svg+xml"].join("")
        : String(data["image/svg+xml"]);
      return (
        <div
          className="p-2 bg-[#1e1e1e] overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      );
    }

    // Render HTML if available
    if (data["text/html"]) {
      const html = Array.isArray(data["text/html"])
        ? data["text/html"].join("")
        : String(data["text/html"]);
      return (
        <div
          className="notebook-output-html overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Fallback to plain text
    if (data["text/plain"]) {
      const text = Array.isArray(data["text/plain"])
        ? data["text/plain"].join("")
        : String(data["text/plain"]);
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap text-gray-300 bg-[#1e1e1e] p-2 overflow-x-auto">
          {text}
        </pre>
      );
    }
  }

  if (output.output_type === "error") {
    const traceback = output.traceback?.join("\n") || `${output.ename}: ${output.evalue}`;
    // Strip ANSI codes for display
    const cleanTraceback = traceback.replace(/\u001b\[[0-9;]*m/g, "");
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap text-red-400 bg-[#2d1f1f] p-2 overflow-x-auto border-l-2 border-red-500">
        {cleanTraceback}
      </pre>
    );
  }

  return null;
}

// Single notebook cell component
function NotebookCellComponent({
  cell,
  index,
  isSelected,
  isRunning,
  onSelect,
  onSourceChange,
  onRunCell,
  onRunCellsAbove,
  onRunCellsBelow,
  onDeleteCell,
  onAddCellAbove,
  onClearOutput,
  isEditable,
}: {
  cell: NotebookCell;
  index: number;
  isSelected: boolean;
  isRunning: boolean;
  onSelect: () => void;
  onSourceChange: (source: string) => void;
  onRunCell: () => void;
  onRunCellsAbove: () => void;
  onRunCellsBelow: () => void;
  onDeleteCell: () => void;
  onAddCellAbove: (type: "code" | "markdown") => void;
  onClearOutput: () => void;
  isEditable: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const source = getCellSource(cell.source);
  const executionCount = cell.execution_count;

  const handleDoubleClick = () => {
    if (isEditable && cell.cell_type === "markdown") {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  // Handle Shift+Enter or Ctrl+Enter to run cell
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.shiftKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRunCell();
    }
  };

  return (
    <div
      className={`group relative border-l-2 ${
        isSelected ? "border-blue-500" : "border-transparent hover:border-gray-600"
      }`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      {/* Add cell buttons - visible on hover above the cell */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-[#252526] rounded px-1 py-0.5 z-10">
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white text-xs"
          onClick={(e) => { e.stopPropagation(); onAddCellAbove("code"); }}
          title="Add Code Cell Above"
        >
          <PlusIcon size={12} />
          <span>Code</span>
        </button>
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white text-xs"
          onClick={(e) => { e.stopPropagation(); onAddCellAbove("markdown"); }}
          title="Add Markdown Cell Above"
        >
          <PlusIcon size={12} />
          <span>Markdown</span>
        </button>
      </div>

      {/* Cell actions toolbar - visible when cell is selected */}
      {isSelected && (
        <div className="absolute top-1 right-2 flex items-center gap-1 bg-[#252526] rounded px-1 py-0.5 z-10">
          {cell.cell_type === "code" && (
            <>
              <button
                className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-blue-400 disabled:opacity-50"
                onClick={(e) => { e.stopPropagation(); onRunCellsAbove(); }}
                title="Run Cell and Above"
                disabled={isRunning}
              >
                <ChevronUpIcon size={14} />
              </button>
              <button
                className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-blue-400 disabled:opacity-50"
                onClick={(e) => { e.stopPropagation(); onRunCellsBelow(); }}
                title="Run Cell and Below"
                disabled={isRunning}
              >
                <ChevronDownIcon size={14} />
              </button>
            </>
          )}
          <button
            className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); onDeleteCell(); }}
            title="Delete Cell"
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      )}

      <div className="flex">
        {/* Execution count / cell type indicator + Run button */}
        <div className="w-16 flex-shrink-0 flex flex-col items-end pr-2 pt-2 text-xs text-gray-500">
          {cell.cell_type === "code" ? (
            <>
              <span className="font-mono">
                {isRunning ? (
                  <Loader2Icon size={14} className="animate-spin text-blue-400" />
                ) : (
                  `[${executionCount !== null && executionCount !== undefined ? executionCount : " "}]`
                )}
              </span>
              {/* Run button below cell number - visible on hover */}
              <button
                className="mt-1 p-1 hover:bg-[#3c3c3c] rounded text-gray-500 hover:text-green-400 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onRunCell(); }}
                title="Run Cell (Ctrl+Enter / Shift+Enter)"
                disabled={isRunning}
              >
                <PlayIcon size={14} />
              </button>
            </>
          ) : (
            <FileTextIcon size={14} className="text-gray-600" />
          )}
        </div>

        {/* Cell content */}
        <div className="flex-1 min-w-0">
          {cell.cell_type === "code" ? (
            // Code cell
            <div className="bg-[#1e1e1e] rounded overflow-hidden">
              {/* <div className="flex items-center justify-between px-2 py-1 bg-[#252526] text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <CodeIcon size={12} />
                  <span>Python</span>
                </div>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="hover:text-white"
                >
                  {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDownIcon size={14} />}
                </button>
              </div> */}

              {!isCollapsed && (
                <>
                  <div className={`border p-5 border-[#4a4848] ${isSelected ? "ring-1 ring-blue-500 rounded" : ""}`}>
                    {isEditable ? (
                      <Editor
                        height={`${Math.max(60, source.split("\n").length * 20 + 16)}px`}
                        defaultLanguage="python"
                        value={source}
                        onChange={(val) => val !== undefined && onSourceChange(val)}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          lineNumbers: "off",
                          glyphMargin: false,
                          folding: false,
                          lineDecorationsWidth: 0,
                          lineNumbersMinChars: 0,
                          scrollBeyondLastLine: false,
                          renderLineHighlight: "none",
                          overviewRulerBorder: false,
                          hideCursorInOverviewRuler: true,
                          scrollbar: {
                            vertical: "hidden",
                            horizontal: "auto",
                          },
                          padding: { top: 8, bottom: 8 },
                        }}
                      />
                    ) : (
                      <pre className="p-2 text-sm font-mono text-gray-300 overflow-x-auto">
                        {source}
                      </pre>
                    )}
                  </div>

                  {/* Outputs */}
                  {cell.outputs && cell.outputs.length > 0 && (
                    <div className="border-t border-[#3c3c3c] relative">
                      {/* Output menu - always visible */}
                      <div className="absolute top-1 right-1 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 hover:bg-[#3c3c3c] rounded text-gray-400 hover:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontalIcon size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#252526] border-[#3c3c3c]">
                            <DropdownMenuItem
                              className="text-gray-300 hover:bg-[#3c3c3c] cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Copy all outputs as text
                                const outputText = cell.outputs?.map(output => {
                                  if (output.output_type === "stream") {
                                    return output.text?.join("") || "";
                                  }
                                  if (output.output_type === "execute_result" || output.output_type === "display_data") {
                                    const data = output.data || {};
                                    if (data["text/plain"]) {
                                      return Array.isArray(data["text/plain"]) ? data["text/plain"].join("") : String(data["text/plain"]);
                                    }
                                  }
                                  if (output.output_type === "error") {
                                    return output.traceback?.join("\n") || `${output.ename}: ${output.evalue}`;
                                  }
                                  return "";
                                }).join("\n") || "";
                                navigator.clipboard.writeText(outputText);
                              }}
                            >
                              <CopyIcon size={14} />
                              <span>Copy Output</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-gray-300 hover:bg-[#3c3c3c] cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClearOutput();
                              }}
                            >
                              <EraserIcon size={14} />
                              <span>Clear Output</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {cell.outputs.map((output, i) => (
                        <CellOutput key={i} output={output} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : cell.cell_type === "markdown" ? (
            // Markdown cell
            <div
              className={`rounded overflow-hidden ${
                isEditing ? "bg-[#1e1e1e]" : "bg-transparent"
              } ${isSelected ? "ring-1 ring-blue-500" : ""}`}
              onDoubleClick={handleDoubleClick}
            >
              {isEditing ? (
                <Editor
                  height={`${Math.max(80, source.split("\n").length * 20 + 16)}px`}
                  defaultLanguage="markdown"
                  value={source}
                  onChange={(val) => val !== undefined && onSourceChange(val)}
                  onBlur={handleBlur}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: "off",
                    glyphMargin: false,
                    folding: false,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 0,
                    scrollBeyondLastLine: false,
                    renderLineHighlight: "none",
                    wordWrap: "on",
                    scrollbar: {
                      vertical: "hidden",
                      horizontal: "hidden",
                    },
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none p-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            // Raw cell
            <pre className={`p-2 text-sm font-mono text-gray-400 bg-[#1e1e1e] rounded overflow-x-auto ${isSelected ? "ring-1 ring-blue-500" : ""}`}>
              {source}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// Kernel status indicator component
function KernelStatusIndicator({ status }: { status: KernelStatus }) {
  const statusConfig = {
    disconnected: { icon: CircleIcon, color: "text-gray-500", label: "Disconnected" },
    connecting: { icon: Loader2Icon, color: "text-yellow-500", label: "Connecting...", animate: true },
    idle: { icon: CheckCircleIcon, color: "text-green-500", label: "Idle" },
    busy: { icon: Loader2Icon, color: "text-blue-500", label: "Busy", animate: true },
    error: { icon: AlertCircleIcon, color: "text-red-500", label: "Error" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${config.color}`}>
      <Icon size={14} className={config.animate ? "animate-spin" : ""} />
      <span>{config.label}</span>
    </div>
  );
}

// Package install dialog component
function PackageInstallDialog({
  isOpen,
  onClose,
  onInstall,
  isInstalling,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (packages: string[]) => Promise<void>;
  isInstalling: boolean;
}) {
  const [input, setInput] = useState("");
  const [installLog, setInstallLog] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<{
    success: boolean;
    installed: string[];
    failed: string[];
  } | null>(null);

  const handleInstall = async () => {
    const packages = input
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (packages.length === 0) return;

    setInstallLog(null);
    setInstallResult(null);

    try {
      await onInstall(packages);
    } catch (error) {
      console.error("Install error:", error);
    }
  };

  const handleClose = () => {
    setInput("");
    setInstallLog(null);
    setInstallResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2 text-gray-200">
            <PackageIcon size={18} />
            <span className="font-medium">Install Packages</span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#3c3c3c]"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Enter package names (one per line or comma-separated):
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="numpy&#10;pandas>=2.0.0&#10;matplotlib"
              className="w-full h-32 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={isInstalling}
            />
          </div>

          <div className="text-xs text-gray-500">
            <p>Examples:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li><code className="bg-[#1e1e1e] px-1 rounded">numpy</code> - latest version</li>
              <li><code className="bg-[#1e1e1e] px-1 rounded">pandas==2.0.0</code> - exact version</li>
              <li><code className="bg-[#1e1e1e] px-1 rounded">requests&gt;=2.28</code> - minimum version</li>
              <li><code className="bg-[#1e1e1e] px-1 rounded">scikit-learn[extra]</code> - with extras</li>
            </ul>
          </div>

          {installResult && (
            <div
              className={`p-3 rounded text-sm ${
                installResult.success
                  ? "bg-green-900/30 border border-green-700"
                  : "bg-red-900/30 border border-red-700"
              }`}
            >
              {installResult.success ? (
                <div className="text-green-400">
                  <CheckCircleIcon size={16} className="inline mr-2" />
                  Successfully installed: {installResult.installed.join(", ")}
                </div>
              ) : (
                <div className="text-red-400">
                  <AlertCircleIcon size={16} className="inline mr-2" />
                  Failed to install: {installResult.failed.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#3c3c3c]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-300 hover:bg-[#3c3c3c] rounded"
            disabled={isInstalling}
          >
            Close
          </button>
          <button
            onClick={handleInstall}
            disabled={isInstalling || !input.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
          >
            {isInstalling ? (
              <>
                <Loader2Icon size={14} className="animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <DownloadIcon size={14} />
                Install
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotebookEditor({
  content,
  isEditable,
  onContentChange,
  requirementsTxt,
}: NotebookEditorProps) {
  const [selectedCell, setSelectedCell] = useState<number>(0);
  const [kernelStatus, setKernelStatus] = useState<KernelStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runningCellIndex, setRunningCellIndex] = useState<number | null>(null);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);

  const notebook = useMemo(() => parseNotebook(content), [content]);
  const notebookRef = useRef(notebook);
  notebookRef.current = notebook;

  // Connect to kernel on mount
  useEffect(() => {
    const connectKernel = async () => {
      setKernelStatus("connecting");
      try {
        // Pass requirements.txt to install packages on kernel start
        const response = await allServices.notebook.createSession(requirementsTxt);
        setSessionId(response.session_id);
        setKernelStatus("idle");
        console.log(`[Notebook] Connected to kernel: ${response.session_id}${requirementsTxt ? ' (with packages)' : ''}`);
      } catch (error) {
        console.error("[Notebook] Failed to connect to kernel:", error);
        setKernelStatus("error");
      }
    };

    connectKernel();

    // Cleanup on unmount
    return () => {
      if (sessionId) {
        allServices.notebook.deleteSession(sessionId).catch(console.error);
      }
    };
  }, [requirementsTxt]);

  const updateNotebook = useCallback(
    (updater: (nb: NotebookContent) => NotebookContent) => {
      if (!notebookRef.current || !onContentChange) return;
      const updated = updater(notebookRef.current);
      onContentChange(JSON.stringify(updated, null, 2));
    },
    [onContentChange]
  );

  const handleSourceChange = useCallback(
    (index: number, source: string) => {
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((cell, i) =>
          i === index ? { ...cell, source: source.split("\n").map((l, j, arr) => (j < arr.length - 1 ? l + "\n" : l)) } : cell
        ),
      }));
    },
    [updateNotebook]
  );

  const handleDeleteCell = useCallback(
    (index: number) => {
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.filter((_, i) => i !== index),
      }));
      if (selectedCell >= index && selectedCell > 0) {
        setSelectedCell(selectedCell - 1);
      }
    },
    [updateNotebook, selectedCell]
  );

  const handleAddCellAbove = useCallback(
    (index: number, type: "code" | "markdown") => {
      const newCell: NotebookCell = {
        cell_type: type,
        source: type === "code" ? [""] : [""],
        metadata: {},
        ...(type === "code" ? { execution_count: null, outputs: [] } : {}),
      };
      updateNotebook((nb) => ({
        ...nb,
        cells: [...nb.cells.slice(0, index), newCell, ...nb.cells.slice(index)],
      }));
      setSelectedCell(index);
    },
    [updateNotebook]
  );

  const handleClearOutput = useCallback(
    (index: number) => {
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((cell, i) =>
          i === index && cell.cell_type === "code"
            ? { ...cell, outputs: [], execution_count: null }
            : cell
        ),
      }));
    },
    [updateNotebook]
  );

  const handleRunCell = useCallback(
    async (index: number) => {
      if (!sessionId || kernelStatus === "busy" || !notebookRef.current) return;

      const cell = notebookRef.current.cells[index];
      if (!cell || cell.cell_type !== "code") {
        // For markdown cells, just move to next
        if (notebookRef.current && index < notebookRef.current.cells.length - 1) {
          setSelectedCell(index + 1);
        }
        return;
      }

      const code = getCellSource(cell.source);
      if (!code.trim()) {
        // Skip empty cells
        if (notebookRef.current && index < notebookRef.current.cells.length - 1) {
          setSelectedCell(index + 1);
        }
        return;
      }

      setKernelStatus("busy");
      setRunningCellIndex(index);

      // Clear previous outputs
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((c, i) =>
          i === index ? { ...c, outputs: [], execution_count: null } : c
        ),
      }));

      try {
        const result = await allServices.notebook.executeCell(sessionId, code);

        // Update cell with results
        updateNotebook((nb) => ({
          ...nb,
          cells: nb.cells.map((c, i) =>
            i === index
              ? {
                  ...c,
                  execution_count: result.execution_count,
                  outputs: result.outputs as NotebookOutput[],
                }
              : c
          ),
        }));

        setKernelStatus("idle");

        // Move to next cell
        if (notebookRef.current && index < notebookRef.current.cells.length - 1) {
          setSelectedCell(index + 1);
        }
      } catch (error) {
        console.error("[Notebook] Execution error:", error);

        // Add error output
        updateNotebook((nb) => ({
          ...nb,
          cells: nb.cells.map((c, i) =>
            i === index
              ? {
                  ...c,
                  outputs: [
                    {
                      output_type: "error" as const,
                      ename: "ExecutionError",
                      evalue: error instanceof Error ? error.message : "Unknown error",
                      traceback: [error instanceof Error ? error.message : "Unknown error"],
                    },
                  ],
                }
              : c
          ),
        }));

        setKernelStatus("error");
      } finally {
        setRunningCellIndex(null);
      }
    },
    [sessionId, kernelStatus, updateNotebook]
  );

  const handleRunAllCells = useCallback(async () => {
    if (!notebookRef.current) return;

    for (let i = 0; i < notebookRef.current.cells.length; i++) {
      const cell = notebookRef.current.cells[i];
      if (cell.cell_type === "code") {
        setSelectedCell(i);
        await handleRunCell(i);
        // Small delay between cells
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }, [handleRunCell]);

  const handleRunCellsAbove = useCallback(async (upToIndex: number) => {
    if (!notebookRef.current) return;

    for (let i = 0; i <= upToIndex; i++) {
      const cell = notebookRef.current.cells[i];
      if (cell.cell_type === "code") {
        setSelectedCell(i);
        await handleRunCell(i);
        // Small delay between cells
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }, [handleRunCell]);

  const handleRunCellsBelow = useCallback(async (fromIndex: number) => {
    if (!notebookRef.current) return;

    for (let i = fromIndex; i < notebookRef.current.cells.length; i++) {
      const cell = notebookRef.current.cells[i];
      if (cell.cell_type === "code") {
        setSelectedCell(i);
        await handleRunCell(i);
        // Small delay between cells
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }, [handleRunCell]);

  const handleInterruptKernel = useCallback(async () => {
    if (!sessionId) return;
    try {
      await allServices.notebook.interruptKernel(sessionId);
      setKernelStatus("idle");
      setRunningCellIndex(null);
    } catch (error) {
      console.error("[Notebook] Failed to interrupt kernel:", error);
    }
  }, [sessionId]);

  const handleRestartKernel = useCallback(async () => {
    if (!sessionId) return;
    setKernelStatus("connecting");
    try {
      await allServices.notebook.restartKernel(sessionId);
      setKernelStatus("idle");

      // Clear all execution counts and outputs
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((cell) =>
          cell.cell_type === "code"
            ? { ...cell, execution_count: null, outputs: [] }
            : cell
        ),
      }));
    } catch (error) {
      console.error("[Notebook] Failed to restart kernel:", error);
      setKernelStatus("error");
    }
  }, [sessionId, updateNotebook]);

  const handleInstallPackages = useCallback(
    async (packages: string[]) => {
      if (!sessionId) return;

      setIsInstallingPackages(true);
      setKernelStatus("busy");

      try {
        const result = await allServices.notebook.installPackages(sessionId, packages);
        console.log("[Notebook] Install result:", result);

        // Show result as a cell output or alert
        if (result.success) {
          alert(`Successfully installed: ${result.installed.join(", ")}`);
        } else {
          alert(`Failed to install: ${result.failed.join(", ")}\n\nOutput:\n${result.output}`);
        }

        setKernelStatus("idle");
      } catch (error) {
        console.error("[Notebook] Install error:", error);
        alert(`Installation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        setKernelStatus("error");
      } finally {
        setIsInstallingPackages(false);
      }
    },
    [sessionId]
  );

  if (!notebook) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <XIcon size={48} className="mx-auto mb-2 opacity-50" />
          <p>Invalid notebook format</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Notebook toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {notebook.metadata.kernelspec?.display_name || "Python 3"}
          </span>
          <KernelStatusIndicator status={kernelStatus} />
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">
            {notebook.cells.length} cells
          </span>
        </div>
        <div className="flex items-center gap-2">
          {kernelStatus === "busy" ? (
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
              onClick={handleInterruptKernel}
              title="Interrupt Kernel"
            >
              <StopCircleIcon size={12} />
              Stop
            </button>
          ) : (
            <button
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
              onClick={() => handleRunCell(selectedCell)}
              disabled={kernelStatus !== "idle"}
              title="Run Selected Cell (Shift+Enter)"
            >
              <PlayIcon size={12} />
              Run
            </button>
          )}
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            onClick={handleRunAllCells}
            disabled={kernelStatus !== "idle"}
            title="Run All Cells"
          >
            <PlayIcon size={12} />
            Run All
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] text-gray-300 rounded"
            onClick={handleRestartKernel}
            title="Restart Kernel"
          >
            <RotateCcwIcon size={12} />
            Restart
          </button>
{/* TODO: Enable when backend package installation is ready
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] text-gray-300 rounded disabled:opacity-50"
            onClick={() => setShowPackageDialog(true)}
            disabled={kernelStatus !== "idle"}
            title="Install Packages (pip)"
          >
            <PackageIcon size={12} />
            Packages
          </button>
*/}
          <div className="w-px h-4 bg-[#3c3c3c]" />
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] text-gray-300 rounded"
            onClick={() => handleAddCellAbove(notebook.cells.length - 1, "code")}
            title="Add Code Cell"
          >
            <PlusIcon size={12} />
            Code
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] text-gray-300 rounded"
            onClick={() => handleAddCellAbove(notebook.cells.length - 1, "markdown")}
            title="Add Markdown Cell"
          >
            <PlusIcon size={12} />
            Markdown
          </button>
        </div>
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {notebook.cells.map((cell, index) => (
          <NotebookCellComponent
            key={index}
            cell={cell}
            index={index}
            isSelected={selectedCell === index}
            isRunning={runningCellIndex === index}
            onSelect={() => setSelectedCell(index)}
            onSourceChange={(source) => handleSourceChange(index, source)}
            onRunCell={() => handleRunCell(index)}
            onRunCellsAbove={() => handleRunCellsAbove(index)}
            onRunCellsBelow={() => handleRunCellsBelow(index)}
            onDeleteCell={() => handleDeleteCell(index)}
            onAddCellAbove={(type) => handleAddCellAbove(index, type)}
            onClearOutput={() => handleClearOutput(index)}
            isEditable={isEditable}
          />
        ))}

        {/* Add cell button at the end */}
        {notebook.cells.length === 0 && (
          <div className="flex justify-center gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#3c3c3c] hover:bg-[#4c4c4c] text-gray-300 rounded"
              onClick={() => handleAddCellAbove(-1, "code")}
            >
              <PlusIcon size={16} />
              Add Code Cell
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#3c3c3c] hover:bg-[#4c4c4c] text-gray-300 rounded"
              onClick={() => handleAddCellAbove(-1, "markdown")}
            >
              <PlusIcon size={16} />
              Add Markdown Cell
            </button>
          </div>
        )}
      </div>

      {/* Package Install Dialog */}
      <PackageInstallDialog
        isOpen={showPackageDialog}
        onClose={() => setShowPackageDialog(false)}
        onInstall={handleInstallPackages}
        isInstalling={isInstallingPackages}
      />

      {/* Notebook HTML output styles */}
      <style jsx global>{`
        .notebook-output-html table {
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 13px;
        }
        .notebook-output-html th,
        .notebook-output-html td {
          border: 1px solid #3c3c3c;
          padding: 6px 12px;
          text-align: left;
        }
        .notebook-output-html th {
          background: #2d2d2d;
          color: #d4d4d4;
        }
        .notebook-output-html td {
          color: #cccccc;
        }
        .notebook-output-html tr:nth-child(even) td {
          background: #252526;
        }
        .notebook-output-html tr:hover td {
          background: #2a2d2e;
        }
      `}</style>
    </div>
  );
}
