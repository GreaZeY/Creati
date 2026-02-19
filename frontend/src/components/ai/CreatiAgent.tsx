import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  X,
  Send,
  Sparkles,
  BarChart3,
  Zap,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { aiAPI } from "@/lib/api";
import { toast } from "@/lib/events";

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "action";
  actionData?: any;
}

export function CreatiAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your Creati Agent. I can help you setup automations, analyze your growth, or launch a cross-platform blast. What's on your mind?",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userContent = input.trim();
    const userMsg: Message = { role: "user", content: userContent };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await aiAPI.chat({
        conversationId,
        message: userContent,
      });

      if (response.data.success) {
        const { conversationId: newCid, message: assistantContent } =
          response.data.data;

        setConversationId(newCid);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: assistantContent,
          },
        ]);
      }
    } catch (err) {
      console.error("Agent chat error:", err);
      toast.error("Agent is currently offline. Please try again later.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center justify-center text-white border border-white/20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/10 animate-pulse" />
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </motion.button>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(10px)" }}
            className="fixed bottom-24 right-6 z-[100] w-[380px] h-[550px] glass-panel flex flex-col overflow-hidden border border-white/10 shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neon-purple/20 flex items-center justify-center border border-neon-purple/30">
                  <Sparkles size={16} className="text-neon-purple" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Creati Agent
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">
                      System Active
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === "user" ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-neon-purple/20 border border-neon-purple/30 text-white rounded-tr-none"
                        : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 border border-white/10 text-white/50 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs">
                    <Loader2 size={14} className="animate-spin" />
                    Agent is thinking...
                  </div>
                </motion.div>
              )}

              {/* Optional Quick Actions */}
              {messages[messages.length - 1]?.role === "assistant" && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <QuickAction
                    icon={<Zap size={12} />}
                    label="Set Automation"
                  />
                  <QuickAction
                    icon={<BarChart3 size={12} />}
                    label="Growth Intel"
                  />
                  <QuickAction
                    icon={<MessageSquare size={12} />}
                    label="Caption Helper"
                  />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/5 border-t border-white/5">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask me anything..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-neon-purple/50 transition-all shadow-inner"
                />
                <button
                  onClick={handleSend}
                  className="absolute right-2 w-8 h-8 rounded-lg bg-neon-purple flex items-center justify-center text-white hover:bg-neon-purple/80 transition-all shadow-lg"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QuickAction({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <motion.button
      whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.1)" }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70 hover:text-white transition-all"
    >
      {icon}
      {label}
    </motion.button>
  );
}
