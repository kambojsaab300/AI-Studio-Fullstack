import React, { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, LogOut, Shield } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { NAV_SECTIONS } from './navItems';

// Left sidebar: icon + label per screen, grouped by section. Desktop: fixed column (collapses to an icon rail).
// Phones/tablets: slide-out drawer opened from the header menu button.
export function Sidebar({ activeTab, onChangeTab, open = false, onClose }) {
    const [collapsed, setCollapsed] = useState(false);
    const { sb, email } = useAdmin();

    const handleLogout = async () => {
        if (sb?.auth) await sb.auth.signOut();
    };

    return (
        <>
        {open && (
            <div onClick={onClose} className="lg:hidden fixed inset-0 z-40 bg-black/60" aria-hidden="true" />
        )}
        <aside
            className={`fixed inset-y-0 left-0 z-50 flex flex-col h-screen w-60 shrink-0 bg-[#111111] border-r border-white/5 transition-transform duration-200 ${
                open ? 'translate-x-0' : '-translate-x-full'
            } lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:transition-[width] ${
                collapsed ? 'lg:w-[68px]' : 'lg:w-60'
            }`}
        >
            <div className="flex items-center gap-2.5 px-3 h-14 shrink-0">
                <button
                    type="button"
                    onClick={() => setCollapsed(c => !c)}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                    {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
                {!collapsed && (
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-slate-950" />
                        </span>
                        <span className="font-extrabold text-sm text-white truncate">AI Studio</span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 font-bold border border-amber-400/30">
                            Admin
                        </span>
                    </div>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
                {NAV_SECTIONS.map(section => (
                    <div key={section.title} className="space-y-0.5">
                        {!collapsed && (
                            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                                {section.title}
                            </p>
                        )}
                        {section.items.map(item => {
                            const active = activeTab === item.id;
                            const { Icon } = item;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => { onChangeTab(item.id); onClose?.(); }}
                                    title={item.label}
                                    aria-current={active ? 'page' : undefined}
                                    className={`w-full h-10 flex items-center gap-3 rounded-full transition-colors ${
                                        collapsed ? 'justify-center' : 'px-3'
                                    } ${
                                        active
                                            ? 'bg-amber-400/15 text-amber-300'
                                            : 'text-stone-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Icon className="w-[18px] h-[18px] shrink-0" />
                                    {!collapsed && <span className="text-sm font-semibold truncate">{item.label}</span>}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="border-t border-white/5 p-2 space-y-1 shrink-0">
                {!collapsed && (
                    <p className="px-3 py-1 text-[11px] font-mono text-stone-400 truncate" title={email}>
                        {email}
                    </p>
                )}
                <button
                    type="button"
                    onClick={handleLogout}
                    title="Logout"
                    className={`w-full h-10 flex items-center gap-3 rounded-full text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ${
                        collapsed ? 'justify-center' : 'px-3'
                    }`}
                >
                    <LogOut className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span className="text-sm font-semibold">Logout</span>}
                </button>
            </div>
        </aside>
        </>
    );
}

export default Sidebar;
