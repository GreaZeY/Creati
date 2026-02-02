import { useState, useEffect } from "react";
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
      className={cn("mb-3", isDragging && "opacity-50")}
    >
      <Card
        className={cn(
          "p-3 border-0 bg-card/40 backdrop-blur-xl ring-1 ring-border/50 transition-all group flex items-center gap-3",
          isDragging && "shadow-2xl ring-primary/50",
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-md transition-colors"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <div
          className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white font-black text-sm shadow-inner group-hover:scale-110 transition-transform"
          style={{ backgroundColor: client.color || "#000000" }}
        >
          {client.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="h-8 py-0 text-sm font-bold bg-muted/50 border-0 ring-1 ring-primary/30"
              />
              <Button size="icon" variant="ghost" onClick={handleSave}>
                <Check className="w-4 h-4 text-emerald-500" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(client.name);
                }}
              >
                <X className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <h4 className="font-bold text-sm truncate">{client.name}</h4>
              <button
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Input
            type="color"
            value={client.color || "#000000"}
            onChange={(e) => onColorChange(client.id, e.target.value)}
            className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded-md overflow-hidden shrink-0"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
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
            <Card className="mt-2 p-4 border-destructive/20 bg-destructive/5 ring-1 ring-destructive/30">
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
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

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
        // Sort by displayOrder if available
        const sorted = [...(resp.data.data || [])].sort(
          (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
        );
        setWorkspaces(sorted);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = workspaces.findIndex((w) => w.id === active.id);
      const newIndex = workspaces.findIndex((w) => w.id === over.id);

      const newWorkspaces = arrayMove(workspaces, oldIndex, newIndex);
      setWorkspaces(newWorkspaces);

      try {
        await agencyAPI.reorderClients(newWorkspaces.map((w) => w.id));
        toast.success("Order saved");
      } catch (err) {
        toast.error("Failed to save order");
        fetchWorkspaces(); // Rollback
      }
    }
  };

  const handleRename = async (id: number, name: string) => {
    try {
      await agencyAPI.updateClient(id, { name });
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, name } : w)),
      );
      toast.success("Workspace renamed");
    } catch (err) {
      toast.error("Failed to rename workspace");
    }
  };

  const handleColorChange = async (id: number, color: string) => {
    try {
      await agencyAPI.updateClient(id, { color });
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, color } : w)),
      );
    } catch (err) {
      toast.error("Failed to update color");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await agencyAPI.deleteClient(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
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
      fetchWorkspaces();
      toast.success("Workspace created");
    } catch (err) {
      toast.error("Failed to create workspace");
    }
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
            <Card className="mb-6 p-4 border-primary/20 bg-primary/[0.02] ring-1 ring-primary/30 rounded-xl">
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
                    className="h-10 text-sm font-bold bg-background/50 border-0 ring-1 ring-border/50 focus:ring-primary/50"
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
          items={workspaces.map((w) => w.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {workspaces.map((workspace) => (
              <SortableWorkspaceItem
                key={workspace.id}
                client={workspace}
                onRename={handleRename}
                onDelete={handleDelete}
                onColorChange={handleColorChange}
              />
            ))}

            {workspaces.length === 0 && (
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
    </div>
  );
};
