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
}

const SortableWorkspaceItem = ({
  client,
  onRename,
  onDelete,
  onColorChange,
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
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDeleteConfirm) {
      // Wait for animation frame to ensure element is rendering
      const timer = setTimeout(() => {
        confirmRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showDeleteConfirm]);

  // Sync back to parent with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localColor !== client.color) {
        onColorChange(client.id, localColor);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localColor, client.id, onColorChange, client.color]);

  // Sync from parent if changed externally (e.g. discard)
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
          "p-2 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl ring-1 ring-border transition-all group flex items-center gap-3",
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

        {/* Circular Color Picker */}
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
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          )}
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
              className="mt-2 p-4 border-destructive/20 bg-destructive/5 ring-1 ring-destructive/30 scroll-mt-20"
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
    </div>
  );
};

export const WorkspaceManager = () => {
  const [workspaces, setWorkspaces] = useState<Client[]>([]);
  const [draftWorkspaces, setDraftWorkspaces] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    JSON.stringify(workspaces) !== JSON.stringify(draftWorkspaces);

  // Hook handles blocking and shake trigger
  const shouldShake = useNavigationLock(isDirty);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchWorkspaces = async () => {
    try {
      const resp = await agencyAPI.listClients();
      if (resp.data.success) {
        // Sort by displayOrder and normalize colors
        const normalized = (resp.data.data || [])
          .map((w) => ({
            ...w,
            color: w.color || "#000000",
          }))
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        setWorkspaces(normalized);
        setDraftWorkspaces(normalized);
      }
    } catch (err) {
      toast.error("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = draftWorkspaces.findIndex((w) => w.id === active.id);
      const newIndex = draftWorkspaces.findIndex((w) => w.id === over.id);

      const reordered = arrayMove(draftWorkspaces, oldIndex, newIndex);
      // Update displayOrder in draft
      const withNewOrders = reordered.map((w, idx) => ({
        ...w,
        displayOrder: idx,
      }));
      setDraftWorkspaces(withNewOrders);
    }
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
      // We must fetch to ensure we get the ID and correct state sync
      await fetchWorkspaces();
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

  if (loading)
    return (
      <div className="p-8 text-center opacity-40 animate-pulse font-black uppercase tracking-widest text-[10px]">
        Loading workspaces...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg tracking-tight">Manage Workspaces</h3>
        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          className="rounded-xl h-8 px-3 font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add New
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
            <Card className="mb-6 p-4 border-primary/20 bg-primary/[0.02] ring-1 ring-primary/30 rounded-2xl">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">
                    Workspace Name
                  </label>
                  <Input
                    autoFocus
                    placeholder="e.g. Acme Marketing, Personal Hub"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="h-10 text-sm font-bold bg-secondary/30 dark:bg-background/50 border-0 ring-1 ring-border focus:ring-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 font-bold uppercase tracking-widest text-[10px] px-4"
                    onClick={handleAdd}
                  >
                    Create Workspace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 font-bold uppercase tracking-widest text-[10px] px-4"
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
              />
            ))}

            {draftWorkspaces.length === 0 && (
              <div className="p-12 text-center rounded-[2rem] border-2 border-dashed border-border/50 opacity-40">
                <p className="font-black uppercase tracking-widest text-xs">
                  No workspaces yet
                </p>
                <p className="text-xs font-medium mt-2">
                  Create one to start organizing your projects
                </p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Floating Save Bar */}
      <SaveChangesBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleCommit}
        onDiscard={handleDiscard}
        shake={shouldShake}
      />
    </div>
  );
};
