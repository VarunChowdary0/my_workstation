"use client";

import { useState } from "react";
import { FileNode } from "@/types/types";
import {
  Folder,
  FolderOpen,
  TextIcon,
  Lock,
} from "lucide-react";
import clsx from "clsx";
import OpenIcon from "../icons/OpenIcon";
import TechStackIcon from "tech-stack-icons";
import JavascriptIcon from "../icons/JavascriptIcon";
import ScalaIcon from "../icons/ScalaIcon";
import PerlIcon from "../icons/PerlIcon";
import FortranIcon from "../icons/FortranIcon";
import MatLabIcon from "../icons/MatLabIcon";

interface FileTreeProps {
  nodes: FileNode[];
  onSelect: (node: FileNode, path: string) => void;
  // *** NEW: Callbacks for dragging files from the explorer ***
  onFileDragStart: (node: FileNode, path:string) => void;
  onFileDragEnd: () => void;
  currentPath?: string;
  depth?: number;
}

export default function FileTree({
  nodes,
  onSelect,
  onFileDragStart,
  onFileDragEnd,
  currentPath = "",
  depth = 0,
}: FileTreeProps) {
  // Track folder index at current level
  let folderIndex = 0;

  return (
    <ul className="ml-2">
      {nodes.map((node, idx) => {
        const isFolder = Array.isArray(node.children);
        const currentFolderIndex = isFolder ? folderIndex++ : -1;

        return (
          <FileNodeItem
            key={node.name + `-${idx}`}
            node={node}
            onSelect={onSelect}
            onFileDragStart={onFileDragStart}
            onFileDragEnd={onFileDragEnd}
            path={currentPath ? `${currentPath}/${node.name}` : node.name}
            depth={depth}
            folderIndex={currentFolderIndex}
          />
        );
      })}
    </ul>
  );
}

function FileNodeItem({
  node,
  onSelect,
  path,
  onFileDragStart,
  onFileDragEnd,
  depth,
  folderIndex,
}: {
  node: FileNode;
  onSelect: (node: FileNode, path: string) => void;
  onFileDragStart: (node: FileNode, path:string) => void;
  onFileDragEnd: () => void;
  path: string;
  depth: number;
  folderIndex: number;
}) {
  // Auto-expand first 2 folders at root level (depth 0)
  const shouldAutoExpand = depth === 0 && folderIndex >= 0 && folderIndex < 2;
  const [isOpen, setIsOpen] = useState(shouldAutoExpand);
  // Treat as folder only when children is an array (null means file)
  const isFolder = Array.isArray(node.children);

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


  return (
    <li className="my-1">
      <div
        // *** NEW: Make non-folder items draggable ***
        draggable={!isFolder}
        onDragStart={(e) => {
          if (!isFolder) {
            e.dataTransfer.effectAllowed = "move";
            onFileDragStart(node, path);
          }
        }}
        onDragEnd={() => {
          if(!isFolder) onFileDragEnd();
        }}
        className={clsx(
          "cursor-pointer flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-800",
          !isFolder && "ml-4 text-sm hover:text-blue-400"
        )}
        onClick={() => {
          if (isFolder) setIsOpen(!isOpen);
          else onSelect(node, path);
        }}
      >
        {isFolder ? (
          <>
            <div
              className={`${
                isOpen && "rotate-90"
              } transition-all duration-75 text-gray-300`}
            >
              <OpenIcon />
            </div>
            {isOpen ? (
              <FolderOpen size={16} className="text-yellow-400" />
            ) : (
              <Folder size={16} className="text-yellow-500" />
            )}
          </>
        ) : (
          <span className=" w-4">
            {getFileIcon(node.name)}
          </span>
        )}
        <span className="select-none flex-1">{node.name}</span>
        {!isFolder && node.isEditable === false && (
          <Lock size={12} className="text-gray-500 ml-auto" />
        )}
      </div>
      {isFolder && isOpen && Array.isArray(node.children) && node.children.length > 0 && (
        <FileTree
          nodes={node.children}
          onSelect={onSelect}
          currentPath={path}
          onFileDragStart={onFileDragStart}
          onFileDragEnd={onFileDragEnd}
          depth={depth + 1}
        />
      )}
    </li>
  );
}