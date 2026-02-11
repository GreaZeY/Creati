import { useClient } from "@/context/ClientContext";
import { Dropdown, type DropdownItem } from "../ui/Dropdown";
import { useState } from "react";
import { agencyAPI } from "@/lib/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Briefcase, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const WorkspaceSwitcher = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

  const { clients, selectedClient, selectClient, refreshClients } = useClient();
  // Convert clients to dropdown items
  const dropdownItems: DropdownItem[] = clients.map((client) => ({
    id: client.id,
    label: client.name,
    value: client,
    icon: <Briefcase size={12} className="text-primary" />,
  }));
  return (
    <>
      <Dropdown
        id="workspace-switcher"
        items={dropdownItems}
        value={selectedClient}
        onChange={(item) => selectClient(item.value)}
        placeholder="Select Workspace"
        emptyMessage="No Workspaces Found"
        persistent={true}
        className="w-auto"
        size="md"
        renderTrigger={(item, isOpen, toggle) => (
          <button
            onClick={toggle}
            className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-full border border-border dark:border-white/10 transition-all duration-300",
              "bg-secondary/50 dark:bg-white/[0.03] hover:bg-secondary/80 dark:hover:bg-white/[0.08] backdrop-blur-md",
              "group focus:outline-none focus:border-primary/50",
              isOpen && "border-primary/50 bg-secondary dark:bg-white/[0.08]",
            )}
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 dark:bg-neon-purple/20 flex items-center justify-center shrink-0 border border-primary/30 dark:border-neon-purple/30">
              <Briefcase
                size={12}
                className="text-primary dark:text-neon-purple"
              />
            </div>
            <span className="text-sm font-bold text-foreground dark:text-white tracking-tight font-display">
              {item?.label || "Select Workspace"}
            </span>
            <Plus
              size={14}
              className={cn(
                "text-muted-foreground/40 transition-transform duration-300",
                isOpen ? "rotate-45" : "rotate-0",
              )}
            />
          </button>
        )}
        footerAction={{
          label: "Initialize New Node",
          icon: <Plus size={14} />,
          onClick: () => setShowCreateModal(true),
        }}
      />
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
              className="h-11 bg-muted/50 border-border focus:ring-primary/20"
              autoFocus
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={isCreating || !newWorkspaceName.trim()}
            className="w-full h-11 text-[11px] font-black tracking-[0.2em] uppercase"
          >
            {isCreating ? "Initializing..." : "Create Workspace"}
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default WorkspaceSwitcher;
