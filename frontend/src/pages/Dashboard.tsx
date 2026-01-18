import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const Dashboard = () => {
    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-muted-foreground">Manage your uploads and view performance.</p>
            </div>

            <div className="grid gap-6">
                <div className="p-8 border border-dashed border-border rounded-xl text-center">
                    <p className="text-muted-foreground">No videos uploaded yet.</p>
                </div>
            </div>
        </DashboardLayout>
    );
};
