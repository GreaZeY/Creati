import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useClient } from "@/context/ClientContext";
import { toast } from "@/lib/events";

export interface Invoice {
  id: number;
  clientId: number;
  clientName: string;
  clientColor: string;
  title: string;
  description: string;
  amountPaise: number;
  currency: string;
  razorpayPaymentLinkId: string;
  razorpayPaymentLinkUrl: string;
  status: "draft" | "sent" | "paid" | "expired" | "cancelled";
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface CreateInvoicePayload {
  clientId: number;
  title: string;
  description: string;
  amountPaise: number;
  dueDate?: string;
}

export function useInvoices() {
  const { selectedClient } = useClient();
  const queryClient = useQueryClient();
  const queryKey = ["invoices", selectedClient?.id];

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey,
    queryFn: async () => {
      const params = selectedClient?.id ? `?clientId=${selectedClient.id}` : "";
      const res = await api.get(`/invoices${params}`);
      return res.data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) =>
      api.post("/invoices", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Invoice created and payment link sent!");
    },
    onError: () => toast.error("Failed to create invoice"),
  });

  return {
    invoices,
    isLoading,
    create: (payload: CreateInvoicePayload) => createMutation.mutate(payload),
    isCreating: createMutation.isPending,
  };
}
