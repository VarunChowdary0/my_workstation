"use client";

import { useState, useRef, useEffect } from "react";
import { FileNode } from "@/types/types";
import {
  Folder,
  FolderOpen,
  TextIcon,
  Lock,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
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
  // Callbacks for dragging files from the explorer
  onFileDragStart: (node: FileNode, path: string) => void;
  onFileDragEnd: () => void;
  // File operation callbacks
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateFolder?: (parentPath: string, folderName: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
  currentPath?: string;
  depth?: number;
  // Root-level creation state (only used at root level)
  isCreatingRootFile?: boolean;
  isCreatingRootFolder?: boolean;
  onRootFileCreated?: () => void;
  onRootFolderCreated?: () => void;
}

// Context menu state type
interface ContextMenuState {
  x: number;
  y: number;
  isFolder: boolean;
  isEditable: boolean;
  path: string;
}

export default function FileTree({
  nodes,
  onSelect,
  onFileDragStart,
  onFileDragEnd,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  currentPath = "",
  depth = 0,
  isCreatingRootFile,
  isCreatingRootFolder,
  onRootFileCreated,
  onRootFolderCreated,
}: FileTreeProps) {
  // Sort nodes: folders first, then files (alphabetically within each group)
  const sortedNodes = [...nodes].sort((a, b) => {
    const aIsFolder = Array.isArray(a.children);
    const bIsFolder = Array.isArray(b.children);
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  // Track folder index at current level
  let folderIndex = 0;

  const handleRootFileCreate = (fileName: string) => {
    if (onCreateFile) {
      onCreateFile("", fileName);
    }
    onRootFileCreated?.();
  };

  const handleRootFolderCreate = (folderName: string) => {
    if (onCreateFolder) {
      onCreateFolder("", folderName);
    }
    onRootFolderCreated?.();
  };

  return (
    <ul className="ml-2">
      {/* Root-level file creation input */}
      {depth === 0 && isCreatingRootFile && (
        <li className="my-0.5 flex items-center gap-2 px-1 py-0.5 ml-4">
          <TextIcon size={14} className="text-gray-400" />
          <InlineInput
            initialValue=""
            onSubmit={handleRootFileCreate}
            onCancel={() => onRootFileCreated?.()}
            placeholder="filename.ext"
          />
        </li>
      )}
      {/* Root-level folder creation input */}
      {depth === 0 && isCreatingRootFolder && (
        <li className="my-0.5 flex items-center gap-2 px-1 py-0.5">
          <Folder size={16} className="text-yellow-500" />
          <InlineInput
            initialValue=""
            onSubmit={handleRootFolderCreate}
            onCancel={() => onRootFolderCreated?.()}
            placeholder="folder name"
          />
        </li>
      )}
      {sortedNodes.map((node, idx) => {
        const isFolder = Array.isArray(node.children);
        const currentFolderIndex = isFolder ? folderIndex++ : -1;

        return (
          <FileNodeItem
            key={node.name + `-${idx}`}
            node={node}
            onSelect={onSelect}
            onFileDragStart={onFileDragStart}
            onFileDragEnd={onFileDragEnd}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onRename={onRename}
            onDelete={onDelete}
            path={currentPath ? `${currentPath}/${node.name}` : node.name}
            depth={depth}
            folderIndex={currentFolderIndex}
          />
        );
      })}
    </ul>
  );
}

// VS Code style context menu component
function ContextMenu({
  x,
  y,
  isFolder,
  isEditable,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  x: number;
  y: number;
  isFolder: boolean;
  isEditable: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  if (!isEditable) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-[#252526] border border-[#454545] rounded shadow-lg py-1 text-sm"
      style={{ left: x, top: y }}
    >
      {isFolder && (
        <>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-[#094771] flex items-center gap-2 text-gray-200"
            onClick={() => {
              onNewFile();
              onClose();
            }}
          >
            <FilePlus size={14} />
            New File
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-[#094771] flex items-center gap-2 text-gray-200"
            onClick={() => {
              onNewFolder();
              onClose();
            }}
          >
            <FolderPlus size={14} />
            New Folder
          </button>
          <div className="border-t border-[#454545] my-1" />
        </>
      )}
      <button
        className="w-full px-3 py-1.5 text-left hover:bg-[#094771] flex items-center gap-2 text-gray-200"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <Pencil size={14} />
        Rename
      </button>
      <button
        className="w-full px-3 py-1.5 text-left hover:bg-[#094771] flex items-center gap-2 text-red-400"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
}

// Inline rename input component
function InlineInput({
  initialValue,
  onSubmit,
  onCancel,
  placeholder,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && (initialValue === "" || trimmed !== initialValue)) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      placeholder={placeholder}
      className="bg-[#3c3c3c] text-white text-sm px-1 py-0.5 rounded border border-[#007acc] outline-none w-full"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function FileNodeItem({
  node,
  onSelect,
  path,
  onFileDragStart,
  onFileDragEnd,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  depth,
  folderIndex,
}: {
  node: FileNode;
  onSelect: (node: FileNode, path: string) => void;
  onFileDragStart: (node: FileNode, path: string) => void;
  onFileDragEnd: () => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateFolder?: (parentPath: string, folderName: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
  path: string;
  depth: number;
  folderIndex: number;
}) {
  // Auto-expand first 2 folders at root level (depth 0)
  const shouldAutoExpand = depth === 0 && folderIndex >= 0 && folderIndex < 2;
  const [isOpen, setIsOpen] = useState(shouldAutoExpand);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Treat as folder only when children is an array (null means file)
  const isFolder = Array.isArray(node.children);
  const isEditable = node.isEditable !== false;

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    switch (ext) {
      case "ipynb": return <div className="text-xs text-center font-bold text-orange-400 select-none">Jy</div>;
      case "csv": return <div className="text-xs text-center font-semibold text-green-400 select-none">csv</div>;
      case "md": return <div className="text-xs text-center font-bold text-blue-300 select-none">M↓</div>;
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

  const handleRename = (newName: string) => {
    if (onRename && newName !== node.name) {
      onRename(path, newName);
    }
    setIsRenaming(false);
  };

  const handleCreateFile = (fileName: string) => {
    if (onCreateFile) {
      onCreateFile(path, fileName);
    }
    setIsCreatingFile(false);
  };

  const handleCreateFolder = (folderName: string) => {
    if (onCreateFolder) {
      onCreateFolder(path, folderName);
    }
    setIsCreatingFolder(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditable) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <li className="my-0.5">
      <div
        draggable={!isFolder && !isRenaming}
        onDragStart={(e) => {
          if (!isFolder) {
            e.dataTransfer.effectAllowed = "move";
            onFileDragStart(node, path);
          }
        }}
        onDragEnd={() => {
          if (!isFolder) onFileDragEnd();
        }}
        onContextMenu={handleContextMenu}
        className={clsx(
          "cursor-pointer flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#2a2d2e]",
          !isFolder && "ml-4 text-sm"
        )}
        onClick={() => {
          if (isRenaming) return;
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

        {isRenaming ? (
          <InlineInput
            initialValue={node.name}
            onSubmit={handleRename}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <span className="select-none flex-1 truncate">{node.name}</span>
        )}

        {!isFolder && !isEditable && (
          <Lock size={12} className="text-gray-500" />
        )}
      </div>

      {/* VS Code style context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isFolder={isFolder}
          isEditable={isEditable}
          onClose={() => setContextMenu(null)}
          onNewFile={() => {
            setIsOpen(true);
            setIsCreatingFile(true);
          }}
          onNewFolder={() => {
            setIsOpen(true);
            setIsCreatingFolder(true);
          }}
          onRename={() => setIsRenaming(true)}
          onDelete={handleDelete}
        />
      )}

      {/* Creating new file input */}
      {isFolder && isOpen && isCreatingFile && (
        <div className="ml-8 my-0.5 flex items-center gap-2">
          <TextIcon size={14} className="text-gray-400" />
          <InlineInput
            initialValue=""
            onSubmit={handleCreateFile}
            onCancel={() => setIsCreatingFile(false)}
            placeholder="filename.ext"
          />
        </div>
      )}

      {/* Creating new folder input */}
      {isFolder && isOpen && isCreatingFolder && (
        <div className="ml-8 my-0.5 flex items-center gap-2">
          <Folder size={14} className="text-yellow-500" />
          <InlineInput
            initialValue=""
            onSubmit={handleCreateFolder}
            onCancel={() => setIsCreatingFolder(false)}
            placeholder="folder name"
          />
        </div>
      )}

      {isFolder && isOpen && Array.isArray(node.children) && node.children.length > 0 && (
        <FileTree
          nodes={node.children}
          onSelect={onSelect}
          currentPath={path}
          onFileDragStart={onFileDragStart}
          onFileDragEnd={onFileDragEnd}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDelete={onDelete}
          depth={depth + 1}
        />
      )}
    </li>
  );
}
