import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { platformsAPI, automationAPI } from "@/lib/api";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import { toast } from "@/lib/events";
import { useClient } from "@/context/ClientContext";
import { Check, ChevronRight, Zap } from "lucide-react";

interface NewRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewRuleModal: React.FC<NewRuleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { selectedClient } = useClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [sourcePlatform, setSourcePlatform] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);
  const [targetSelections, setTargetSelections] = useState<
    {
      accountId: number;
      platform: string;
      profileName: string;
      delaySeconds: number;
    }[]
  >([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPlatforms();
      setStep(1);
      setName("");
      setSourcePlatform("");
      setSourceAccountId(null);
      setTargetSelections([]);
    }
  }, [isOpen, selectedClient]);

  const fetchPlatforms = async () => {
    try {
      const response = await platformsAPI.list(selectedClient?.id);
      setPlatforms(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch platforms:", error);
    }
  };

  const toggleTarget = (platformAccount: any) => {
    const exists = targetSelections.find(
      (s) => s.accountId === platformAccount.id,
    );
    if (exists) {
      setTargetSelections(
        targetSelections.filter((s) => s.accountId !== platformAccount.id),
      );
    } else {
      setTargetSelections([
        ...targetSelections,
        {
          accountId: platformAccount.id,
          platform: platformAccount.platform,
          profileName: platformAccount.profileName,
          delaySeconds: 0,
        },
      ]);
    }
  };

  const handleCreate = async () => {
    if (!name || !sourcePlatform || targetSelections.length === 0) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await automationAPI.create(
        {
          action: "notify",
          name,
          sourceAccountId,
          triggerType: "new_upload",
          targets: targetSelections.map((s) => {
            return {
              accountId: s.accountId,
              targetPlatform: s.platform,
              delaySeconds: s.delaySeconds,
              titleTemplate: "New video: {{title}}",
              bodyTemplate: "Check out my new video! {{url}}",
            };
          }),
        },
        selectedClient?.id,
      );

      toast.success("Notification rule created! ✨");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create rule:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Notification Rule">
      <div className="space-y-6 py-4">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g., YouTube Upload Announcement"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>When I upload to...</Label>
              <div className="grid grid-cols-2 gap-3">
                {platforms
                  .filter((p) =>
                    ["youtube", "instagram", "tiktok"].includes(p.platform),
                  )
                  .map((p) => (
                    <button
                      key={p.platform + p.id}
                      onClick={() => {
                        setSourcePlatform(p.platform);
                        setSourceAccountId(Number(p.id));
                      }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        sourceAccountId === Number(p.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border/80 bg-background"
                      }`}
                    >
                      <PlatformLogo platform={p.platform} size={20} />
                      <span className="font-medium capitalize">
                        {p.platform}
                      </span>
                      {sourceAccountId === Number(p.id) && (
                        <Check className="ml-auto w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
              </div>
            </div>
            <Button
              className="w-full h-12 text-lg"
              disabled={!name || !sourceAccountId}
              onClick={() => setStep(2)}
            >
              Continue <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <Label>Announce it on...</Label>
              <div className="grid grid-cols-2 gap-3">
                {platforms
                  .filter((p) => Number(p.id) !== sourceAccountId)
                  .map((p) => (
                    <button
                      key={p.platform + p.id}
                      onClick={() => toggleTarget(p)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        targetSelections.some((s) => s.accountId === p.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border/80 bg-background"
                      }`}
                    >
                      <PlatformLogo platform={p.platform} size={20} />
                      <div className="text-left">
                        <span className="block font-medium capitalize">
                          {p.platform}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          @{p.handle || p.profileName}
                        </span>
                      </div>
                      {targetSelections.some((s) => s.accountId === p.id) && (
                        <Check className="ml-auto w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                className="flex-[2] h-12 text-lg gap-2"
                disabled={targetSelections.length === 0 || loading}
                onClick={handleCreate}
              >
                {loading ? (
                  "Creating..."
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-current" />
                    Launch Rule
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
