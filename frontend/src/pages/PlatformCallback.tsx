import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PlatformLogo } from "@/components/platforms/PlatformLogo";
import confetti from "canvas-confetti";
import { useMutation } from "@tanstack/react-query";
import { platformsAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

export const PlatformCallback = () => {
  const [searchParams] = useSearchParams();
  const { platform } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get parameters from URL (Callback from Provider)
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescParam = searchParams.get("error_description");

  // Legacy support (optional, but good to have if redirects are mixed)
  const statusParam = searchParams.get("status");
  const messageParam = searchParams.get("message");

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      // Wait a moment to show "Initiating" state (UX)
      await new Promise((r) => setTimeout(r, 800));

      if (!code || !platform) throw new Error("Missing code or platform info");

      // Call backend to exchange code for token
      await platformsAPI.exchange(platform, code, state || "");
    },
    onSuccess: () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
    },
    onError: (e: any) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      console.error("Error exchanging code for token", e);
      setError(e?.message || "Secure exchange failed. Please try again.");
    },
  });

  const isSuccess = progress >= 100 || statusParam === "success";
  const isError =
    exchangeMutation.isError || !!error || statusParam === "error";
  const errorMessage =
    error || exchangeMutation.error?.message || messageParam || "Unknown error";

  console.error(exchangeMutation.isSuccess, exchangeMutation.isError);
  useEffect(() => {
    // Check for immediate URL errors on mount
    if (errorParam || errorDescParam) {
      setError(errorDescParam || errorParam);
      return;
    }

    if (!code && !statusParam) {
      setError("Uplink denied: No authorization code received from provider.");
      return;
    }

    // If we have code and haven't run, start exchange
    if (code && platform && !hasRun.current && !statusParam) {
      hasRun.current = true;

      // Fake progress animation while request is pending
      let p = 5;
      setProgress(p);

      intervalRef.current = setInterval(() => {
        p += (90 - p) * 0.1;
        setProgress(p);
      }, 200);

      exchangeMutation.mutate();

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else if (statusParam === "success") {
      setProgress(100);
    }
  }, [
    code,
    platform,
    statusParam,
    errorParam,
    errorDescParam,
    exchangeMutation,
  ]);

  useEffect(() => {
    if (isSuccess && progress >= 99) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#08cea8", "#ffffff"],
      });

      const redirectTimer = setTimeout(() => {
        navigate("/platforms/connect");
      }, 2500);
      return () => clearTimeout(redirectTimer);
    }
  }, [isSuccess, progress, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="p-8 border-white/5 bg-card/50 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Dynamic Icon State */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {!isSuccess && !isError ? (
                  <motion.div
                    key="loading"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center relative"
                  >
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-3xl" />
                    <motion.div
                      className="absolute inset-0 border-4 border-primary rounded-3xl border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                    {platform ? (
                      <PlatformLogo platform={platform} size={32} />
                    ) : (
                      <Loader2 className="w-8 h-8 text-primary animate-pulse" />
                    )}
                  </motion.div>
                ) : isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/30"
                  >
                    <CheckCheck className="w-10 h-10" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="error"
                    initial={{ scale: 0.8, opacity: 0, rotate: 10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    className="w-20 h-20 rounded-3xl bg-destructive/20 text-destructive flex items-center justify-center shadow-lg shadow-destructive/20 ring-1 ring-destructive/30"
                  >
                    <XCircle className="w-10 h-10" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Text Content */}
            <div className="space-y-2 max-w-[280px]">
              <h2 className="text-2xl font-black tracking-tight">
                {isSuccess
                  ? "Code Exchanged"
                  : isError
                    ? "Code Exchange Failed"
                    : "Exchanging Code..."}
              </h2>
              <p
                className={cn(
                  "text-muted-foreground font-medium text-sm leading-relaxed break-words",
                  isSuccess
                    ? "text-emerald-500"
                    : isError
                      ? "text-destructive"
                      : "",
                )}
              >
                {!isSuccess && !isError
                  ? `Exchanging cryptographic keys with ${platform || "platform"}...`
                  : isSuccess
                    ? `Successfully established connection with ${platform}. Redirecting...`
                    : errorMessage}
              </p>
            </div>

            {/* Progress Bar (Only visible while loading) */}
            {!isSuccess && !isError && (
              <div className="w-full h-1.5 bg-secondary/50 rounded-full overflow-hidden mt-2">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.2 }}
                />
              </div>
            )}

            {/* Manual Action Buttons (Only if error or done) */}
            {isError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-2 w-full space-y-3"
              >
                <Button
                  onClick={() => navigate("/platforms/connect")}
                  className="w-full h-12 rounded-xl font-bold gap-2"
                  variant="secondary"
                >
                  <ArrowRight size={16} className="rotate-180" />
                  Try Again
                </Button>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full h-12 rounded-xl font-bold gap-2 bg-white/5 hover:bg-white/10 border-white/5"
                  variant="outline"
                >
                  Go to Home
                </Button>
              </motion.div>
            )}
          </div>
        </Card>

        {/* Decorative footer */}
        {/* <p className="text-center text-[10px] text-muted-foreground/40 mt-8 font-mono uppercase tracking-widest">
          Secured by Automata Protocol v2.4
        </p> */}
      </motion.div>
    </div>
  );
};
