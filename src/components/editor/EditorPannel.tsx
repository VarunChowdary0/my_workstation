"use client";
import { Editor } from "@monaco-editor/react";
import TabsBar from "./TabsBar";
import { FileNode } from "@/types/types";
import { BugIcon } from "lucide-react";

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
  onContentChange, // Destructure the new prop
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
      <div className="flex-1 bg-[#1e1e1e]">
        {activeFile ? (
          <Editor
            height="100%"
            // Use path as key to force re-render when file changes
            key={activeFile.path} 
            defaultLanguage={getFileLanguage(activeFile.node.name)}
            // The value is now directly from the file node content
            value={activeFile.node.content} 
            onChange={(val) => {
              // *** CHANGED: Call the onContentChange prop ***
              // This sends the change to the Zustand store
              if (val !== undefined && activeFile.node.isEditable) {
                onContentChange(activeFile.path, val);
              }
            }}
            options={{ readOnly: !activeFile.node.isEditable }}
            theme="vs-dark"
          />
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