"use client";

import { useEffect, useRef } from "react";

const Terminal = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !terminalRef.current || terminalInstanceRef.current) {
      return;
    }

    const initTerminal = async () => {
      try {
        const { Terminal: XTerminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        
        // Create Terminal and FitAddon
        const term = new XTerminal({ 
          rows: 10, 
          cols: 60,
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4'
          }
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current!);
        fitAddon.fit();
        term.writeln("Mock Terminal Started...");
        
        terminalInstanceRef.current = term;

        // Resize terminal on window resize
        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);
        
        return () => {
          window.removeEventListener("resize", handleResize);
          term.dispose();
        };
      } catch (error) {
        console.error("Failed to initialize terminal:", error);
      }
    };
    
    initTerminal();
  }, []);

  const writeToTerminal = (text: string) => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.writeln(text);
    }
  };

  // Expose the write function to parent
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).writeToTerminal = writeToTerminal;
    }
  }, []);

  return <div ref={terminalRef} className="h-40 w-full" />;
};

export default Terminal;