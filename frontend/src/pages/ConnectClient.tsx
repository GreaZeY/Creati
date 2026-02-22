import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  Linkedin,
  Youtube,
  Instagram,
  Twitter,
} from "lucide-react";
import { toast } from "../lib/events";

interface ClientContext {
  name: string;
  logo_url: string;
  color: string;
}

export const ConnectClient = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<ClientContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/agency/intake/${token}`,
        );
        const data = await res.json();
        if (data.success) {
          setClient(data.data);
        } else {
          setError(data.error || "Invalid or expired link");
        }
      } catch (err) {
        setError("Failed to load connection portal");
        toast.error("Network error");
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [token]);

  const handleConnect = (platform: string) => {
    // In a real flow, this would redirect to the platform OAuth
    // But we need to pass the intake token so the backend knows where to link the account
    // We'll use a special endpoint for intake-based OAuth
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/api/platforms/${platform}/connect?intake_token=${token}`;
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl max-w-md">
          <h1 className="text-2xl font-bold mb-4">Link Expired</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Please contact your agency to request a new secure connection link.
          </p>
        </div>
      </div>
    );

  const brandColor = client?.color || "#00f2ff";

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background Glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 pointer-events-none"
        style={{ backgroundColor: brandColor, top: "-10%", left: "-10%" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-12">
          {client?.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-16 mb-6 object-contain"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center text-3xl font-bold"
              style={{ backgroundColor: brandColor + "20", color: brandColor }}
            >
              {client?.name?.charAt(0)}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Connect your platforms to{" "}
            <span style={{ color: brandColor }}>{client?.name}</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-lg leading-relaxed">
            Your agency uses Creati to securely manage and optimize your social
            content. Connect your accounts below to enable automated publishing.
          </p>
        </div>

        <div className="space-y-4">
          <ConnectButton
            icon={<Youtube className="text-[#FF0000]" />}
            name="YouTube"
            onClick={() => handleConnect("youtube")}
          />
          <ConnectButton
            icon={<Linkedin className="text-[#0077b5]" />}
            name="LinkedIn"
            onClick={() => handleConnect("linkedin")}
          />
          <ConnectButton
            icon={<Instagram className="text-[#E4405F]" />}
            name="Instagram"
            onClick={() => handleConnect("instagram")}
          />
          <ConnectButton
            icon={<Twitter className="text-[#1DA1F2]" />}
            name="X / Twitter"
            onClick={() => handleConnect("twitter")}
          />
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-500" />
            <span>Secure OAuth Connection</span>
          </div>
          <div className="hidden sm:block">
            Powered by{" "}
            <span className="text-gray-300 font-medium tracking-wide">
              CREATI
            </span>
          </div>
        </div>
      </motion.div>

      {/* Security Disclaimer */}
      <p className="mt-8 text-gray-600 text-xs text-center max-w-md">
        We never see your password. You are authorizing access through the
        platform's official secure portal. You can revoke access at any time
        through your platform settings.
      </p>
    </div>
  );
};

const ConnectButton = ({
  icon,
  name,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full group flex items-center justify-between p-5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/20 rounded-2xl transition-all duration-300"
  >
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-xl font-medium">{name}</span>
    </div>
    <ArrowRight className="w-6 h-6 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
  </button>
);
