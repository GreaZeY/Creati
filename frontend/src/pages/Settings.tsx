import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import {
  User,
  Bell,
  Lock,
  ChevronRight,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract active section from path: /settings/workspaces -> workspaces
  const pathParts = location.pathname.split("/").filter(Boolean);
  const activeSection = pathParts.length > 1 ? pathParts[1] : null;

  const sections = [
    {
      id: "profile",
      label: "Profile",
      icon: User,
      desc: "Manage your public name and avatar.",
    },
    {
      id: "workspaces",
      label: "Workspaces",
      icon: Briefcase,
      desc: "Manage, rename, and organize your workspace hub.",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      desc: "Configure when and how you receive updates.",
    },
    {
      id: "security",
      label: "Security",
      icon: Lock,
      desc: "Update your password and 2FA settings.",
    },
  ];

  const activeSectionData = activeSection
    ? sections.find((s) => s.id === activeSection)
    : null;

  return (
    <div className="mx-10 w-xl space-y-6 pb-8">
      <div className="flex items-center gap-4">
        {activeSection && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <PageHeader
          description={
            activeSectionData
              ? activeSectionData.desc
              : "Manage your account preferences and application configuration."
          }
        />
      </div>

      <Outlet />
    </div>
  );
};

export const SettingsMain = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: "profile",
      label: "Profile",
      icon: User,
      desc: "Manage your public name and avatar.",
    },
    {
      id: "workspaces",
      label: "Workspaces",
      icon: Briefcase,
      desc: "Manage, rename, and organize your workspace hub.",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      desc: "Configure when and how you receive updates.",
    },
    {
      id: "security",
      label: "Security",
      icon: Lock,
      desc: "Update your password and 2FA settings.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {sections.map((section, i) => (
        <motion.div
          key={section.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: i * 0.05,
            type: "spring",
            stiffness: 100,
          }}
        >
          <Card
            onClick={() => navigate(`/settings/${section.id}`)}
            className="p-4 flex items-center justify-between border-0 bg-card/40 backdrop-blur-xl hover:bg-card/60 transition-all cursor-pointer group rounded-xl ring-1 ring-border hover:ring-primary/30 shadow-lg relative overflow-hidden"
          >
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/5 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/10 transition-all duration-500 ring-1 ring-border/50 group-hover:rotate-6">
                <section.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <h3 className="font-bold text-base tracking-tight group-hover:text-primary transition-colors">
                  {section.label}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {section.desc}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-foreground transition-all group-hover:translate-x-1 relative z-10" />
          </Card>
        </motion.div>
      ))}

      <div className="pt-6 mt-3 border-t border-border">
        <Card className="p-4 border-0 bg-destructive/5 backdrop-blur-xl rounded-xl ring-1 ring-destructive/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-destructive/[0.02] group-hover:bg-destructive/[0.05] transition-colors duration-700" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-destructive tracking-tight">
                Danger Zone
              </h3>
              <p className="text-sm text-muted-foreground font-medium">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button
              variant="destructive"
              className="rounded-lg h-9 px-5 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-destructive/20 hover:scale-105 active:scale-95 transition-all"
            >
              Delete Account
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

export const SettingsSectionPlaceholder = () => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pt-4"
    >
      <div className="p-16 text-center opacity-40">
        <p className="font-black uppercase tracking-widest text-[10px]">
          Section Under Construction
        </p>
        <p className="text-xs font-medium mt-2">
          We're working on making this setting available soon.
        </p>
      </div>
    </motion.div>
  );
};
