import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CheckSquare, Square, Layers, Loader2 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { TOOL_CATEGORIES, getToolCategory } from '../../constants/categories';
import { adminApi } from '../../api/adminApi';
import { useT } from '../../i18n/lang';

const PAGE_SIZE = 10;        // tools shown per step; scrolling down shows the next 10
const SYNC_DELAY_MS = 1200;  // after a burst of clicks, reload the links from the server once

export function AppToolMatrix({ app, onClose }) {
    const { sb, catalog, appTasks, loadCatalog, setMsg } = useAdmin();
    const t = useT();
    const [search, setSearch] = useState('');
    const [selectedCat, setSelectedCat] = useState('all');
    const [updating, setUpdating] = useState(false);
    const [visible, setVisible] = useState(PAGE_SIZE);
    const [loadingMore, setLoadingMore] = useState(false);
    // Optimistic changes: task_type -> true/false, shown at once while the request runs
    const [overrides, setOverrides] = useState(() => new Map());
    const syncTimer = useRef(null);
    const listRef = useRef(null);
    const sentinelRef = useRef(null);

    const appId = app.app_id;

    // Server state + optimistic changes = what the screen shows
    const serverAssigned = useMemo(
        () => new Set(appTasks.filter(l => l.app_id === appId).map(l => l.task_type)),
        [appTasks, appId]
    );
    const assignedTaskTypes = useMemo(() => {
        const set = new Set(serverAssigned);
        overrides.forEach((on, type) => (on ? set.add(type) : set.delete(type)));
        return set;
    }, [serverAssigned, overrides]);

    // When fresh server data arrives, drop the overrides it already agrees with
    useEffect(() => {
        setOverrides(prev => {
            if (prev.size === 0) return prev;
            const next = new Map([...prev].filter(([type, on]) => serverAssigned.has(type) !== on));
            return next.size === prev.size ? prev : next;
        });
    }, [serverAssigned]);

    useEffect(() => () => clearTimeout(syncTimer.current), []);

    const errText = (e) => e?.message || e?.error || JSON.stringify(e);

    const scheduleSync = () => {
        clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => loadCatalog(), SYNC_DELAY_MS);
    };

    const applyOverrides = (types, on) => setOverrides(prev => {
        const next = new Map(prev);
        types.forEach(type => next.set(type, on));
        return next;
    });
    const revertOverrides = (types) => setOverrides(prev => {
        const next = new Map(prev);
        types.forEach(type => next.delete(type));
        return next;
    });

    // One click: the box flips at once, the request runs in the background
    const toggleTool = async (taskType) => {
        const assign = !assignedTaskTypes.has(taskType);
        applyOverrides([taskType], assign);
        const { error } = assign
            ? await adminApi.linkAppTasks(appId, taskType)
            : await adminApi.unlinkAppTasks(appId, taskType);
        if (error) {
            revertOverrides([taskType]);
            setMsg('Tool toggle error: ' + errText(error));
        }
        scheduleSync();
    };

    // Bulk: one request for the whole list (batch insert, or one DELETE with task_type=in.(...))
    const runBulk = async (tools, assign) => {
        const targets = tools
            .map(tool => tool.task_type)
            .filter(type => (assign ? !assignedTaskTypes.has(type) : assignedTaskTypes.has(type)));
        if (targets.length === 0) return;
        setUpdating(true);
        applyOverrides(targets, assign);
        try {
            const { error } = assign
                ? await adminApi.linkAppTasks(appId, targets)
                : await adminApi.unlinkAppTasks(appId, targets);
            if (error) throw new Error(errText(error));
            const name = `"${app.label}"`;
            setMsg(assign
                ? t(`${targets.length} tools ${name} ko assign kar diye gaye.`, `${targets.length} tools assigned to ${name}.`)
                : t(`${targets.length} tools ${name} se unassign ho gaye.`, `${targets.length} tools unassigned from ${name}.`));
        } catch (err) {
            revertOverrides(targets);
            setMsg((assign ? 'Assign' : 'Unassign') + ' error: ' + err.message);
        } finally {
            setUpdating(false);
            scheduleSync();
        }
    };

    const handleAssignAll = () => runBulk(catalog, true);
    const handleUnassignAll = () => {
        if (!window.confirm(t(`Kya aap pakka "${app.label}" se saare tools unassign karna chahte hain?`, `Are you sure you want to unassign all tools from "${app.label}"?`))) return;
        runBulk(catalog, false);
    };

    // Search and category always look at ALL tools; only the rendering is paged
    const filteredTools = useMemo(() => {
        const q = search.trim().toLowerCase();
        return catalog.filter(c => {
            if (selectedCat !== 'all' && getToolCategory(c.task_type) !== selectedCat) return false;
            if (!q) return true;
            return (c.label || '').toLowerCase().includes(q) || (c.task_type || '').toLowerCase().includes(q);
        });
    }, [catalog, search, selectedCat]);

    const categoryCounts = useMemo(() => {
        const counts = { all: catalog.length };
        catalog.forEach(c => { const k = getToolCategory(c.task_type); counts[k] = (counts[k] || 0) + 1; });
        return counts;
    }, [catalog]);

    // New search / category: start again from the first 10 and scroll the list to the top
    useEffect(() => {
        setVisible(PAGE_SIZE);
        if (listRef.current) listRef.current.scrollTop = 0;
    }, [search, selectedCat]);

    const hasMore = visible < filteredTools.length;

    // Infinite scroll: when the bottom marker comes into view, show the next 10 (short loader for feedback)
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasMore) return;
        const observer = new IntersectionObserver(entries => {
            if (!entries[0].isIntersecting || loadingMore) return;
            setLoadingMore(true);
            setTimeout(() => {
                setVisible(v => Math.min(v + PAGE_SIZE, filteredTools.length));
                setLoadingMore(false);
            }, 250);
        }, { root: listRef.current, rootMargin: '80px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, filteredTools.length]);

    const shownTools = filteredTools.slice(0, visible);

    return (
        <section className="bg-[#161616] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl animate-fadeIn">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                <div>
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-slate-300" />
                        <h3 className="text-sm sm:text-base font-extrabold text-white">
                            Tools for <span className="font-mono">{app.label}</span>
                        </h3>
                        <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                            {assignedTaskTypes.size} / {catalog.length} assigned
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Click a tool to turn it on or off for this app. Changes save instantly.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAssignAll}
                        disabled={updating}
                        className="h-8 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        Assign all ({catalog.length})
                    </button>
                    <button
                        type="button"
                        onClick={handleUnassignAll}
                        disabled={updating}
                        className="h-8 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        Unassign all
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>

            {/* Category, bulk-on-filter and search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {TOOL_CATEGORIES.map(cat => {
                        const active = selectedCat === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCat(cat.id)}
                                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                                    active
                                        ? 'bg-amber-400 text-slate-950 font-bold'
                                        : 'bg-[#0f0f0f] text-slate-400 hover:text-white border border-slate-800'
                                }`}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                                <span className={`text-[10px] px-1 font-mono ${active ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                                    {categoryCounts[cat.id] || 0}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => runBulk(filteredTools, true)}
                        disabled={updating || filteredTools.length === 0}
                        title="Select every tool in the current filter / search"
                        className="h-8 px-3 rounded-lg bg-[#0f0f0f] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        Select all ({filteredTools.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => runBulk(filteredTools, false)}
                        disabled={updating || filteredTools.length === 0}
                        title="Unselect every tool in the current filter / search"
                        className="h-8 px-3 rounded-lg bg-[#0f0f0f] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        Unselect all ({filteredTools.length})
                    </button>
                    {updating && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                </div>

                <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search all tools..."
                        className="w-full h-8 bg-[#0f0f0f] border border-slate-800 rounded-lg pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
                    />
                </div>
            </div>

            {/* Tools: 10 at a time, next 10 load on scroll */}
            <div ref={listRef} className="max-h-[460px] overflow-y-auto pr-1">
                {filteredTools.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-10">No tool matches "{search}".</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {shownTools.map(tool => {
                            const isAssigned = assignedTaskTypes.has(tool.task_type);
                            return (
                                <button
                                    type="button"
                                    key={tool.task_type}
                                    onClick={() => toggleTool(tool.task_type)}
                                    aria-pressed={isAssigned}
                                    className={`text-left p-3 rounded-xl border transition-colors flex items-start gap-2.5 select-none ${
                                        isAssigned
                                            ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                                            : 'bg-[#0f0f0f] border-slate-800/80 hover:border-slate-700'
                                    }`}
                                >
                                    <span className="pt-0.5 shrink-0">
                                        {isAssigned
                                            ? <CheckSquare className="w-4 h-4 text-emerald-400" />
                                            : <Square className="w-4 h-4 text-slate-600" />}
                                    </span>
                                    <span className="space-y-0.5 overflow-hidden">
                                        <span className={`block text-xs font-bold truncate ${isAssigned ? 'text-white' : 'text-slate-300'}`}>
                                            {tool.label}
                                        </span>
                                        <span className="block font-mono text-[10px] text-slate-500 truncate">{tool.task_type}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Bottom marker + loader */}
                {hasMore && (
                    <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                        <Loader2 className={`w-4 h-4 ${loadingMore ? 'animate-spin' : ''}`} />
                        <span>{t('Aur tools load ho rahe hain...', 'Loading more tools...')}</span>
                    </div>
                )}
                {!hasMore && filteredTools.length > PAGE_SIZE && (
                    <p className="text-center text-[11px] text-slate-600 py-3">
                        {t(`Saare ${filteredTools.length} tools dikh rahe hain`, `All ${filteredTools.length} tools shown`)}
                    </p>
                )}
            </div>
        </section>
    );
}

export default AppToolMatrix;
