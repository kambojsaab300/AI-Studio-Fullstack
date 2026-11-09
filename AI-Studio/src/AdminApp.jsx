import React from 'react';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/common/Toast';
import { StudioScreen } from './components/studio/StudioScreen';
import { AppsDashboard } from './components/apps/AppsDashboard';
import { ToolBuilder } from './components/builder/ToolBuilder';
import { ToolsScreen } from './components/tools/ToolsScreen';
import { WorkersScreen } from './components/workers/WorkersScreen';
import { CatalogScreen } from './components/catalog/CatalogScreen';
import { AdminUsageScreen } from './components/usage/AdminUsageScreen';
import { Shield } from 'lucide-react';
import { LoginScreen } from './components/auth/LoginScreen';

function AdminContent() {
    const { session, isAdmin, authLoading, screen, setScreen, msg, setMsg } = useAdmin();
    const [navOpen, setNavOpen] = React.useState(false);

    // 1. If still verifying auth on cold start, show sleek dark splash (prevents 1-sec login screen flicker)
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3 animate-pulse">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center shadow-lg shadow-amber-400/20">
                        <Shield className="w-6 h-6 text-slate-950 font-black" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">AI STUDIO ADMIN</span>
                </div>
            </div>
        );
    }

    // 2. If not logged in, show clean Login Screen
    if (!session || !isAdmin) {
        return <LoginScreen />;
    }

    // 2. Active Screen Switcher
    const renderActiveScreen = () => {
        switch (screen) {
            case 'apps':
                return <AppsDashboard />;
            case 'builder':
                return <ToolBuilder />;
            case 'tools':
                return <ToolsScreen />;
            case 'workers':
                return <WorkersScreen />;
            case 'features':
                return <CatalogScreen />;
            case 'usage':
                return <AdminUsageScreen />;
            case 'task':
            default:
                return <StudioScreen />;
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex font-sans selection:bg-amber-400 selection:text-slate-950">
            {/* Left sidebar: fixed column on desktop, slide-out drawer on phones/tablets */}
            <Sidebar activeTab={screen} onChangeTab={setScreen} open={navOpen} onClose={() => setNavOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* Top bar with menu button on phones */}
                <Header onOpenNav={() => setNavOpen(true)} />

                {/* Global Dismissible Notification Toast */}
                {msg && (
                    <Toast
                        message={msg}
                        onClose={() => setMsg('')}
                    />
                )}

                {/* Main Application Body Container */}
                <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-5 sm:py-6">
                    {renderActiveScreen()}
                </main>
            </div>
        </div>
    );
}

export function AdminApp() {
    return (
        <AdminProvider>
            <AdminContent />
        </AdminProvider>
    );
}

export default AdminApp;
