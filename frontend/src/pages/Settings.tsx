import { Card } from '@/components/ui/Card';
import { Settings as SettingsIcon, User, Bell, Lock, Palette, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';

export const Settings = () => {
    const sections = [
        { label: 'Profile', icon: User, desc: 'Manage your public name and avatar.' },
        { label: 'Notifications', icon: Bell, desc: 'Configure when and how you receive updates.' },
        { label: 'Security', icon: Lock, desc: 'Update your password and 2FA settings.' },
        { label: 'Appearance', icon: Palette, desc: 'Customize the theme and layout density.' },
    ];

    return (
        <div className="max-w-4xl space-y-8">
            <header className="space-y-3 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 ring-1 ring-primary/20 shadow-inner">
                        <SettingsIcon className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">Settings</h2>
                </div>
                <p className="text-muted-foreground text-lg font-medium">Manage your account preferences and application configuration.</p>
            </header>

            <div className="space-y-5">
                {sections.map((section, i) => (
                    <motion.div
                        key={section.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, type: "spring", stiffness: 100 }}
                    >
                        <Card className="p-8 flex items-center justify-between border-0 bg-card/40 backdrop-blur-xl hover:bg-card/60 transition-all cursor-pointer group rounded-[2rem] ring-1 ring-white/10 hover:ring-primary/30 shadow-2xl relative overflow-hidden">
                            <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/5 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                            <div className="flex items-center gap-6 relative z-10">
                                <div className="p-4 rounded-2xl bg-secondary/50 group-hover:bg-primary/10 transition-all duration-500 ring-1 ring-white/5 group-hover:rotate-6">
                                    <section.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl tracking-tight group-hover:text-primary transition-colors">{section.label}</h3>
                                    <p className="text-sm text-muted-foreground font-medium">{section.desc}</p>
                                </div>
                            </div>
                            {section.label === 'Appearance' ? (
                                <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                                    <ThemeToggle />
                                </div>
                            ) : (
                                <ChevronRight className="w-6 h-6 text-muted-foreground/30 group-hover:text-foreground transition-all group-hover:translate-x-1 relative z-10" />
                            )}
                        </Card>
                    </motion.div>
                ))}
            </div>

            <div className="pt-12 mt-4 border-t border-white/5">
                <Card className="p-8 border-0 bg-destructive/5 backdrop-blur-xl rounded-[2.5rem] ring-1 ring-destructive/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-destructive/[0.02] group-hover:bg-destructive/[0.05] transition-colors duration-700" />
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                        <div className="space-y-1">
                            <h3 className="font-black text-2xl text-destructive tracking-tight">Danger Zone</h3>
                            <p className="text-sm text-muted-foreground font-medium">Permanently delete your account and all associated video data.</p>
                        </div>
                        <Button variant="destructive" className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-xs shadow-2xl shadow-destructive/20 hover:scale-105 active:scale-95 transition-all">
                            Delete Account
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};
