"use client";

import React, { useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  FileCode,
  ClipboardCheck,
  PlusCircle,
  X,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

import FileTree from "@/components/editor/FileTree";
import EditorPanel from "@/components/editor/EditorPannel";

import { useEvaluationStore } from "@/store/evaluationStore";
import { evaluationService } from "@/services/evaluationService";

import { FileNode } from "@/types/types";
import {
  AssessmentCandidate,
  ExistingEvaluation,
  FeedbackCategories,
} from "@/types/assessment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type EditorFile = { path: string; node: FileNode; source: "project" | "submission" };

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
// EvaluationWorkstation — three-panel evaluation interface
// ---------------------------------------------------------------------------
function EvaluationWorkstation() {
  const store = useEvaluationStore();

  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFile, setActiveFile] = useState<EditorFile | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Mark all files as non-editable (read-only)
  const markReadOnly = useCallback((files: FileNode[]): FileNode[] => {
    return files.map((f) => ({
      ...f,
      isEditable: false,
      children: f.children ? markReadOnly(f.children) : f.children,
    }));
  }, []);

  const readOnlyProjectFiles = useMemo(
    () => markReadOnly(store.projectFiles),
    [store.projectFiles, markReadOnly]
  );
  const readOnlySubmissionFiles = useMemo(
    () => markReadOnly(store.submissionFiles),
    [store.submissionFiles, markReadOnly]
  );

  // Handle file selection from either tree
  const handleSelectFile = useCallback(
    (node: FileNode, path: string, source: "project" | "submission") => {
      if (node.children) return; // Ignore folder clicks
      const readOnlyNode = { ...node, isEditable: false };
      const file: EditorFile = { path, node: readOnlyNode, source };
      if (!openFiles.some((f) => f.path === path && f.source === source)) {
        setOpenFiles((prev) => [...prev, file]);
      }
      setActiveFile(file);
      store.openFile(file);
    },
    [openFiles, store]
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      // Close the tab matching the active file's source, or the first match
      const toClose =
        activeFile?.path === path
          ? activeFile
          : openFiles.find((f) => f.path === path);
      if (!toClose) return;

      const newFiles = openFiles.filter(
        (f) => !(f.path === toClose.path && f.source === toClose.source)
      );
      setOpenFiles(newFiles);
      if (activeFile?.path === path && activeFile?.source === toClose.source) {
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
        toast.error("Session expired. Please go back and click Evaluate again.");
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

  // Adapt opened files for the EditorPanel (strip 'source' field, prefix path for display)
  const editorOpenFiles = openFiles.map((f) => ({
    path: f.source === "project" ? `[Template] ${f.path}` : f.path,
    node: f.node,
  }));
  const editorActiveFile = activeFile
    ? {
        path:
          activeFile.source === "project"
            ? `[Template] ${activeFile.path}`
            : activeFile.path,
        node: activeFile.node,
      }
    : null;

  // Adapt close handler to strip prefix
  const handleEditorCloseTab = (displayPath: string) => {
    const prefix = "[Template] ";
    const realPath = displayPath.startsWith(prefix)
      ? displayPath.slice(prefix.length)
      : displayPath;
    handleCloseTab(realPath);
  };

  // Adapt select handler
  const handleEditorSelect = (file: { path: string; node: FileNode }) => {
    const prefix = "[Template] ";
    const isTemplate = file.path.startsWith(prefix);
    const realPath = isTemplate ? file.path.slice(prefix.length) : file.path;
    const full = openFiles.find(
      (f) =>
        f.path === realPath &&
        f.source === (isTemplate ? "project" : "submission")
    );
    if (full) setActiveFile(full);
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
      />

      {/* Main Body: Three-panel layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          {/* Left Panel: Dual File Trees */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
            <div className="h-full border-r dark:bg-[#181818] flex flex-col">
              <Tabs
                defaultValue="submission"
                onValueChange={(v) =>
                  store.setActiveFileSource(v as "project" | "submission")
                }
                className="h-full flex flex-col"
              >
                <TabsList className="w-full rounded-none border-b bg-[#252526]">
                  <TabsTrigger value="submission" className="flex-1 text-xs">
                    <FileCode size={12} className="mr-1" />
                    Submission
                  </TabsTrigger>
                  <TabsTrigger value="project" className="flex-1 text-xs">
                    <ClipboardCheck size={12} className="mr-1" />
                    Template
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="submission"
                  className="flex-1 overflow-auto p-2 mt-0"
                >
                  <FileTree
                    nodes={readOnlySubmissionFiles}
                    onSelect={(node, path) =>
                      handleSelectFile(node, path, "submission")
                    }
                    onFileDragStart={() => {}}
                    onFileDragEnd={() => {}}
                  />
                </TabsContent>
                <TabsContent
                  value="project"
                  className="flex-1 overflow-auto p-2 mt-0"
                >
                  <FileTree
                    nodes={readOnlyProjectFiles}
                    onSelect={(node, path) =>
                      handleSelectFile(node, path, "project")
                    }
                    onFileDragStart={() => {}}
                    onFileDragEnd={() => {}}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Panel: Monaco Editor (Read-Only) */}
          <ResizablePanel defaultSize={52}>
            <EditorPanel
              panelId="left"
              openFiles={editorOpenFiles}
              activeFile={editorActiveFile}
              onSelect={handleEditorSelect}
              onClose={handleEditorCloseTab}
              onDragDrop={() => {}}
              onReorder={() => {}}
              draggingPath={null}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onContentChange={() => {}}
            />
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
}

function EvaluationHeader({
  candidate,
  round,
  submittedAt,
  syncCount,
  isSubmitting,
  existingEvaluation,
  onSubmit,
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

      <div className="flex items-center gap-3">
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

      {/* Submit button (also in header, but convenient here) */}
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
          The project or submission could not be found. It may have been removed.
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
