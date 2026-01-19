"use client";
import { Editor } from "@monaco-editor/react";
import TabsBar from "./TabsBar";
import { FileNode } from "@/types/types";
import { BugIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NotebookEditor from "./NotebookEditor";

interface EditorPanelProps {
  panelId: "left" | "right";
  openFiles: { path: string; node: FileNode }[];
  activeFile: { path: string; node: FileNode } | null;
  onSelect: (file: { path: string; node: FileNode }) => void;
  onClose: (path: string) => void;
  onDragDrop: (from: string, toPanel: "left" | "right") => void;
  onReorder: (draggedPath: string, targetPath: string) => void;
  draggingPath: string | null;
  onDragStart: (path: string) => void;
  onDragEnd: () => void;
  // *** NEW: Add prop to notify parent of content changes ***
  onContentChange: (path: string, content: string) => void;
  // Project files for notebook imports and datasets
  projectFiles?: FileNode[];
  // requirements.txt content for notebook package installation
  requirementsTxt?: string;
  // Callback when notebook kernel session is ready
  onNotebookSessionReady?: (sessionId: string) => void;
}

const getFileLanguage = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "m": return 'matlab'; 
    case "f90": return "fortran"; 
    case "css": return "css"; 
    case "html": return "html"; 
    case "d": return "dlang"; 
    case "lua": return "lua"; 
    case "elixir": return "elixir"; 
    case "hs": return "haskell"; 
    case "perl": return 'perl'; 
    case "php": return "php"; 
    case "scala": return 'scala'; 
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
    case "tsx": return "typescript"
    case "jsx": return "javascript"; 
    case "txt": return "text"; 
    default : return ext;
  }
};
export default function EditorPanel({
  panelId,
  openFiles,
  activeFile,
  onSelect,
  onClose,
  onDragDrop,
  onReorder,
  draggingPath,
  onDragStart,
  onDragEnd,
  onContentChange,
  projectFiles,
  requirementsTxt,
  onNotebookSessionReady,
}: EditorPanelProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <TabsBar
        openFiles={openFiles}
        activePath={activeFile?.path ?? null}
        onSelect={onSelect}
        onClose={onClose}
        onDragDrop={onDragDrop}
        onReorder={onReorder}
        panel={panelId}
        draggingPath={draggingPath}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
      <div className="flex-1 bg-[#1e1e1e] overflow-hidden">
        {activeFile ? (
          activeFile.node.name.endsWith(".ipynb") ? (
            // Jupyter Notebook
            <NotebookEditor
              content={activeFile.node.content || "{}"}
              isEditable={activeFile.node.isEditable ?? false}
              onContentChange={(content) => onContentChange(activeFile.path, content)}
              projectFiles={projectFiles}
              requirementsTxt={requirementsTxt}
              onSessionReady={onNotebookSessionReady}
            />
          ) : activeFile.node.name.endsWith(".md") ? (
            // Markdown
            <div className="h-full overflow-auto p-6 prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeFile.node.content || ""}
              </ReactMarkdown>
            </div>
          ) : (
            // Other files - Monaco editor
            <Editor
              height="100%"
              key={activeFile.path}
              defaultLanguage={getFileLanguage(activeFile.node.name)}
              value={activeFile.node.content}
              onChange={(val) => {
                if (val !== undefined && activeFile.node.isEditable) {
                  onContentChange(activeFile.path, val);
                }
              }}
              options={{ readOnly: !activeFile.node.isEditable }}
              theme="vs-dark"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <BugIcon size={96} className="opacity-30" />
            <div className="mt-2">No file open</div>
          </div>
        )}
      </div>
    </div>
  );
}