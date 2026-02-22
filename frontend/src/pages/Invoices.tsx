import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  FileText,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  DollarSign,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { LensedCard } from "@/components/ui/LensedCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useInvoices, type CreateInvoicePayload } from "@/hooks/useInvoices";
import { useQuery } from "@tanstack/react-query";
import { agencyAPI } from "@/lib/api";

// ─── Status Chip ─────────────────────────────────────────────────────────────

const statusConfig = {
  paid: {
    icon: CheckCircle2,
    label: "Paid",
    class: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  sent: {
    icon: Send,
    label: "Sent",
    class: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  },
  draft: {
    icon: FileText,
    label: "Draft",
    class: "text-muted-foreground bg-secondary/30 border-border",
  },
  expired: {
    icon: Clock,
    label: "Expired",
    class: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    class: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  },
} as const;

function StatusChip({ status }: { status: string }) {
  const config =
    statusConfig[status as keyof typeof statusConfig] ?? statusConfig.draft;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest",
        config.class,
      )}
    >
      <Icon size={10} />
      {config.label}
    </span>
  );
}

// ─── Create Invoice Modal ─────────────────────────────────────────────────────

interface CreateModalProps {
  clients: { id: number; name: string }[];
  onClose: () => void;
  onSubmit: (payload: CreateInvoicePayload) => void;
  isLoading: boolean;
}

function CreateInvoiceModal({
  clients,
  onClose,
  onSubmit,
  isLoading,
}: CreateModalProps) {
  const [form, setForm] = useState<CreateInvoicePayload>({
    clientId: clients[0]?.id ?? 0,
    title: "",
    description: "",
    amountPaise: 0,
    dueDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, amountPaise: Math.round(form.amountPaise * 100) });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-[2rem] p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">
              Razorpay Invoice
            </p>
            <h2 className="text-xl font-black tracking-tight">
              Create Invoice
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
              Client
            </label>
            <select
              value={form.clientId}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientId: Number(e.target.value) }))
              }
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
              Title
            </label>
            <input
              type="text"
              placeholder="Monthly Social Media Management"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="5000"
                value={form.amountPaise || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    amountPaise: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 pl-7 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
              Due Date (optional)
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDate: e.target.value }))
              }
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">
              Note (optional)
            </label>
            <textarea
              placeholder="Services for February 2026..."
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl h-12 font-black"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create & Send Payment Link"}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const Invoices = () => {
  const { invoices, isLoading, create, isCreating } = useInvoices();
  const [showCreate, setShowCreate] = useState(false);

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await agencyAPI.listClients();
      return res.data.data ?? [];
    },
  });
  const clients: { id: number; name: string }[] = clientsData ?? [];

  const totalRevenue =
    invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amountPaise, 0) / 100;

  const outstanding =
    invoices
      .filter((i) => i.status === "sent")
      .reduce((sum, i) => sum + i.amountPaise, 0) / 100;

  return (
    <div className="h-full flex flex-col space-y-6 pb-12 max-w-7xl mx-auto px-8 w-full">
      <PageHeader
        title="Client Invoicing"
        description="Generate and track Razorpay payment links for your clients."
      >
        <Button
          onClick={() => setShowCreate(true)}
          className="rounded-xl h-10 px-5 font-black"
          disabled={clients.length === 0}
        >
          <Plus size={14} className="mr-2" />
          New Invoice
        </Button>
      </PageHeader>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            label: "Total Collected",
            value: `₹${totalRevenue.toLocaleString("en-IN")}`,
            icon: DollarSign,
            color: "text-emerald-400",
          },
          {
            label: "Outstanding",
            value: `₹${outstanding.toLocaleString("en-IN")}`,
            icon: Clock,
            color: "text-amber-400",
          },
          {
            label: "Total Invoices",
            value: invoices.length.toString(),
            icon: FileText,
            color: "text-primary",
          },
        ].map((stat) => (
          <LensedCard key={stat.label} className="p-5 flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl bg-secondary/30", stat.color)}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-xl font-black tracking-tight">{stat.value}</p>
            </div>
          </LensedCard>
        ))}
      </div>

      {/* Invoice list */}
      <LensedCard className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-3xl bg-secondary/30 flex items-center justify-center mb-4">
              <FileText size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest mb-2">
              No Invoices Yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Create your first invoice to generate a Razorpay payment link for
              your client.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {invoices.map((inv) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/10 transition-colors group"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black shrink-0"
                  style={{ backgroundColor: inv.clientColor || "#7c3aed" }}
                >
                  {inv.clientName.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate">{inv.title}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {inv.clientName}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-black">
                    ₹{(inv.amountPaise / 100).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {format(new Date(inv.createdAt), "dd MMM yyyy")}
                  </p>
                </div>

                <StatusChip status={inv.status} />

                {inv.razorpayPaymentLinkUrl && (
                  <a
                    href={inv.razorpayPaymentLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                    aria-label="Open payment link"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </LensedCard>

      <AnimatePresence>
        {showCreate && (
          <CreateInvoiceModal
            clients={clients}
            onClose={() => setShowCreate(false)}
            onSubmit={(payload) => {
              create(payload);
              setShowCreate(false);
            }}
            isLoading={isCreating}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
