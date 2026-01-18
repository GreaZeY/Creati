import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    // Main content wrapper
    return (
        <div className="min-h-screen bg-background">
            <Sidebar />

            {/* Main Content Area - Offset by Sidebar width */}
            <main className="pl-60 min-h-screen transition-all duration-300">
                <div className="max-w-7xl mx-auto p-8 md:p-12 lg:p-16">
                    {children}
                </div>
            </main>
        </div>
    );
}
