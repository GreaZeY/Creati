import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link } from "react-router-dom";
import { AutomationsList } from "./AutomationsList";

export function Automations() {
  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4 px-24">
        <PageHeader
          title="Automations"
          description="Scale your reach without extra effort. One upload, infinite impact."
        />

        <div className="flex items-center gap-4">
          <Link to="new">
            <Button className="gap-2">
              <Plus size={18} />
              New Automation
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 animate-in fade-in duration-500">
        <AutomationsList />
      </div>
    </div>
  );
}
