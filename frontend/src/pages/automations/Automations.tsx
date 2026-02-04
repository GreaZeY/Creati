import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { Zap, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link } from "react-router-dom";

export function Automations() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: "syncs", label: "Workflows" },
    { id: "announcements", label: "Announcers" },
  ];

  // Derive active tab from path
  const activeTab = location.pathname.includes("announcements")
    ? "announcements"
    : "syncs";

  const handleTabChange = (tabId: string) => {
    navigate(`/automations/${tabId}`);
  };

  return (
    <div className="space-y-8 pb-12">
      <SlidingTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        className="w-full md:w-[320px]"
      />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader
          title="Automations"
          description="Scale your reach without extra effort. One upload, infinite impact."
        />

        <div className="flex items-center gap-4">
          <Link to={`/automations/${activeTab}/new`}>
            <Button className="gap-2">
              <Plus size={18} />
              New {activeTab === "syncs" ? "Workflow" : "Announcer"}
            </Button>
          </Link>
        </div>
      </div>

      <div className="animate-in fade-in duration-500">
        <Outlet />
      </div>
    </div>
  );
}
