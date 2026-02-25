import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  AlertTriangle,
  Users,
  Layout,
  Mail,
  Shield,
  UserPlus,
  Share2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { agencyAPI, type Client } from "@/lib/api";
import { toast } from "@/lib/events";
import { cn } from "@/lib/utils";
import { SaveChangesBar } from "@/components/ui/SaveChangesBar";
import { useNavigationLock } from "@/hooks/useNavigationLock";

interface SortableItemProps {
  client: Client;
  onRename: (id: number, newName: string) => void;
  onDelete: (id: number) => void;
  onColorChange: (id: number, color: string) => void;
  onToggleSharing: (id: number, enabled: boolean) => void;
}

const SortableWorkspaceItem = ({
  client,
  onRename,
  onDelete,
  onColorChange,
  onToggleSharing,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localColor, setLocalColor] = useState(client.color || "#000000");
  const [showSharing, setShowSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDeleteConfirm) {
      const timer = setTimeout(() => {
        confirmRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (showSharing) {
      const timer = setTimeout(() => {
        shareRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showSharing]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localColor !== client.color) {
        onColorChange(client.id, localColor);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localColor, client.id, onColorChange, client.color]);

  useEffect(() => {
    setLocalColor(client.color || "#000000");
  }, [client.color]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  };

  const handleSave = () => {
    if (editName.trim() && editName !== client.name) {
      onRename(client.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50")}
    >
      <Card
        className={cn(
          "p-2 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl ring-1 ring-border transition-all group flex items-center gap-3 rounded-2xl",
          isDragging && "shadow-2xl ring-primary/50",
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-md transition-colors"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </div>

        <div className="relative group/color">
          <div
            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white font-black text-[10px] shadow-inner cursor-pointer hover:scale-110 transition-transform relative overflow-hidden ring-2 ring-background ring-offset-2 ring-offset-transparent"
            style={{ backgroundColor: localColor }}
          >
            <span className="relative z-10">
              {client.name.charAt(0).toUpperCase()}
            </span>
            <input
              type="color"
              value={localColor}
              onChange={(e) => setLocalColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="h-6 py-0 text-xs font-bold bg-muted/50 border-0 ring-1 ring-primary/30"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={handleSave}
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(client.name);
                  }}
                >
                  <X className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-hidden">
                <h4 className="font-bold text-xs truncate">{client.name}</h4>
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-all"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSharing(!showSharing)}
            className={cn(
              "h-6 w-6 shrink-0 transition-all",
              showSharing
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5",
            )}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card
              ref={confirmRef}
              className="mt-2 p-4 border-destructive/20 bg-destructive/5 ring-1 ring-destructive/30 scroll-mt-20 rounded-2xl"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-destructive">
                      Delete workspace?
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      This will permanently delete all associated platforms,
                      videos, and settings.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-[10px] font-black uppercase tracking-widest px-4"
                      onClick={() => onDelete(client.id)}
                    >
                      Yes, Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-[10px] font-black uppercase tracking-widest px-4"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSharing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card
              ref={shareRef}
              className="mt-2 p-4 border-primary/20 bg-primary/5 backdrop-blur-xl ring-1 ring-primary/20 rounded-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h5 className="text-[10px] font-black uppercase tracking-widest">
                    Live Portal Sharing
                  </h5>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">
                    Toggle public report access
                  </p>
                </div>
                <button
                  onClick={() =>
                    onToggleSharing(client.id, !client.shareEnabled)
                  }
                  className={cn(
                    "w-10 h-5 rounded-full transition-all relative p-1 ring-1 ring-inset",
                    client.shareEnabled
                      ? "bg-primary ring-primary"
                      : "bg-muted ring-border",
                  )}
                >
                  <motion.div
                    animate={{ x: client.shareEnabled ? 20 : 0 }}
                    className="w-3 h-3 bg-white rounded-full shadow-lg"
                  />
                </button>
              </div>

              {client.shareEnabled && client.shareToken && (
                <div className="space-y-2">
                  <div className="p-2 bg-black/20 rounded-xl border border-white/5 flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/report/${client.shareToken}`}
                      className="h-8 py-0 bg-transparent border-0 text-[10px] font-bold text-muted-foreground focus-visible:ring-0"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/report/${client.shareToken}`,
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        toast.success("Link copied to clipboard");
                      }}
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                    <a
                      href={`/report/${client.shareToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                  <p className="text-[8px] font-bold text-primary/60 uppercase text-center italic">
                    Clients can view live analytics without logging in.
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const WorkspaceManager = () => {
  const [activeTab, setActiveTab] = useState<"workspaces" | "team">(
    "workspaces",
  );
  const [workspaces, setWorkspaces] = useState<Client[]>([]);
  const [draftWorkspaces, setDraftWorkspaces] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Team state
  const [team, setTeam] = useState<any[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");

  const isDirty =
    activeTab === "workspaces" &&
    JSON.stringify(workspaces) !== JSON.stringify(draftWorkspaces);

  const shouldShake = useNavigationLock(isDirty);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "workspaces") {
        const resp = await agencyAPI.listClients();
        if (resp.data.success) {
          const normalized = (resp.data.data || [])
            .map((w) => ({ ...w, color: w.color || "#000000" }))
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
          setWorkspaces(normalized);
          setDraftWorkspaces(normalized);
        }
      } else {
        const resp = await agencyAPI.listTeam();
        if (resp.data.success) {
          setTeam(resp.data.data);
        }
      }
    } catch (err) {
      toast.error(`Failed to load ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = draftWorkspaces.findIndex((w) => w.id === active.id);
      const newIndex = draftWorkspaces.findIndex((w) => w.id === over.id);
      const reordered = arrayMove(draftWorkspaces, oldIndex, newIndex);
      const withNewOrders = reordered.map((w, idx) => ({
        ...w,
        displayOrder: idx,
      }));
      setDraftWorkspaces(withNewOrders);
    }
  };

  const handleToggleSharing = (id: number, enabled: boolean) => {
    setDraftWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, shareEnabled: enabled } : w)),
    );
  };

  const handleRename = (id: number, name: string) => {
    setDraftWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name } : w)),
    );
  };

  const handleColorChange = (id: number, color: string) => {
    setDraftWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, color } : w)),
    );
  };

  const handleDelete = async (id: number) => {
    try {
      await agencyAPI.deleteClient(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setDraftWorkspaces((prev) => prev.filter((w) => w.id !== id));
      toast.success("Workspace deleted");
    } catch (err) {
      toast.error("Failed to delete workspace");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await agencyAPI.createClient(newName.trim(), "#6366f1");
      setNewName("");
      setIsAdding(false);
      await fetchData();
      toast.success("Workspace created");
    } catch (err) {
      toast.error("Failed to create workspace");
    }
  };

  const handleCommit = async () => {
    setIsSaving(true);
    try {
      await agencyAPI.commitClients(draftWorkspaces);
      setWorkspaces(draftWorkspaces);
      toast.success("Changes saved successfully");
    } catch (err) {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraftWorkspaces(workspaces);
    toast.info("Changes discarded");
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await agencyAPI.inviteMember(inviteEmail, inviteRole);
      setInviteEmail("");
      setIsInviting(false);
      await fetchData();
      toast.success("Team member invited");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to invite member",
      );
    }
  };

  const handleRemoveMember = async (id: number) => {
    try {
      await agencyAPI.removeMember(id);
      await fetchData();
      toast.success("Member removed");
    } catch (err) {
      toast.error("Failed to remove member");
    }
  };

  const handleUpdateRole = async (id: number, role: string) => {
    try {
      await agencyAPI.updateMemberRole(id, role);
      await fetchData();
      toast.success("Role updated");
    } catch (err) {
      toast.error("Failed to update role");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center p-1 bg-secondary/30 rounded-2xl border border-border/50 w-fit">
        <button
          onClick={() => setActiveTab("workspaces")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "workspaces"
              ? "bg-primary text-white shadow-xl shadow-primary/20"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layout className="w-3.5 h-3.5" />
          Workspaces
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "team"
              ? "bg-primary text-white shadow-xl shadow-primary/20"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Team Control
        </button>
      </div>

      {activeTab === "workspaces" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg tracking-tight">Manage Nodes</h3>
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
              className="rounded-xl h-8 px-3 font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Node
            </Button>
          </div>

          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="mb-6 p-4 border-primary/20 bg-primary/[0.02] ring-1 ring-primary/30 rounded-[2rem]">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        Client/Project Name
                      </label>
                      <Input
                        autoFocus
                        placeholder="e.g. Acme Marketing, Personal Hub"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        className="h-12 text-sm font-bold bg-secondary/30 border-0 ring-1 ring-border focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-8 font-bold uppercase tracking-widest text-[10px] px-6"
                        onClick={handleAdd}
                      >
                        Initialize Node
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 font-bold uppercase tracking-widest text-[10px] px-6"
                        onClick={() => {
                          setIsAdding(false);
                          setNewName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="p-8 text-center opacity-40 animate-pulse font-black uppercase tracking-widest text-[10px]">
              Syncing nodes...
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={draftWorkspaces.map((w) => w.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {draftWorkspaces.map((workspace) => (
                    <SortableWorkspaceItem
                      key={workspace.id}
                      client={workspace}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onColorChange={handleColorChange}
                      onToggleSharing={handleToggleSharing}
                    />
                  ))}
                  {draftWorkspaces.length === 0 && (
                    <div className="p-12 text-center rounded-[2rem] border-2 border-dashed border-border/50 opacity-40">
                      <p className="font-black uppercase tracking-widest text-xs">
                        No active nodes
                      </p>
                      <p className="text-xs font-medium mt-2">
                        Add a client workspace to begin orchestration.
                      </p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <SaveChangesBar
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={handleCommit}
            onDiscard={handleDiscard}
            shake={shouldShake}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg tracking-tight">
              Organization Team
            </h3>
            <Button
              size="sm"
              onClick={() => setIsInviting(true)}
              className="rounded-xl h-8 px-3 font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 text-white"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Invite Member
            </Button>
          </div>

          <AnimatePresence>
            {isInviting && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="mb-6 p-4 border-primary/20 bg-primary/[0.02] ring-1 ring-primary/30 rounded-[2rem]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          autoFocus
                          placeholder="colleague@agency.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="h-12 pl-10 text-sm font-bold bg-secondary/30 border-0 ring-1 ring-border focus:ring-primary/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        Permission Role
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full h-12 rounded-xl bg-secondary/30 border-0 ring-1 ring-border px-4 text-sm font-bold focus:ring-primary/50 outline-none appearance-none"
                      >
                        <option value="admin">
                          Administrator (Full Access)
                        </option>
                        <option value="editor">Editor (Node Access)</option>
                        <option value="viewer">Viewer (Read Only)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 font-bold uppercase tracking-widest text-[10px] px-6"
                      onClick={handleInvite}
                    >
                      Send Invitation
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 font-bold uppercase tracking-widest text-[10px] px-6"
                      onClick={() => setIsInviting(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="p-8 text-center opacity-40 animate-pulse font-black uppercase tracking-widest text-[10px]">
              Syncing team roster...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {team.map((member) => (
                <Card
                  key={member.id}
                  className="p-4 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl ring-1 ring-border rounded-2xl flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20 overflow-hidden shrink-0">
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-black text-primary text-sm uppercase">
                        {member.name?.charAt(0) || member.email.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm truncate">
                        {member.name || member.email}
                      </h4>
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                          member.role === "owner"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : member.role === "admin"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-muted text-muted-foreground border border-border",
                        )}
                      >
                        {member.role}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium truncate">
                      {member.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {member.role !== "owner" && (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleUpdateRole(member.id, e.target.value)
                          }
                          className="h-8 rounded-lg bg-secondary/50 border-0 ring-1 ring-border px-2 text-[10px] font-bold focus:ring-primary/50 outline-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveMember(member.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {member.role === "owner" && (
                      <Shield className="w-4 h-4 text-amber-500 shrink-0 mr-2" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
