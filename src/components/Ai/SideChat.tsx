"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, User, Send, RotateCcw, MessageSquare, Code, FileText, Zap, Copy, Check, XIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface currProps{
  onClose: ()=> void;
}
interface Message {
  role: "user" | "assistant";
  content: string;
}

const CodeBlock = ({ language, children }: { language?: string; children: string }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between bg-[#1e1e1e] border border-[#3e3e42] rounded-t-md px-3 py-1.5">
        <span className="text-[10px] text-[#858585] font-mono uppercase">{language || 'code'}</span>
        <button
          onClick={copyToClipboard}
          className="text-[#858585] hover:text-[#cccccc] transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="bg-[#1e1e1e] border border-t-0 border-[#3e3e42] rounded-b-md p-3 overflow-x-auto">
        <code className="text-[#d4d4d4] text-xs font-mono leading-relaxed">
          {children}
        </code>
      </pre>
    </div>
  );
};

const SideChat:React.FC<currProps> = ({onClose}) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "assistant", 
      content: "Hi! I'm GitHub Copilot. I can help you write code, answer questions, and explain concepts. What would you like to work on?" 
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setMessages([...messages, { role: "user", content: userMessage }]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response with different examples
    setTimeout(() => {
      let response = "";
      
      if (userMessage.toLowerCase().includes("javascript") || userMessage.toLowerCase().includes("js")) {
        response = "Here's a JavaScript example:\n\n```javascript\n// Print to console\nconsole.log('Hello, World!');\n\n// Variables\nconst name = 'GitHub Copilot';\nlet count = 0;\n\n// Function\nfunction greet(user) {\n  return `Hello, ${user}!`;\n}\n```\n\nWould you like me to explain any of these concepts?";
      } else if (userMessage.toLowerCase().includes("react")) {
        response = "Here's a simple React component:\n\n```tsx\nimport { useState } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>\n        Increment\n      </button>\n    </div>\n  );\n}\n\nexport default Counter;\n```\n\nThis component uses the `useState` hook to manage state.";
      } else if (userMessage.toLowerCase().includes("python")) {
        response = "Here's a Python example:\n\n```python\n# Print statement\nprint('Hello, World!')\n\n# List comprehension\nnumbers = [x**2 for x in range(10)]\n\n# Function\ndef greet(name):\n    return f'Hello, {name}!'\n\n# Class\nclass Person:\n    def __init__(self, name):\n        self.name = name\n```";
      } else {
        response = `I can help with that! Here are some things I can do:\n\n- **Write code** in multiple languages\n- **Explain** programming concepts\n- **Debug** and fix issues\n- **Suggest** best practices\n- **Refactor** existing code\n\nWhat specific task would you like help with?`;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const clearChat = () => {
    setMessages([
      { 
        role: "assistant", 
        content: "Hi! I'm GitHub Copilot. I can help you write code, answer questions, and explain concepts. What would you like to work on?" 
      },
    ]);
  };

  const quickPrompts = [
    { icon: Code, text: "Explain this code" },
    { icon: Zap, text: "Fix this error" },
    { icon: FileText, text: "Add comments" },
  ];

  return (
    <div className="h-screen  flex flex-col">
      {/* Header */}
      <div className=" border-b px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-400" />
          <span className="font-semibold text-[#cccccc] text-sm">Copilot Chat</span>
        </div>
        <div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            className="h-7 w-7 text-[#cccccc] hover:bg-[#3e3e42]"
          >
            <RotateCcw size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-[#cccccc] hover:bg-[#3e3e42]"
          >
            <XIcon size={14} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto  px-4 py-3 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "items-start" : "items-start"}`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-purple-500 to-pink-500"
                  : "bg-[#0078d4]"
              }`}
            >
              {msg.role === "assistant" ? (
                <Sparkles size={14} className="text-white" />
              ) : (
                <User size={14} className="text-white" />
              )}
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#cccccc] mb-1 font-medium">
                {msg.role === "assistant" ? "Copilot" : "You"}
              </div>
              <div className="text-[#cccccc] text-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const code = String(children).replace(/\n$/, "");
                      
                      return !inline && match ? (
                        <CodeBlock language={match[1]}>
                          {code}
                        </CodeBlock>
                      ) : (
                        <code
                          className="bg-[#2d2d30] px-1.5 py-0.5 rounded text-[#d4d4d4] text-xs font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    p({ children }) {
                      return <p className="text-[#cccccc]">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="text-[#cccccc] list-disc pl-5">{children}</ul>;
                    },
                    li({ children }) {
                      return <li className="text-[#cccccc]">{children}</li>;
                    },
                    strong({ children }) {
                      return <strong className="text-[#ffffff] font-semibold">{children}</strong>;
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#cccccc] mb-1 font-medium">Copilot</div>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#cccccc] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 bg-[#cccccc] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 bg-[#cccccc] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          {quickPrompts.map((prompt, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => {
                setInput(prompt.text);
                inputRef.current?.focus();
              }}
              className="bg-[#2d2d30] border-[#3e3e42] text-[#cccccc] hover:bg-[#3e3e42] hover:text-white text-xs h-7"
            >
              <prompt.icon size={12} className="mr-1.5" />
              {prompt.text}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[#3e3e42] bg-[#252526] p-3">
        <div className="flex gap-2 items-end bg-[#3c3c3c] rounded-lg border border-[#3e3e42] p-2 focus-within:border-[#007acc]">
          <Input
            ref={inputRef}
            placeholder="Ask Copilot or type / for commands"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="bg-transparent border-0 text-[#cccccc] placeholder:text-[#6a6a6a] focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            className="h-8 w-8 bg-[#0078d4] hover:bg-[#005a9e] flex-shrink-0 disabled:opacity-50"
          >
            <Send size={14} />
          </Button>
        </div>
        <div className="text-[10px] text-[#6a6a6a] mt-2 text-center">
          Use @ to mention code or files
        </div>
      </div>
    </div>
  );
};

export default SideChat;