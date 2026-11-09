import React from 'react';

import { NAV_ITEMS as TABS } from './navItems';

export function NavTabs({ activeTab, onChangeTab }) {
    return (
        <nav className="w-max flex items-center gap-1 bg-[#141414] border border-white/10 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl shadow-inner">
            {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChangeTab(tab.id)}
                        className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all ${
                            active 
                                ? 'bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20 font-extrabold' 
                                : 'text-stone-400 hover:text-white'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default NavTabs;
