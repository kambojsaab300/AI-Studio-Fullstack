import React, { useState } from 'react';
import { Layers, Search, X, Check } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { adminApi } from '../../api/adminApi';

function Stat({ label, value, tone }) {
    const valueCls = tone === 'emerald' ? 'text-emerald-300' : tone === 'rose' ? 'text-rose-300' : 'text-white';
    return (
        <span className="inline-flex items-center gap-2 h-7 px-2.5 rounded-lg bg-[#0f0f0f] border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</span>
            <span className={`text-xs font-black ${valueCls}`}>{value}</span>
        </span>
    );
}

function StatusPill({ enabled, disabled, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={enabled ? 'Click to disable' : 'Click to enable'}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap h-7 px-2.5 rounded-full text-[11px] font-mono font-bold border transition-colors disabled:opacity-50 ${
                enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
            }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {enabled ? 'Enabled' : 'Disabled'}
        </button>
    );
}

function AppChip({ label, linked, disabled, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={linked ? `Remove from ${label}` : `Add to ${label}`}
            className={`inline-flex items-center gap-1 h-7 px-2.5 max-w-full rounded-lg text-[11px] font-mono font-bold border transition-colors disabled:opacity-50 ${
                linked
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/40 hover:bg-amber-400/25'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600'
            }`}
        >
            {linked && <Check className="w-3 h-3 shrink-0" />}
            <span className="truncate">{label}</span>
        </button>
    );
}

export function ToolsScreen() {
    const { sb, catalog, apps, appTasks, loadCatalog, setMsg } = useAdmin();
    const [filter, setFilter] = useState('');
    const [busy, setBusy] = useState(''); // key of the row currently saving, e.g. "tool:x" or "app:task"

    const all = catalog || [];
    const enabledCount = all.filter(c => c.enabled).length;

    const q = filter.trim().toLowerCase();
    const filtered = q
        ? all.filter(c =>
            (c.task_type || '').toLowerCase().includes(q) ||
            (c.label || '').toLowerCase().includes(q))
        : all;

    const isLinked = (appId, taskType) =>
        appTasks.some(l => l.app_id === appId && l.task_type === taskType);

    const toggleToolEnabled = async (taskType, current) => {
        setBusy(`tool:${taskType}`);
        try {
            const { error } = await adminApi.updateCatalogItem(taskType, { enabled: !current });

            if (error) return setMsg('Update error: ' + error.message);
            await loadCatalog();
        } finally {
            setBusy('');
        }
    };

    const toggleAppTask = async (appId, taskType, current) => {
        setBusy(`${appId}:${taskType}`);
        try {
            const req = !current
                ? adminApi.linkAppTasks(appId, taskType)
                : adminApi.unlinkAppTasks(appId, taskType);

            const { error } = await req;
            if (error) return setMsg('App link error: ' + error.message);
            await loadCatalog();
        } finally {
            setBusy('');
        }
    };

    const appLabel = (app) => app.label || app.name || app.app_id;

    return (
        <section className="min-w-0 space-y-4">
            {/* Header + search + summary */}
            <div className="bg-[#161616] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm sm:text-base font-extrabold text-white">
                                Tools & Application Links
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Enable or disable tools, and choose which apps can use each one.
                            </p>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-72 shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            type="search"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="Search by name or slug..."
                            className="w-full h-9 bg-[#0f0f0f] border border-slate-700 rounded-xl pl-8 pr-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 [&::-webkit-search-cancel-button]:hidden"
                        />
                        {filter && (
                            <button
                                type="button"
                                onClick={() => setFilter('')}
                                aria-label="Clear search"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Stat label="Total" value={all.length} />
                    <Stat label="Enabled" value={enabledCount} tone="emerald" />
                    <Stat label="Disabled" value={all.length - enabledCount} tone="rose" />
                    <span className="ml-auto text-[11px] font-mono text-slate-500">
                        Showing {filtered.length} of {all.length}
                    </span>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-3xl p-8 text-center bg-[#161616]/60">
                    <p className="text-sm font-extrabold text-white">
                        {all.length === 0 ? 'No tools yet' : 'No matching tools'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        {all.length === 0
                            ? 'Create a tool in the Tool Builder to see it here.'
                            : `Nothing matches "${filter}". Try a different name or slug.`}
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop / tablet: table */}
                    <div className="hidden md:block overflow-x-auto rounded-3xl border border-slate-800 bg-[#161616] shadow-xl">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider bg-[#131313]">
                                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                                    <th className="px-4 py-3">Tool name</th>
                                    <th className="px-4 py-3">Task slug</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Output</th>
                                    <th className="px-4 py-3">Linked apps</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {filtered.map(c => (
                                    <tr key={c.task_type} className="hover:bg-slate-900/50 transition-colors align-top">
                                        <td className="px-4 py-3">
                                            <StatusPill
                                                enabled={!!c.enabled}
                                                disabled={busy === `tool:${c.task_type}`}
                                                onClick={() => toggleToolEnabled(c.task_type, c.enabled)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-bold text-white min-w-[12rem]">{c.label}</td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-amber-400 whitespace-nowrap">{c.task_type}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                                {c.output}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {apps.map(app => (
                                                    <AppChip
                                                        key={app.app_id}
                                                        label={appLabel(app)}
                                                        linked={isLinked(app.app_id, c.task_type)}
                                                        disabled={busy === `${app.app_id}:${c.task_type}`}
                                                        onClick={() => toggleAppTask(app.app_id, c.task_type, isLinked(app.app_id, c.task_type))}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: stacked cards */}
                    <div className="md:hidden space-y-2.5">
                        {filtered.map(c => (
                            <div key={c.task_type} className="bg-[#161616] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-extrabold text-white break-words">{c.label}</p>
                                        <p className="font-mono text-[11px] text-amber-400 break-all mt-0.5">{c.task_type}</p>
                                    </div>
                                    <StatusPill
                                        enabled={!!c.enabled}
                                        disabled={busy === `tool:${c.task_type}`}
                                        onClick={() => toggleToolEnabled(c.task_type, c.enabled)}
                                    />
                                </div>

                                <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-slate-500">
                                    <span>Output</span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{c.output}</span>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Linked apps</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {apps.map(app => (
                                            <AppChip
                                                key={app.app_id}
                                                label={appLabel(app)}
                                                linked={isLinked(app.app_id, c.task_type)}
                                                disabled={busy === `${app.app_id}:${c.task_type}`}
                                                onClick={() => toggleAppTask(app.app_id, c.task_type, isLinked(app.app_id, c.task_type))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

export default ToolsScreen;
