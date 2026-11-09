import React from 'react';
import { LogOut, Menu } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { LangToggle } from '../../i18n/lang';
import { NAV_ITEMS } from './navItems';

// Top bar: menu button (phones), current screen title and user controls.
// (the sidebar is desktop-only).
export function Header({ onOpenNav }) {
    const { sb, email, screen, setScreen } = useAdmin();
    const current = NAV_ITEMS.find(item => item.id === screen);

    const handleLogout = async () => {
        if (sb?.auth) await sb.auth.signOut();
    };

    return (
        <header className="sticky top-0 z-40 bg-[#111111]/90 backdrop-blur-md border-b border-white/5">
            <div className="h-14 px-4 lg:px-8 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onOpenNav}
                        aria-label="Open menu"
                        className="lg:hidden h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="lg:hidden font-extrabold text-sm text-white">AI Studio</span>
                    <h2 className="text-base font-bold text-white truncate">{current?.label}</h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <LangToggle />
                    <span className="hidden xl:inline text-stone-400 text-[11px] font-mono max-w-[200px] truncate" title={email}>
                        {email}
                    </span>
                    <button
                        type="button"
                        onClick={handleLogout}
                        title="Sign out"
                        aria-label="Sign out"
                        className="lg:hidden h-8 w-8 flex items-center justify-center rounded-full text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
