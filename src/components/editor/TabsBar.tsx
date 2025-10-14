"use client";
import { TextIcon, XIcon } from "lucide-react";
import clsx from "clsx";
// *** REMOVED: No longer needs its own state ***
// import { useState } from "react"; 
import type { FileNode } from "@/mock-data/projectFiles";
import TechStackIcon from "tech-stack-icons";
import JavascriptIcon from "../icons/JavascriptIcon";
import ScalaIcon from "../icons/ScalaIcon";
import PerlIcon from "../icons/PerlIcon";
import FortranIcon from "../icons/FortranIcon";
import MatLabIcon from "../icons/MatLabIcon";

interface TabsBarProps {
  openFiles: { path: string; node: FileNode }[];
  activePath: string | null;
  onSelect: (f: { path: string; node: FileNode }) => void;
  onClose: (path: string) => void;
  onDragDrop?: (from: string, toPanel: "left" | "right") => void;
  onReorder?: (draggedPath: string, targetPath: string) => void;
  panel: "left" | "right";
  // *** NEW: Props for shared drag state ***
  draggingPath: string | null;
  onDragStart: (path: string) => void;
  onDragEnd: () => void;
}
  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    switch (ext) {
      case "json": return <div className=" text-xs text-center font-semibold text-yellow-400 select-none">{"{ }"}</div>; 
      case "m": return <MatLabIcon/>; 
      case "f90": return <FortranIcon/>; 
      case "css": return <TechStackIcon name="css3"/>; 
      case "html": return <TechStackIcon name="html5"/>; 
      case "d": return <TechStackIcon name="dlang"/>; 
      case "lua": return <TechStackIcon name="lua"/>; 
      case "elixir": return <TechStackIcon name="elixir"/>; 
      case "hs": return <TechStackIcon name="haskell"/>; 
      case "perl": return <PerlIcon/>; 
      case "php": return <TechStackIcon name="php"/>; 
      case "scala": return <ScalaIcon/>; 
      case "kt": return <TechStackIcon name="kotlin"/>; 
      case "swift": return <TechStackIcon name="swift"/>; 
      case "rs": return <TechStackIcon name="rust"/>; 
      case "go": return <TechStackIcon name="go"/>; 
      case "rb": return <TechStackIcon name="ruby"/>; 
      case "cpp": return <TechStackIcon name="c++"/>; 
      case "c": return <div className=" text-center text-xs font-bold bg-blue-400 rounded-xs select-none h-4">C</div>; 
      case "cs": return <TechStackIcon name="c#"/>; 
      case "java": return <TechStackIcon name="java"/>; 
      case "py": return <TechStackIcon name="python"/>; 
      case "js": return <JavascriptIcon/>; 
      case "ts": return <TechStackIcon name="typescript"/>; 
      case "tsx": case "jsx": return <TechStackIcon name="react"/>; 
      case "txt": return <TextIcon size={12}/>; 
      default : return <TextIcon size={12}/>;
    }
  };

export default function TabsBar({
  openFiles,
  activePath,
  onSelect,
  onClose,
  onDragDrop,
  onReorder,
  panel,
  // *** NEW: Destructure shared state props ***
  draggingPath,
  onDragStart,
  onDragEnd,
}: TabsBarProps) {

  return (
    <div
      style={{
        zIndex: 5000
      }}
      className="flex min-h-[37px] border-b overflow-x-auto bg-[#1e1e1e] text-sm select-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        // *** CHANGED: onDragEnd now clears the shared state ***
        if (draggingPath && onDragDrop) onDragDrop(draggingPath, panel);
        onDragEnd();
      }}
    >
      {openFiles.map((f) => (
        <div
          key={f.path}
          draggable
          // *** CHANGED: Use props to manage shared state ***
          onDragStart={() => onDragStart(f.path)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.stopPropagation(); 
            if (draggingPath && onReorder) {
              onReorder(draggingPath, f.path);
            }
            // *** CHANGED: onDragEnd now clears the shared state ***
            onDragEnd();
          }}
          className={clsx(
            "px-4 py-2 cursor-pointer border-r flex items-center gap-1",
            activePath === f.path
              ? "bg-[#252526] font-semibold text-white"
              : "text-gray-400 hover:text-white"
          )}
          onClick={() => onSelect(f)}
        >
          <span className=" w-4">{getFileIcon(f.node.name)}</span>
          {f.node.name}
          <XIcon
            size={16}
            className="ml-1 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation();
              onClose(f.path);
            }}
          />
        </div>
      ))}
    </div>
  );
}