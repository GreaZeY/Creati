import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link } from "react-router-dom";
import { AutomationsList } from "./AutomationsList";

export function Automations() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader
          title="Automations"
          description="Scale your reach without extra effort. One upload, infinite impact."
        />

        <div className="flex items-center gap-4">
          <Link to={`/automations/new`}>
            <Button className="gap-2">
              <Plus size={18} />
              New Automation
            </Button>
          </Link>
        </div>
      </div>

      <div className="animate-in fade-in duration-500">
        <AutomationsList />
      </div>
    </div>
  );
}
