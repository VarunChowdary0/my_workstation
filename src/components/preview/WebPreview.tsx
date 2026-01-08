"use client";

import { useState, useEffect, useRef } from "react";
import { XIcon, Maximize2, Minimize2, RefreshCw, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WebPreviewProps {
  htmlContent: string;
  onClose: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export default function WebPreview({
  htmlContent,
  onClose,
  onToggleFullscreen,
  isFullscreen,
}: WebPreviewProps) {
  const [key, setKey] = useState(0);
  const [liveMode, setLiveMode] = useState(true);
  const [debouncedHtml, setDebouncedHtml] = useState(htmlContent);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce html content updates (500ms delay)
  useEffect(() => {
    if (liveMode) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        setDebouncedHtml(htmlContent);
      }, 500);
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [htmlContent, liveMode]);

  const handleRefresh = () => {
    setDebouncedHtml(htmlContent);
    setKey((prev) => prev + 1);
  };

  const toggleLiveMode = () => {
    setLiveMode((prev) => !prev);
    if (!liveMode) {
      // When enabling live mode, refresh immediately
      setDebouncedHtml(htmlContent);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-[#252526]">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${liveMode ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
          <span className="text-sm text-gray-300">Preview</span>
          {liveMode && <span className="text-[10px] text-green-400">LIVE</span>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLiveMode}
            className={`h-7 w-7 hover:bg-[#3e3e42] ${liveMode ? "text-green-400 hover:text-green-300" : "text-gray-400 hover:text-white"}`}
            title={liveMode ? "Disable Live Mode" : "Enable Live Mode"}
          >
            {liveMode ? <Zap size={14} /> : <ZapOff size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
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
      <div className="flex-1 bg-white">
        <iframe
          key={key}
          srcDoc={debouncedHtml}
          className="w-full h-full border-0"
          title="Web Preview"
          sandbox="allow-scripts allow-forms allow-modals"
        />
      </div>
    </div>
  );
}
