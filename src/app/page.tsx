"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function WorkstationDemo() {
  const [code, setCode] = useState("// Write your code here\nconsole.log('Hello World')");
  const [aiResponse, setAiResponse] = useState<string>("");

  // Terminal refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      // Create Terminal and FitAddon
      const term = new Terminal({ rows: 10, cols: 60 });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      term.writeln("Mock Terminal Started...");
      
      // Save references
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Resize terminal on window resize
      const handleResize = () => fitAddon.fit();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const runCode = () => {
    if (xtermRef.current) {
      xtermRef.current.writeln(`$ node demo.js`);
      xtermRef.current.writeln(`Hello World 🌍`);
    }
    setAiResponse("✅ Looks good! Maybe try adding a loop?");
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-screen">
      {/* Code Editor */}
      <Card className="flex flex-col">
        <CardContent className="flex-1 p-0">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={code}
            theme="vs-dark"
            onChange={(val) => setCode(val || "")}
          />
        </CardContent>
        <div className="p-2 border-t">
          <Button onClick={runCode}>Run Code</Button>
        </div>
      </Card>

      {/* Right side */}
      <div className="flex flex-col gap-4">
        {/* Terminal */}
        <Card>
          <CardContent className="p-2">
            <div ref={terminalRef} className="h-40 w-full" />
          </CardContent>
        </Card>

        {/* AI Assistant */}
        <Card className="flex-1">
          <CardContent className="p-2 overflow-auto">
            <h2 className="font-bold mb-2">AI Assistant</h2>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {aiResponse}
            </ReactMarkdown>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
