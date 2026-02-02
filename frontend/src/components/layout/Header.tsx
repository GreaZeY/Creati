import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home, Briefcase, User, Plus } from "lucide-react";
import { useClient } from "@/context/ClientContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agencyAPI } from "@/lib/api";
import { ThemeToggle } from "../ThemeToggle";
import { HEADER_HEIGHT } from "@/lib/constants";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";

export function Header() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  const { clients, selectedClient, selectClient, refreshClients } = useClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Convert clients to dropdown items
  const dropdownItems: DropdownItem[] = clients.map((client) => ({
    id: client.id,
    label: client.name,
    value: client,
    icon: <Briefcase size={12} className="text-primary" />,
  }));

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
    } catch (e) {
      // toast handled by interceptor
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <header
      className={`sticky top-0 right-0 z-40 w-full bg-background/80 backdrop-blur-[30px] font-outfit h-${HEADER_HEIGHT}`}
    >
      {/* Primary Header Row */}
      <div className="max-w-7xl pr-8 flex items-center justify-between gap-4 h-full">
        {/* Center: Client Switcher */}
        <div>
          <Dropdown
            id="workspace-switcher"
            items={dropdownItems}
            value={selectedClient}
            onChange={(item) => selectClient(item.value)}
            placeholder="Select Workspace"
            emptyMessage="No Workspaces Found"
            persistent={true}
            size="sm"
            renderTrigger={(item, _, toggle) => (
              <button
                onClick={toggle}
                className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-muted/50 hover:bg-muted border border-border transition-all group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    {item ? (
                      <Briefcase size={12} className="text-primary" />
                    ) : (
                      <User size={12} className="text-primary" />
                    )}
                  </div>
                  <span className="text-xs font-bold tracking-tight truncate">
                    {item?.label || "Select Workspace"}
                  </span>
                </div>
              </button>
            )}
            footerAction={{
              label: "Create Workspace",
              icon: <Plus size={14} />,
              onClick: () => setShowCreateModal(true),
            }}
          />
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
