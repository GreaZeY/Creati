import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/events";
import { paymentsAPI } from "@/lib/api";
import { PLANS } from "@/lib/features";
import { motion } from "framer-motion";

// Load Razorpay script dynamically
const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function Pricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const resp = await paymentsAPI.getSubscription();
      return resp.data.data;
    },
  });

  useEffect(() => {
    loadRazorpay();
  }, []);

  const cancelMutation = useMutation({
    mutationFn: () => paymentsAPI.cancelSubscription(),
    onSuccess: () => {
      toast.success(
        "Auto-renewal turned off. You'll keep access until your period ends! 👋",
      );
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      setShowCancelDialog(false);
    },
    onError: () => {
      toast.error("Failed to cancel subscription. Try again?");
    },
  });

  const handleSubscription = async (planId: string) => {
    try {
      // Case 1: New Subscription (currently on Free)
      if (currentPlan === "free") {
        const resp = await paymentsAPI.createSubscription(planId, billingCycle);
        const data = resp.data.data;

        const options = {
          key: data.key,
          subscription_id: data.subscriptionId,
          name: "Creati",
          description: "Upgrade your creator game",
          handler: async (response: any) => {
            try {
              await paymentsAPI.verifySubscription({
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: planId,
                billingCycle: billingCycle,
              });
              toast.success("Welcome to the big leagues! 🚀");
              queryClient.invalidateQueries({ queryKey: ["subscription"] });
            } catch (error) {
              toast.error("Payment verification failed. That's sus.");
            }
          },
          theme: {
            color: "#08cea8",
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Case 2: Upgrade / Downgrade
        // Ideally show a confirmation modal, but for now we proceed directly
        try {
          await paymentsAPI.updateSubscription(planId, billingCycle);
          toast.success(
            "Plan updated successfully! The changes are pro-rated.",
          );
          queryClient.invalidateQueries({ queryKey: ["subscription"] });
        } catch (error) {
          toast.error("Failed to update plan.");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not start checkout. Valid API keys?");
    }
  };

  if (isLoading)
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 space-y-12">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <div className="flex justify-center mt-8">
            <Skeleton className="h-8 w-48 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-border bg-secondary/50 dark:bg-card/50 h-[500px] flex flex-col"
            >
              <Skeleton className="h-6 w-1/3 mb-4" />
              <Skeleton className="h-4 w-2/3 mb-8" />
              <Skeleton className="h-10 w-1/2 mb-8" />
              <div className="space-y-4 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-11 w-full mt-8 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );

  const currentPlan = subscription?.plan || "free";
  const isCancelled = subscription?.status === "cancelled";
  const periodEnd = subscription?.currentPeriodEnd;

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          Post once. Publish everywhere. Skip the busywork.
        </h1>
        <p className="text-lg text-muted-foreground">
          Stop juggling uploads. automation is the new clout.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mt-8 gap-4">
          <span
            className={cn(
              "text-sm font-bold",
              billingCycle === "monthly"
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            Monthly
          </span>
          <button
            onClick={() =>
              setBillingCycle((prev) =>
                prev === "monthly" ? "yearly" : "monthly",
              )
            }
            className="w-14 h-7 rounded-full bg-muted relative transition-colors focus:outline-none ring-offset-2 focus:ring-2 ring-primary"
          >
            <motion.div
              className="w-5 h-5 rounded-full bg-primary absolute top-1 left-1"
              animate={{ x: billingCycle === "yearly" ? 28 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span
            className={cn(
              "text-sm font-bold",
              billingCycle === "yearly"
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            Yearly{" "}
            <span className="text-xs ml-1 text-emerald-500 font-normal">
              (Save ~20%)
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* FREE PLAN */}
        {/* <Card className={cn("p-8 rounded-3xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-2 duration-300", currentPlan === 'free' ? "border-primary/50 bg-primary/5" : "bg-card/50 border-input")}>
                    <div className="mb-8">
                        <h3 className="text-2xl font-bold">Free</h3>
                        <p className="text-muted-foreground mt-2">Try it. See what works.</p>
                        <div className="mt-6 flex items-baseline gap-1">
                            <span className="text-4xl font-black">₹0</span>
                            <span className="text-muted-foreground">/mo</span>
                        </div>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-sm"><Check className="text-primary w-5 h-5 flex-shrink-0" /> 3 Connected Accounts</li>
                        <li className="flex items-center gap-3 text-sm"><Check className="text-primary w-5 h-5 flex-shrink-0" /> 5 Uploads / Month</li>
                        <li className="flex items-center gap-3 text-sm opacity-50"><X className="w-5 h-5 flex-shrink-0" />Limited Workflows</li>
                        <li className="flex items-center gap-3 text-sm opacity-50"><X className="w-5 h-5 flex-shrink-0" /> Advanced Analytics</li>
                    </ul>
                    <Button
                        disabled={currentPlan === 'free'}
                        variant={currentPlan === 'free' ? "secondary" : "default"}
                        className="w-full rounded-xl py-6 font-bold"
                    >
                        {currentPlan === 'free' ? "Current Plan" : "Downgrade"}
                    </Button>
                </Card> */}

        {/* CREATOR PLAN */}
        <Card
          className={cn(
            "p-5 rounded-2xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-2 duration-300 ring-1",
            currentPlan === "creator"
              ? "ring-primary border-primary bg-primary/10"
              : "bg-white dark:bg-card border-border dark:border-input ring-border/50",
          )}
        >
          {currentPlan === "creator" && !isCancelled && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl z-20">
              ACTIVE
            </div>
          )}
          {currentPlan === "creator" && isCancelled && (
            <div className="absolute top-0 right-0 bg-amber-500/90 text-background text-xs font-bold px-3 py-1 rounded-bl-xl z-20">
              CANCELLED
            </div>
          )}
          <div className="mb-6 relative z-10">
            <h3 className="text-lg font-bold text-primary">Creator</h3>
            <p className="text-sm text-muted-foreground mt-1">
              The everyday creator pack.
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-black">
                ₹{billingCycle === "monthly" ? "499" : "4,999"}
              </span>
              <span className="text-muted-foreground">
                /{billingCycle === "monthly" ? "mo" : "yr"}
              </span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none"></div>
          <ul className="space-y-3 mb-6 flex-1 relative z-10">
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-primary w-4 h-4 flex-shrink-0" /> 10
              Connected Accounts
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-primary w-4 h-4 flex-shrink-0" /> Unlimited
              Uploads
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-primary w-4 h-4 flex-shrink-0" /> Workflows
            </li>
            <li className="flex items-center gap-3 text-sm opacity-50">
              <X className="w-4 h-4 flex-shrink-0" /> Advanced Analytics
            </li>
          </ul>
          <Button
            onClick={() => handleSubscription(PLANS.CREATOR)}
            disabled={currentPlan === "creator" && !isCancelled}
            className="w-full h-11 rounded-xl font-bold shadow-lg shadow-primary/25"
          >
            {currentPlan === "creator" && isCancelled
              ? "Enable Auto-Pay Again"
              : currentPlan === "creator"
                ? "Current Plan"
                : currentPlan === "pro"
                  ? "Downgrade to Creator"
                  : "Get Creator"}
          </Button>
        </Card>

        {/* PRO PLAN */}
        <Card
          className={cn(
            "p-5 rounded-2xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-2 duration-300",
            currentPlan === "pro"
              ? "border-purple-500/50 bg-purple-500/5"
              : "bg-white/50 dark:bg-card/50 border-border dark:border-input",
          )}
        >
          {currentPlan === "pro" && !isCancelled && (
            <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              ACTIVE
            </div>
          )}
          {currentPlan === "pro" && isCancelled && (
            <div className="absolute top-0 right-0 bg-amber-500/90 text-background text-xs font-bold px-3 py-1 rounded-bl-xl">
              CANCELLED
            </div>
          )}
          <div className="mb-6">
            <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Pro
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Build your brand like a pro.
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-black">
                ₹{billingCycle === "monthly" ? "1,299" : "11,999"}
              </span>
              <span className="text-muted-foreground">
                /{billingCycle === "monthly" ? "mo" : "yr"}
              </span>
            </div>
          </div>
          <ul className="space-y-3 mb-6 flex-1">
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-purple-400 w-4 h-4 flex-shrink-0" />{" "}
              Unlimited Accounts
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-purple-400 w-4 h-4 flex-shrink-0" />{" "}
              Unlimited Uploads
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-purple-400 w-4 h-4 flex-shrink-0" />{" "}
              Workflows
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="text-purple-400 w-4 h-4 flex-shrink-0" />{" "}
              Advanced Analytics & AI
            </li>
          </ul>
          <Button
            onClick={() => handleSubscription(PLANS.PRO)}
            disabled={currentPlan === "pro" && !isCancelled}
            variant="ghost"
            className="w-full h-11 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/25"
          >
            {currentPlan === "pro" && isCancelled
              ? "Enable Auto-Pay Again"
              : currentPlan === "pro"
                ? "Current Plan"
                : currentPlan === "creator"
                  ? "Upgrade to Pro"
                  : "Go Pro 🚀"}
          </Button>
        </Card>
      </div>

      {isCancelled && periodEnd && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/20">
              <svg
                className="w-6 h-6 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-amber-500 mb-1">
                Subscription Cancelled - Auto-Renewal Disabled
              </h4>
              <p className="text-sm text-muted-foreground">
                You'll keep access to all premium features until{" "}
                <span className="font-bold text-foreground">
                  {new Date(periodEnd).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                . Want to keep your perks? Click "Enable Auto-Pay Again" on your
                plan card above.
              </p>
            </div>
          </div>
        </div>
      )}

      {(currentPlan === "creator" || currentPlan === "pro") && !isCancelled && (
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="h-[1px] bg-border/30" />
          <div className="pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Need to turn off auto-renewal?
            </p>
            <Button
              onClick={() => setShowCancelDialog(true)}
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Turn Off Auto-Renewal
            </Button>
          </div>
        </div>
      )}

      <div className="bg-secondary/30 rounded-2xl p-4 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
        <p>Secured payments via Payment Gateway. Cancel anytime, no beef. ✨</p>
      </div>

      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => {
          if (!cancelMutation.isPending) {
            cancelMutation.mutate();
          }
        }}
        onConfirm={() => setShowCancelDialog(false)}
        title="Turn off Auto-Renewal?"
        description="You'll keep all premium features until your billing period ends. No more charges after that. You can resubscribe anytime! 💙"
        confirmText="Keep My Plan"
        cancelText="Turn Off Renewal"
        variant="info"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
