import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';

export const Upload = () => {
    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Upload Content</h1>
                <p className="text-muted-foreground">Upload once, publish everywhere.</p>
            </div>

            <Card className="p-12 border-2 border-dashed border-border flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/20 transition-all">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl">☁️</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Drag and drop your video</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                    Supports MP4, MOV, and AVI up to 2GB.
                </p>
                <div className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium">
                    Select File
                </div>
            </Card>
        </DashboardLayout>
    );
};
