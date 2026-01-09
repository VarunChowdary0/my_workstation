"use client";

import { useState, useEffect, useRef } from "react";
import { XIcon, Maximize2, Minimize2, RefreshCw, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrowserPreviewProps {
  url: string;
  onClose: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export default function BrowserPreview({
  url,
  onClose,
  onToggleFullscreen,
  isFullscreen = false,
}: BrowserPreviewProps) {
  const [key, setKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [path, setPath] = useState("/");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract base URL (protocol + host + port)
  const baseUrl = (() => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  })();

  // Current full URL with path
  const currentUrl = `${baseUrl}${path}`;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRefresh = () => {
    setIsLoading(true);
    setKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(currentUrl, "_blank");
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newPath = e.target.value;
    // Ensure path starts with /
    if (!newPath.startsWith("/")) {
      newPath = "/" + newPath;
    }
    setPath(newPath);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      setIsLoading(true);
      setKey((prev) => prev + 1);
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Browser-like Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-[#252526]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Globe size={14} className="text-blue-400 shrink-0" />
          <div
            className="flex-1 min-w-0 flex items-center bg-[#3c3c3c] rounded text-xs overflow-hidden cursor-text"
            onClick={() => setIsEditing(true)}
          >
            {/* Fixed base URL part */}
            <span className="px-2 py-1 text-gray-500 shrink-0 select-none">
              {baseUrl}
            </span>
            {/* Editable path part */}
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={path}
                onChange={handlePathChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="flex-1 min-w-0 py-1 pr-2 bg-transparent text-gray-200 outline-none"
                spellCheck={false}
              />
            ) : (
              <span className="flex-1 min-w-0 py-1 pr-2 text-gray-300 truncate">
                {path}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenExternal}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </Button>
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFullscreen}
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-[#3e3e42]"
            title="Close"
          >
            <XIcon size={14} />
          </Button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Loading preview...</span>
            </div>
          </div>
        )}
        <iframe
          key={key}
          src={currentUrl}
          className="w-full h-full border-0"
          title="Browser Preview"
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
