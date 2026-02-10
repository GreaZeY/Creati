import { useQuery } from "@tanstack/react-query";
import { platformsAPI } from "@/lib/api";
import { useClient } from "@/context/ClientContext";

export interface PlatformAccount {
  id: string;
  accountId: number;
  name: string;
  platform: string;
  handle?: string;
  profileName?: string;
  connected: boolean;
  status: string;
}

export function usePlatforms() {
  const { selectedClient } = useClient();

  const query = useQuery({
    queryKey: ["platforms", selectedClient?.id],
    queryFn: async () => {
      const resp = await platformsAPI.list(selectedClient?.id);
      return (resp.data.data || []) as PlatformAccount[];
    },
    select: (data) => {
      const connectedAccounts = data.filter((a) => a.connected);
      const platformOptions = connectedAccounts.map((acc) => ({
        id: acc.accountId.toString(),
        name: acc.platform,
        handle: acc.profileName || acc.handle,
        connected: true,
      }));

      // For PostComposer specifically (all accounts mapped to unified format)
      const allOptions = data.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        accountId: p.accountId,
        handle: p.handle,
      }));

      return {
        allAccounts: data,
        connectedAccounts,
        platformOptions,
        allOptions,
      };
    },
  });

  return {
    ...query,
    platforms: query.data?.allOptions || [],
    connectedAccounts: query.data?.connectedAccounts || [],
    platformOptions: query.data?.platformOptions || [],
    allAccounts: query.data?.allAccounts || [],
  };
}
