import { useState } from "react";
import { motion } from "framer-motion";
import { User, Camera, Save, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/hooks/useAuth";
import { authAPI } from "@/lib/api";
import { toast } from "@/lib/events";

export const ProfileManager = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await authAPI.updateProfile({
        firstName,
        lastName,
        name,
        picture_url: user?.picture_url || "",
      });
      setSuccess(true);
      toast.success("Profile updated! 🚀");
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <Card className="p-8 border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl rounded-3xl ring-1 ring-border shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          {/* Avatar Section */}
          <div className="relative group">
            <div className="w-32 h-32 rounded-3xl overflow-hidden ring-4 ring-background shadow-2xl bg-secondary/30 flex items-center justify-center relative">
              {user?.picture_url ? (
                <img
                  src={user.picture_url}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                  First Name
                </Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="bg-secondary/20 border-border/50 focus:ring-primary/30 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                  Last Name
                </Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="bg-secondary/20 border-border/50 focus:ring-primary/30 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                Display Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="bg-secondary/20 border-border/50 focus:ring-primary/30 rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground ml-1 italic font-medium">
                This is how your name will appear across the platform.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                Email Address
              </Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-secondary/10 border-border/30 rounded-xl opacity-60 cursor-not-allowed"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="rounded-xl h-12 px-8 font-bold gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Updated
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {loading ? "Saving..." : "Save Changes"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Tips Card */}
      <Card className="p-6 border-0 bg-primary/[0.03] ring-1 ring-primary/10 rounded-2xl">
        <div className="flex gap-4">
          <div className="p-2 h-fit rounded-lg bg-primary/10">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Complete your profile
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Adding your real name and a professional profile picture helps
              build trust when interacting with teams and clients within your
              workspaces.
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
