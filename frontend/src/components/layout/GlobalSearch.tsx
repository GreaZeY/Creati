import { useState, useEffect, useCallback } from "react";
import { agencyAPI } from "@/lib/api";
import { Search, Video, User, Command, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useClient } from "@/context/ClientContext";

interface SearchResult {
  type: "video" | "client";
  id: number;
  title: string;
  clientName: string;
  clientColor: string;
}

export const GlobalSearch = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { selectClient, clients } = useClient();

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await agencyAPI.search(q);
      setResults(resp.data.data);
      setSelectedIndex(0);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const handleAction = (result: SearchResult) => {
    if (result.type === "client") {
      const client = clients.find((c) => c.id === result.id);
      if (client) selectClient(client);
      navigate("/dashboard");
    } else {
      // Find the client this video belongs to and select it
      const client = clients.find((c) => c.name === result.clientName);
      if (client) selectClient(client);
      // For now, redirect to dashboard or calendar.
      // In Phase 7.1 we might add a specific video detail view.
      navigate("/calendar");
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowDown") {
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        handleAction(results[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-charcoal/60 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white/10 dark:bg-card/40 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden backdrop-blur-3xl ring-1 ring-white/20"
          >
            <div className="p-6 border-b border-white/10 flex items-center gap-4 bg-white/5">
              <Search className="w-6 h-6 text-neon-purple animate-pulse" />
              <input
                autoFocus
                type="text"
                placeholder="Search across all client workspaces..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-xl font-bold text-white focus:outline-none placeholder:text-white/20"
              />
              <div className="flex items-center gap-1 px-3 py-1 bg-white/10 rounded-lg text-white/40 text-[10px] font-black uppercase tracking-widest border border-white/10">
                <Command className="w-3 h-3" /> K
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 w-full bg-white/5 rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((result, idx) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleAction(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 group border ${
                        selectedIndex === idx
                          ? "bg-neon-purple/10 border-neon-purple/30 shadow-glow-purple/10 translate-x-1"
                          : "bg-white/5 border-transparent hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-xl ${
                            result.type === "video"
                              ? "bg-neon-lime/20 text-neon-lime"
                              : "bg-neon-purple/20 text-neon-purple"
                          }`}
                        >
                          {result.type === "video" ? (
                            <Video size={18} />
                          ) : (
                            <User size={18} />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-white line-clamp-1">
                            {result.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: result.clientColor }}
                            />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                              {result.clientName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <ArrowRight
                        size={16}
                        className={`text-white transition-all transform ${
                          selectedIndex === idx
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 -translate-x-2"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              ) : query.length >= 2 ? (
                <div className="py-12 text-center">
                  <p className="text-white/30 font-bold">
                    No results found for "{query}"
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center space-y-4">
                  <div className="flex justify-center gap-6 text-white/20">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
                        <Video size={20} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Videos
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
                        <User size={20} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Clients
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-white/20">
                    Start typing to scan the agency ecosystem...
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</span>{" "}
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-white/10 rounded">↵</span>{" "}
                  Select
                </span>
              </div>
              <span>
                Press <span className="text-white/60">ESC</span> to Close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
