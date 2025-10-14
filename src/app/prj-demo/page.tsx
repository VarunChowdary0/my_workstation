"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useState, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { FileNode, MOCK_PROJECT_REACT } from "@/mock-data/projectFiles";
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

type EditorFile = { path: string; node: FileNode };

export default function ProjectDemo() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  const {
    files: projectFiles,
    setFiles,
    updateFileContent,
    appendToTerminal,
  } = useProjectStore();

  // UI Visibility State
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
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

  useEffect(() => {
    if (projectFiles.length === 0) {
      setFiles(MOCK_PROJECT_REACT);
    }
  }, [projectFiles, setFiles]);
  
  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new Terminal({ theme: { background: "#1e1e1e" } });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      term.writeln("✓ Compiled successfully");
      appendToTerminal("✓ Compiled successfully");
      xtermRef.current = term;
      const onResize = () => fitAddon.fit();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, [appendToTerminal]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "b") { e.preventDefault(); setShowRight((p) => !p); } 
      else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); setShowLeft((p) => !p); } 
      else if (e.ctrlKey && e.key === "`") { e.preventDefault(); setShowTerminal((p) => !p); } 
      else if (e.ctrlKey && e.key === "\\") { e.preventDefault(); setIsSplitView((p) => !p); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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
  };

  const openFileInPanel = (panel: "left" | "right", file: EditorFile) => {
    if (panel === "left") {
      if (!leftOpenFiles.some((f) => f.path === file.path)) setLeftOpenFiles((prev) => [...prev, file]);
      setLeftActive(file);
    } else {
      if (!rightOpenFiles.some((f) => f.path === file.path)) setRightOpenFiles((prev) => [...prev, file]);
      setRightActive(file);
    }
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
  
  const runCode = () => { if (xtermRef.current) xtermRef.current.writeln(`$ Running active file...`); };

  const dragSourcePanel =
    draggingTabPath &&
    (leftOpenFiles.some((f) => f.path === draggingTabPath)
      ? "left"
      : "right");

  return (
    <div className="h-screen w-screen dark:bg-[#181818]">
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

        <ResizablePanel defaultSize={showLeft && showRight ? 60 : 80}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={showRight ? 70 : 100} minSize={50}>
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
                  </ResizablePanelGroup>
                </ResizablePanel>

                {showTerminal && (
                  <>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={25} minSize={10} maxSize={100}>
                      {/* ... Terminal JSX ... */}
                      <div className="h-full flex flex-col bg-[#1e1e1e] border-t">
                        <div className="flex items-center justify-between px-2 py-1 border-b text-sm">
                          <div className="flex items-center gap-2"><TerminalSquareIcon size={16} /><span>Terminal</span></div>
                          <div className="flex items-center gap-2">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={runCode}><PlayIcon size={14} /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><PlusIcon size={14} /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2Icon size={14} /></Button>
                          </div>
                        </div>
                        <div ref={terminalRef} className="flex-1 w-full overflow-auto p-1"/>
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>

            {showRight && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20}>
                  <SideChat onClose={()=>setShowRight(false)}/>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}