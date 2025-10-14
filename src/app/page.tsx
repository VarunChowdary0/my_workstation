"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Dynamically import components to avoid SSR issues
const Editor = dynamic(() => import("@monaco-editor/react"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-gray-800 text-white">Loading editor...</div>
});

const Terminal = dynamic(() => import("@/components/Terminal"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-40 bg-gray-900 text-white">Loading terminal...</div>
});

export default function WorkstationDemo() {
  const [code, setCode] = useState("// Write your code here\nconsole.log('Hello World')");
  const [aiResponse, setAiResponse] = useState<string>("");

  const runCode = () => {
    // Write to terminal using global function
    if (typeof window !== "undefined" && (window as any).writeToTerminal) {
      (window as any).writeToTerminal(`$ node demo.js`);
      (window as any).writeToTerminal(`Hello World 🌍`);
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
            <Terminal />
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
