import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x)

    if (pathnames.length === 0) return null;

    const routeMap: Record<string, string> = {
        dashboard: 'Dashboard',
        connect: 'Connect Platforms',
        platforms: 'My Platforms',
        analytics: 'Analytics',
        settings: 'Settings',
        upload: 'Upload Content',
        login: 'Login',
        register: 'Register',
        automation: 'Workflows',
        'automation/new': 'New Workflow',
    };

    return (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link
                to="/dashboard"
                className="hover:text-primary transition-colors flex items-center gap-1"
            >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
            </Link>

            {pathnames.map((value, index) => {
                const last = index === pathnames.length - 1;
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const label = routeMap[to.slice(1)] || value.charAt(0).toUpperCase() + value.slice(1);

                return (
                    <div key={to} className="flex items-center gap-2">
                        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                        {last ? (
                            <span className="text-foreground font-medium">{label}</span>
                        ) : (
                            <Link to={to} className="hover:text-primary transition-colors">
                                {label}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
};
