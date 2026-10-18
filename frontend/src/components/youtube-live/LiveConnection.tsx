import { Link } from "react-router-dom";
import { Check, Youtube } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePlatforms } from "@/hooks/usePlatforms";

export function LiveConnection({ accountId, disabled, connecting, onConnect }: { accountId: number; disabled: boolean; connecting: boolean; onConnect: () => void }) {
  const { connectedAccounts, isPending: platformsLoading, isError: platformsError, refetch: reloadPlatforms, isFetching: platformsFetching } = usePlatforms();
  const channels = connectedAccounts.filter(account => account.platform === "youtube");
  const selectedAccount = channels.find(account => account.accountId === accountId);
  const needsReconnect = selectedAccount?.status === "action_required";
  const channelName = selectedAccount?.profileName || selectedAccount?.handle || selectedAccount?.name;
  const mutedClass = "text-xs leading-relaxed text-muted-foreground";
  return (
    <>{platformsLoading ? <p role="status" className={mutedClass}>Checking YouTube connection…</p> : platformsError ? (
      <div className="flex flex-wrap items-center gap-3"><p role="status" className={mutedClass}>Could not check your YouTube connection.</p><Button size="sm" variant="outline" disabled={disabled || platformsFetching} onClick={() => void reloadPlatforms()}>Retry connection check</Button></div>
    ) : channels.length > 0 && !needsReconnect ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="flex min-w-0 items-center gap-2 text-xs"><Check size={15} className="shrink-0 text-primary" /><span className="break-words">{channelName ? `YouTube connected · ${channelName}` : `${channels.length} YouTube channels connected`}</span></p>
        <Button size="sm" variant="ghost" asChild><Link to="/platforms">Manage channels</Link></Button>
      </div>
    ) : (
      <div className="space-y-2">
        {needsReconnect && <p role="status" className={mutedClass}>{channelName} needs to be reconnected.</p>}
        <Button size="sm" variant="outline" disabled={disabled} isLoading={connecting} loadingText="Connecting…" onClick={onConnect}><Youtube size={15} />{needsReconnect ? "Reconnect YouTube" : "Connect YouTube Live"}</Button>
      </div>
    )}</>
  );
}
