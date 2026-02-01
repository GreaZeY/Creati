import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  Home,
  Briefcase,
  User,
  Check,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useClient } from "@/context/ClientContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agencyAPI } from "@/lib/api";
import { ThemeToggle } from "../ThemeToggle";

export function Header() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  const { clients, selectedClient, selectClient, refreshClients } = useClient();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const routeMap: Record<string, string> = {
    dashboard: "Dashboard",
    connect: "Connect Platforms",
    platforms: "My Platforms",
    analytics: "Analytics",
    settings: "Settings",
    upload: "Upload Content",
    login: "Login",
    register: "Register",
    automation: "Workflows",
    "automation/new": "New Workflow",
    blast: "Quick Blast",
    "blast/new": "New Blast",
    pricing: "Ascend",
  };

  const handleCreate = async () => {
    if (!newWorkspaceName.trim()) return;
    setIsCreating(true);
    try {
      await agencyAPI.createClient(newWorkspaceName);
      await refreshClients();
      setShowCreateModal(false);
      setNewWorkspaceName("");
      setIsSwitcherOpen(false);
    } catch (e) {
      // toast handled by interceptor
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <header className="sticky top-0 right-0 z-40 w-full bg-background/80 backdrop-blur-[30px] font-outfit">
      {/* Primary Header Row */}
      <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between gap-4">
        {/* Center: Client Switcher */}
        <div>
          <div className="relative min-w-[240px] max-w-[320px] w-full">
            <button
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-muted/50 hover:bg-muted border border-border transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  {selectedClient ? (
                    <Briefcase size={12} className="text-primary" />
                  ) : (
                    <User size={12} className="text-primary" />
                  )}
                </div>
                <span className="text-xs font-bold tracking-tight truncate">
                  {selectedClient ? selectedClient.name : "Personal Workspace"}
                </span>
              </div>
              <ChevronsUpDown
                size={14}
                className="opacity-40 group-hover:opacity-100 transition-opacity"
              />
            </button>

            <AnimatePresence>
              {isSwitcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsSwitcherOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    className="absolute top-full left-0 w-full mt-2 bg-popover border border-border rounded-xl shadow-2xl z-20 overflow-hidden py-1"
                  >
                    <div className="max-h-[240px] overflow-y-auto">
                      <button
                        onClick={() => {
                          selectClient(null);
                          setIsSwitcherOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/10 text-xs font-medium text-left transition-colors"
                      >
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                          <User size={10} />
                        </div>
                        <span className="flex-1">Personal Workspace</span>
                        {selectedClient === null && (
                          <Check size={14} className="text-primary" />
                        )}
                      </button>

                      {clients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => {
                            selectClient(client);
                            setIsSwitcherOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/10 text-xs font-medium text-left transition-colors"
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <Briefcase size={10} className="text-primary" />
                          </div>
                          <span className="flex-1 truncate">{client.name}</span>
                          {selectedClient?.id === client.id && (
                            <Check size={14} className="text-primary" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="p-2 border-t border-border">
                      <button
                        onClick={() => {
                          setShowCreateModal(true);
                          setIsSwitcherOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black tracking-widest uppercase hover:bg-primary/20 transition-all"
                      >
                        <Plus size={14} />
                        Create Workspace
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="w-48 flex justify-end items-center gap-4">
          <ThemeToggle />
        </div>
      </div>

      {/* Secondary Row: Breadcrumbs */}
      <div className="border-t border-border/50">
        <div className="max-w-7xl mx-auto px-8 h-10 flex items-center">
          <nav className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-muted-foreground/60 uppercase">
            <Link
              to="/dashboard"
              className="hover:text-primary transition-colors flex items-center gap-2"
            >
              <Home size={12} />
              <span>HOME</span>
            </Link>

            {pathnames.map((value, index) => {
              const last = index === pathnames.length - 1;
              const to = `/${pathnames.slice(0, index + 1).join("/")}`;
              const label =
                routeMap[to.slice(1)] ||
                value.charAt(0).toUpperCase() + value.slice(1);

              return (
                <div key={to} className="flex items-center gap-2">
                  <ChevronRight size={12} className="opacity-40" />
                  {last ? (
                    <span className="text-foreground tracking-[0.2em]">
                      {label.toUpperCase()}
                    </span>
                  ) : (
                    <Link
                      to={to}
                      className="hover:text-primary transition-colors"
                    >
                      {label.toUpperCase()}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="NEW WORKSPACE"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest uppercase text-muted-foreground/60">
              Workspace Name
            </label>
            <Input
              placeholder="e.g. Nike Marketing Campaign"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="h-14 bg-muted/50 border-border focus:ring-primary/20"
              autoFocus
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={isCreating || !newWorkspaceName.trim()}
            className="w-full h-14 text-[11px] font-black tracking-[0.2em] uppercase"
          >
            {isCreating ? "Initializing..." : "Create Workspace"}
          </Button>
        </div>
      </Modal>
    </header>
  );
}
