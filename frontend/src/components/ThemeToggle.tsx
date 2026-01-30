import { Switch } from "@/components/ui/Switch";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
        className="data-[state=checked]:bg-primary"
        thumbIconChecked={<Moon className="h-4 w-4 text-foreground" />}
        thumbIconUnchecked={<Sun className="h-4 w-4 text-yellow-500" />}
      />
    </div>
  );
}
