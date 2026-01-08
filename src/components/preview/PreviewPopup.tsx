"use client";

import { useState, useEffect, useRef } from "react";
import { XIcon, Minimize2, RefreshCw, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewPopupProps {
  htmlContent: string;
  onClose: () => void;
}

export default function PreviewPopup({ htmlContent, onClose }: PreviewPopupProps) {
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
      setDebouncedHtml(htmlContent);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
      <div
        className="relative bg-[#1e1e1e] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ width: "90vw", height: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-[#252526]">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${liveMode ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
            <span className="text-sm text-gray-300 font-medium">Preview - Fullscreen</span>
            {liveMode && <span className="text-[10px] text-green-400">LIVE</span>}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLiveMode}
              className={`h-8 w-8 hover:bg-[#3e3e42] ${liveMode ? "text-green-400 hover:text-green-300" : "text-gray-400 hover:text-white"}`}
              title={liveMode ? "Disable Live Mode" : "Enable Live Mode"}
            >
              {liveMode ? <Zap size={16} /> : <ZapOff size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#3e3e42]"
              title="Exit Fullscreen"
            >
              <Minimize2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-[#3e3e42]"
              title="Close"
            >
              <XIcon size={16} />
            </Button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 bg-white">
          <iframe
            key={key}
            srcDoc={debouncedHtml}
            className="w-full h-full border-0"
            title="Web Preview Fullscreen"
            sandbox="allow-scripts allow-forms allow-modals"
          />
        </div>
      </div>
    </div>
  );
}
