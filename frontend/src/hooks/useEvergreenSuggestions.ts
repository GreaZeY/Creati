import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useClient } from "@/context/ClientContext";

export interface SuggestedPost {
  id: number;
  videoId: number;
  title: string;
  platform: string;
  scheduledFor: string;
  recycleScore: number;
  status: string;
  createdAt: string;
}

export function useEvergreenSuggestions() {
  const { selectedClient } = useClient();
  const queryClient = useQueryClient();

  const queryKey = ["evergreen-suggestions", selectedClient?.id];

  const { data: suggestions = [], isLoading } = useQuery<SuggestedPost[]>({
    queryKey,
    queryFn: async () => {
      const params = selectedClient?.id
        ? `?clientId=${selectedClient.id}`
        : "";
      const res = await api.get(`/evergreen/suggestions${params}`);
      return res.data.data ?? [];
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/evergreen/suggestions/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/evergreen/suggestions/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    suggestions,
    isLoading,
    approve: (id: number) => approveMutation.mutate(id),
    dismiss: (id: number) => dismissMutation.mutate(id),
    isApproving: approveMutation.isPending,
    isDismissing: dismissMutation.isPending,
  };
}
