import React, { useState } from 'react';
import { 
    Smartphone, Plus, Layers, Play, Settings, Trash2, CheckCircle2, 
    ChevronRight, ArrowLeft, RefreshCw, ExternalLink, Copy, Check 
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { AppCreateModal } from './AppCreateModal';
import { AppToolMatrix } from './AppToolMatrix';
import { AppWorkspaceView } from './AppWorkspaceView';
import { ApiKeysPanel } from './ApiKeysPanel';
import { adminApi } from '../../api/adminApi';
import { useT } from '../../i18n/lang';

// Avatar colour per app card so apps are easy to tell apart
const APP_TONES = [
    'bg-sky-500/15 text-sky-300',
    'bg-violet-500/15 text-violet-300',
    'bg-emerald-500/15 text-emerald-300',
    'bg-rose-500/15 text-rose-300',
    'bg-orange-500/15 text-orange-300'
];

export function AppsDashboard() {
    const { sb, apps, appTasks, catalog, loadCatalog, setMsg } = useAdmin();
    const t = useT();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState(null);
    const [activeSubTab, setActiveSubTab] = useState('workspace'); // 'workspace' | 'matrix'
    const [copiedId, setCopiedId] = useState(null);

    const handleCopyUrl = (appId) => {
        const url = `${window.location.origin}/app/${appId}`;
        navigator.clipboard.writeText(url);
        setCopiedId(appId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleToggleApp = async (appId, currentEnabled) => {
        try {
            const { error } = await adminApi.updateApp(appId, { enabled: !currentEnabled });
            if (error) throw error;
            loadCatalog();
        } catch (err) {
            setMsg('App update error: ' + err.message);
        }
    };

    const handleDeleteApp = async (appId, label) => {
        if (['weargen', 'ppp'].includes(appId)) {
            return setMsg(t('Default system apps (WearGen, PPP) delete nahi ki ja sakti.', 'Default system apps (WearGen, PPP) cannot be deleted.'));
        }
        if (!window.confirm(t(`Kya aap pakka App "${label}" (${appId}) ko delete karna chahte hain?`, `Are you sure you want to delete App "${label}" (${appId})?`))) return;

        try {
            // Deletes the app together with its tool links
            const { error } = await adminApi.deleteApp(appId);
            if (error) throw error;
            if (selectedApp?.app_id === appId) setSelectedApp(null);
            loadCatalog();
            setMsg(t(`App "${label}" delete ho gayi.`, `App "${label}" deleted.`));
        } catch (err) {
            setMsg('App delete error: ' + err.message);
        }
    };

    // If an app is selected, render its dedicated Workspace / Matrix view
    if (selectedApp) {
        return (
            <div className="space-y-5 animate-fadeIn">
                {/* Back to Apps List & Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161616] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSelectedApp(null)}
                            className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>All Apps</span>
                        </button>
                        <div className="h-4 w-px bg-slate-800 hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-white">{selectedApp.label}</span>
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                                {selectedApp.app_id}
                            </span>
                        </div>
                    </div>

                    {/* Mode Switcher & Standalone Launch Links */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-[#0f0f0f] p-1 rounded-xl border border-slate-800 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('workspace')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                    activeSubTab === 'workspace' 
                                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Play className="w-3.5 h-3.5" />
                                <span>Preview Workspace</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('matrix')}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                    activeSubTab === 'matrix' 
                                        ? 'bg-amber-400 text-slate-950 font-extrabold shadow-sm' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                                <span>Manage Assigned Tools</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleCopyUrl(selectedApp.app_id)}
                                className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition-colors"
                                title="Copy Standalone URL"
                            >
                                {copiedId === selectedApp.app_id ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-bold">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Copy URL</span>
                                    </>
                                )}
                            </button>

                            <a
                                href={`/app/${selectedApp.app_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-amber-400/20 transition-all"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open Standalone Tab ↗</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                {activeSubTab === 'workspace' ? (
                    <AppWorkspaceView app={selectedApp} />
                ) : (
                    <AppToolMatrix app={selectedApp} onClose={() => setActiveSubTab('workspace')} />
                )}
            </div>
        );
    }

    // Default Overview Screen: List of Apps
    const activeCount = apps.filter(a => a.enabled).length;
    const toolTotal = catalog.length;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Page header: title, short text, one main action */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white">Apps & Clients</h2>
                    <p className="text-sm text-slate-400 mt-1 max-w-xl">
                        Each client app (WearGen, Zara, Myntra...) gets its own tools and its own standalone URL.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#161616] border border-slate-800 text-slate-300">
                            <span className="font-bold text-white">{apps.length}</span> apps
                        </span>
                        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="font-bold">{activeCount}</span> active
                        </span>
                        {apps.length - activeCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                <span className="font-bold">{apps.length - activeCount}</span> disabled
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#161616] border border-slate-800 text-slate-300">
                            <span className="font-bold text-white">{toolTotal}</span> tools in catalog
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    className="shrink-0 h-10 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create app</span>
                </button>
            </div>

            {/* Apps */}
            {apps.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-2xl px-6 py-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                        <Smartphone className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">No apps yet</p>
                    <p className="text-sm text-slate-400 mt-1">Create your first client app to assign tools and share a standalone URL.</p>
                    <button
                        type="button"
                        onClick={() => setCreateModalOpen(true)}
                        className="mt-4 h-9 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create app</span>
                    </button>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {apps.map((app, idx) => {
                    const assignedCount = appTasks.filter(l => l.app_id === app.app_id).length;
                    const isSystem = ['weargen', 'ppp'].includes(app.app_id);
                    const pct = toolTotal ? Math.min(100, Math.round((assignedCount / toolTotal) * 100)) : 0;
                    const copied = copiedId === app.app_id;
                    const tone = APP_TONES[idx % APP_TONES.length];
                    const actionCls = 'h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors';

                    return (
                        <div
                            key={app.app_id}
                            className="flex flex-col bg-[#161616] border border-slate-800 hover:border-slate-700 rounded-2xl transition-colors"
                        >
                            <div className="p-4 sm:p-5 space-y-4">
                                {/* Identity + status */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${tone}`}>
                                            {app.label.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-sm font-bold text-white truncate">{app.label}</h3>
                                                {isSystem && (
                                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400 bg-slate-800 px-1.5 py-px rounded">
                                                        System
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-mono text-[11px] text-slate-500 truncate">{app.app_id}</p>
                                        </div>
                                    </div>

                                    {/* Active switch */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={!!app.enabled}
                                        onClick={() => handleToggleApp(app.app_id, app.enabled)}
                                        title={app.enabled ? 'Active, click to disable' : 'Disabled, click to enable'}
                                        className="shrink-0 inline-flex items-center gap-2 text-[11px] font-semibold"
                                    >
                                        <span className={app.enabled ? 'text-emerald-300' : 'text-slate-500'}>{app.enabled ? 'Active' : 'Off'}</span>
                                        <span className={`relative w-8 h-[18px] rounded-full transition-colors ${app.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                            <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${app.enabled ? 'left-4' : 'left-0.5'}`} />
                                        </span>
                                    </button>
                                </div>

                                {/* Tool assignment */}
                                <div>
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-slate-400">Tools assigned</span>
                                        <span className="font-mono text-slate-200">
                                            <span className="font-bold text-white">{assignedCount}</span> / {toolTotal}
                                        </span>
                                    </div>
                                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mt-auto flex items-center gap-1 px-3 py-2 border-t border-slate-800">
                                <a href={`/app/${app.app_id}`} target="_blank" rel="noopener noreferrer" className={actionCls} title="Open the standalone app in a new tab">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Open</span>
                                </a>
                                <button type="button" onClick={() => { setSelectedApp(app); setActiveSubTab('workspace'); }} className={actionCls} title="Preview inside admin">
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Preview</span>
                                </button>
                                <button type="button" onClick={() => { setSelectedApp(app); setActiveSubTab('matrix'); }} className={actionCls} title="Choose this app's tools">
                                    <Settings className="w-3.5 h-3.5" />
                                    <span>Tools</span>
                                </button>
                                <div className="ml-auto flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyUrl(app.app_id)}
                                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center transition-colors"
                                        title="Copy app URL"
                                        aria-label="Copy app URL"
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                    {!isSystem && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteApp(app.app_id, app.label)}
                                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 inline-flex items-center justify-center transition-colors"
                                            title="Delete app"
                                            aria-label="Delete app"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

            {/* API Keys for web apps (created here, used anywhere via X-Api-Key) */}
            <ApiKeysPanel />

            {/* Create App Modal */}
            <AppCreateModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onCreated={(newId) => {
                    const found = apps.find(a => a.app_id === newId);
                    if (found) {
                        setSelectedApp(found);
                        setActiveSubTab('workspace');
                    }
                }}
            />
        </div>
    );
}

export default AppsDashboard;
