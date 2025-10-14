"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, User, Send, RotateCcw, Code, FileText, Zap, Copy, Check, XIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useProjectStore } from "@/store/projectStore";
import { allServices } from "@/services/allServices";
import { Messaage } from "@/types/types";

interface currProps{
  onClose: ()=> void;
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
  const [input, setInput] = useState("");
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    isTyping,
    setTyping,
    aiModelId,
    aiModelConfig,
    openedFiles,
  } = useProjectStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Seed greeting once
    if (chatMessages.length === 0) {
      addChatMessage({ role: "assistant", content: "Hi! I'm GitHub Copilot. I can help you write code, answer questions, and explain concepts. What would you like to work on?" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    addChatMessage({ role: "user", content: userMessage, timestamp: new Date().toISOString() });
    setInput("");
    setTyping(true);
    try {
      const history:Messaage[] = chatMessages.map(({ role, content }) => ({ role, content }));
      
      // Debug: Log opened files
      console.log("Opened files:", openedFiles);
      
      // Collect all opened files content as strings
      const openedFilesContent: string[] = openedFiles.map((file) => {
        const fileExtension = file.path.split('.').pop() || '';
        return `// File: ${file.path} (${fileExtension})\n${file.node.content || '// No content'}`;
      });
      
      // Convert to single string
      const allFilesString = openedFilesContent.join('\n\n---\n\n');
      
      // Debug: Log the files string being sent
      console.log("Files string length:", allFilesString.length);
      console.log("Files string preview:", allFilesString.substring(0, 200));
      
      const data = await allServices.assist(
        userMessage,
        allFilesString, // Send all opened files content
        "", // language - we'll let the API figure it out from file extensions
        "code",
        aiModelId || "gpt-4o-mini",
        aiModelConfig || { model: "gpt-4o-mini", temperature: 0.4, maxTokens: 2048, systemMessage: "You are a helpful coding assistant." },
        history
      );
      const reply: string = data?.message || data?.content || (typeof data === 'string' ? data : JSON.stringify(data));
      addChatMessage({ role: "assistant", content: reply, timestamp: new Date().toISOString() });
    } catch (e: any) {
      addChatMessage({ role: "assistant", content: `Sorry, I hit an error: ${e?.message || e}`, timestamp: new Date().toISOString() });
    } finally {
      setTyping(false);
    }
  };

  const onClearChat = () => {
    clearChat();
    addChatMessage({ role: "assistant", content: "Hi! I'm GitHub Copilot. I can help you write code, answer questions, and explain concepts. What would you like to work on?" });
  };

  const quickPrompts = [
    { icon: Code, text: "Explain this code" },
    { icon: Zap, text: "Fix this error" },
    { icon: FileText, text: "Add comments" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className=" border-b px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-400" />
          <span className="font-semibold text-[#cccccc] text-sm">Copilot Chat</span>
          {openedFiles.length > 0 && (
            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
              {openedFiles.length} file{openedFiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearChat}
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4">
        {chatMessages.map((msg, idx) => (
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
                    code({ node, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const code = String(children).replace(/\n$/, "");
                      const inline = !match;
                      
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
  {chatMessages.length <= 1 && (
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