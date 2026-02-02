import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

export function AuthLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <Outlet key={location.pathname} />
      </AnimatePresence>
    </div>
  );
}
