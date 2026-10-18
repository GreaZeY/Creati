import { useEffect, useRef, useState, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { livePreferences, newLiveEvent, type liveAPI, type LiveEventSettings } from "@/lib/youtubeLive";

export function useLivePreferences(client: ReturnType<typeof liveAPI>, scope: string, recovery?: LiveEventSettings) {
  const queryClient = useQueryClient();
  const queryKey = ["youtube-live-preferences", scope];
  const preferences = useQuery({ queryKey, queryFn: async () => (await client.preferences()).data.data });
  const [overrides, setOverrides] = useState<Partial<LiveEventSettings>>(recovery || {});
  const [queued, setQueued] = useState(false);
  const defaults = newLiveEvent(preferences.data ? { ...preferences.data, timeZone: preferences.data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone } : undefined);
  const event = { ...defaults, ...overrides };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<LiveEventSettings | undefined>(undefined);
  const mutation = useMutation({
    scope: { id: `live-preferences:${scope}` },
    mutationFn: async (value: LiveEventSettings) => (await client.savePreferences(livePreferences(value))).data.data,
    onSuccess: value => { queryClient.setQueryData(queryKey, value); },
  });
  const mutate = mutation.mutate;
  function setEvent(value: SetStateAction<LiveEventSettings>) {
    setOverrides(current => typeof value === "function" ? value({ ...defaults, ...current }) : value);
  }
  function remember(value: LiveEventSettings) {
    setQueued(true);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { pending.current = undefined; setQueued(false); mutation.mutate(value); }, 600);
  }
  async function flush(value?: LiveEventSettings) {
    setQueued(false);
    clearTimeout(timer.current);
    const next = value || pending.current;
    pending.current = undefined;
    if (next) await mutation.mutateAsync(next);
  }
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (pending.current) mutate(pending.current);
  }, [mutate]);
  return { event, setEvent, remember, flush, reset: () => setOverrides({}), defaults, loading: preferences.isPending, error: preferences.isError || mutation.isError, saving: queued || mutation.isPending, retry: async () => { if (preferences.isError) await preferences.refetch(); else await flush(event); } };
}
