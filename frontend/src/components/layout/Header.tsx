import { ThemeToggle } from "../ThemeToggle";
import { Breadcrumbs } from "./Breadcrumbs";
import { CreditIndicator } from "../composer/CreditIndicator";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

export function Header() {
  return (
    <header className="h-[3.5rem] flex items-center justify-between px-8 z-10 sticky top-0 bg-transparent font-sans">
      <div className="flex items-center gap-6">
        <WorkspaceSwitcher />
        <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden md:block" />
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-4">
          <CreditIndicator />
          <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
          <ThemeToggle />
        </div>

        <div className="relative w-8 aspect-square rounded-full overflow-hidden ring-2 ring-neon-purple ring-offset-2 ring-offset-white dark:ring-offset-midnight shadow-glow-purple group cursor-pointer hover:scale-105 transition-all">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrRDGLkZjh7VvZ0Kda0Meni_8Dh70VBttDYZjftO8Qn4AqXupdWf6qRN3zaekU2dy2PNZqOyLauKHzdgPFazMxrKgh1yr8paZjFLqgiVAWr4LB7K4yb_Taxbd-w3nfLjH9lSb-Gz6L8T4jNpcwjBizTXGOeZ4XfQh-OitmSAEGqFHmvMWwKUeYasg-mppO1f9vtRSkCifnx8JJXA0sqzPjamVx8pedeL1QWY1R2ikl_ZY4CQLWQaP7FS6rOi47Mo76Nhe__cpGAa4"
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
