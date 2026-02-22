import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Link2, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/events";

interface ApprovalLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

export function ApprovalLinkModal({
  isOpen,
  onClose,
  url,
}: ApprovalLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ready for Approval">
      <div className="p-8 space-y-6 max-w-md">
        <div className="w-16 h-16 rounded-[2rem] bg-neon-purple/20 flex items-center justify-center text-neon-purple border border-neon-purple/30 shadow-glow-purple mx-auto">
          <Link2 size={32} />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase italic tracking-tight">
            Magic Link Generated
          </h3>
          <p className="text-sm text-slate-500 dark:text-muted-foreground leading-relaxed">
            Send this link to your client. They can review and approve the
            content without needing to log in.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-black/40 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex items-center gap-3 group">
          <div className="flex-1 text-xs font-mono text-slate-400 dark:text-muted-foreground/60 truncate">
            {url}
          </div>
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-neon-purple/10 text-neon-purple transition-all"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl h-12 border-primary/20 hover:border-primary/40 bg-primary/5 gap-2"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLink size={16} />
            Preview Portal
          </Button>
          <Button className="flex-1 rounded-xl h-12 gap-2" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy Link"}
          </Button>
        </div>

        <p className="text-[10px] text-center font-black uppercase tracking-[0.2em] text-slate-400 dark:text-muted-foreground/40 pt-4 border-t border-slate-100 dark:border-white/5">
          Link expires in 72 hours
        </p>
      </div>
    </Modal>
  );
}
