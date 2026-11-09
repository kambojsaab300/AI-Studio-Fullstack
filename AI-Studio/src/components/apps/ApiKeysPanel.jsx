import React, { useCallback, useEffect, useState } from 'react';
import { Key, Copy, Check, Ban, RefreshCw, Plus, X } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { API_URL } from '../../api/config';

// Calls the admin-only API key endpoints with the logged-in admin JWT.
async function apiKeyRequest(path = '', options = {}) {
    const token = localStorage.getItem('aistudio_token') || '';
    const res = await fetch(`${API_URL}/api/admin/api-keys${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

// API uses C# property names as-is (PascalCase), so these fields are PascalCase.
function getKeyStatus(k) {
    if (!k.Enabled || k.RevokedAt) return { label: 'Revoked', dot: 'bg-red-400', text: 'text-red-300' };
    if (k.ExpiresAt && new Date(k.ExpiresAt) <= new Date()) return { label: 'Expired', dot: 'bg-slate-500', text: 'text-slate-400' };
    return { label: 'Active', dot: 'bg-emerald-400', text: 'text-emerald-300' };
}

const formatDate = (value) => (value
    ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—');

export function ApiKeysPanel() {
    const { apps } = useAdmin();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [scope, setScope] = useState('app'); // 'app' = web app key, 'worker' = worker enrollment key
    const [appId, setAppId] = useState('');
    const [expiresOn, setExpiresOn] = useState('');
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(null); // holds the plain key, shown once
    const [copied, setCopied] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    const loadKeys = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setKeys(await apiKeyRequest());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadKeys(); }, [loadKeys]);

    useEffect(() => {
        if (!appId && apps.length > 0) setAppId(apps[0].app_id);
    }, [apps, appId]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError('');
        setCreated(null);
        try {
            const data = await apiKeyRequest('', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    scope,
                    app_id: scope === 'app' ? appId : null,
                    expires_at: expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : null
                })
            });
            setCreated(data);
            setCopied(false);
            setName('');
            setExpiresOn('');
            setShowCreate(false);
            loadKeys();
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (k) => {
        if (!window.confirm(`Revoke "${k.Name}"? Web apps using this key will stop working immediately.`)) return;
        try {
            await apiKeyRequest(`/${k.Id}/revoke`, { method: 'POST' });
            loadKeys();
        } catch (err) {
            setError(err.message);
        }
    };

    const copyCreatedKey = async () => {
        try {
            await navigator.clipboard.writeText(created.Key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Copy failed. Select the key and copy it manually.');
        }
    };

    const inputCls = 'w-full h-10 px-3 bg-[#0f0f0f] border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40';
    const labelCls = 'block text-xs font-semibold text-slate-300 mb-1.5';
    const iconBtn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40';

    const CreateButton = ({ className = '' }) => (
        <button
            type="button"
            onClick={() => { setError(''); setShowCreate(true); }}
            className={`h-9 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 transition-colors ${className}`}
        >
            <Plus className="w-4 h-4" />
            <span>Create API key</span>
        </button>
    );

    return (
        <section className="bg-[#161616] border border-slate-800 rounded-2xl shadow-xl">
            {/* Header: title + one main action */}
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6 border-b border-slate-800">
                <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-white">API Keys</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Use a key to call AI Studio from your web app or worker. A web app key works only for its app.
                        Keep keys secret and never put them in client code or a repository.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={loadKeys} disabled={loading} className={iconBtn} title="Refresh" aria-label="Refresh">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <CreateButton />
                </div>
            </div>

            {error && !showCreate && (
                <div className="mx-5 sm:mx-6 mt-4 text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
            )}

            {/* New key: shown once */}
            {created && (
                <div className="mx-5 sm:mx-6 mt-4 border border-amber-400/30 bg-amber-400/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-amber-300">
                            Copy your new key now. It will not be shown again.
                        </p>
                        <button type="button" onClick={() => setCreated(null)} className={iconBtn} aria-label="Dismiss">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 break-all font-mono text-xs text-white bg-[#0f0f0f] border border-slate-800 rounded-lg px-3 py-2.5">
                            {created.Key}
                        </code>
                        <button
                            type="button"
                            onClick={copyCreatedKey}
                            className="shrink-0 h-10 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold text-slate-100 inline-flex items-center gap-1.5"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                    </div>
                    <p className="text-xs text-slate-400">
                        {created.Scope === 'worker'
                            ? <>Paste it once into the worker page's key field. The worker then gets its own token automatically.</>
                            : <>Send it from your server as the header <code className="text-slate-200">X-Api-Key: &lt;key&gt;</code> when creating tasks.</>}
                    </p>
                </div>
            )}

            {/* Keys table */}
            {keys.length === 0 && !loading ? (
                <div className="px-6 py-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                        <Key className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">No API keys yet</p>
                    <p className="text-sm text-slate-400 mt-1">Create a key to connect a web app or a worker.</p>
                    <CreateButton className="mt-4" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="text-xs text-slate-400 border-b border-slate-800">
                                <th className="px-5 sm:px-6 py-3 font-semibold">Key</th>
                                <th className="px-3 py-3 font-semibold">Used by</th>
                                <th className="px-3 py-3 font-semibold whitespace-nowrap">Created</th>
                                <th className="px-3 py-3 font-semibold whitespace-nowrap">Last used</th>
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-5 sm:px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                            {keys.map(k => {
                                const status = getKeyStatus(k);
                                const isActive = status.label === 'Active';
                                return (
                                    <tr key={k.Id} className="hover:bg-slate-900/40 transition-colors">
                                        <td className="px-5 sm:px-6 py-3.5">
                                            <p className="font-semibold text-white">{k.Name}</p>
                                            <p className="font-mono text-xs text-slate-400 mt-0.5">{k.KeyPrefix}••••••••</p>
                                        </td>
                                        <td className="px-3 py-3.5 text-slate-300 whitespace-nowrap">
                                            {k.Scope === 'worker' ? 'Worker' : (apps.find(a => a.app_id === k.AppId)?.label || k.AppId)}
                                        </td>
                                        <td className="px-3 py-3.5 text-slate-400 whitespace-nowrap">{formatDate(k.CreatedAt)}</td>
                                        <td className="px-3 py-3.5 text-slate-400 whitespace-nowrap">{k.LastUsedAt ? formatDate(k.LastUsedAt) : 'Never'}</td>
                                        <td className="px-3 py-3.5 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                                {status.label}
                                                {isActive && k.ExpiresAt && <span className="text-slate-500 font-normal">· until {formatDate(k.ExpiresAt)}</span>}
                                            </span>
                                        </td>
                                        <td className="px-5 sm:px-6 py-3.5 text-right">
                                            {isActive && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevoke(k)}
                                                    className="h-8 px-3 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-500/10 inline-flex items-center gap-1.5 transition-colors"
                                                >
                                                    <Ban className="w-3.5 h-3.5" />
                                                    <span>Revoke</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create dialog */}
            {showCreate && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget && !creating) setShowCreate(false); }}
                >
                    <form
                        onSubmit={handleCreate}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-key-title"
                        className="w-full max-w-md bg-[#161616] border border-slate-700 rounded-2xl shadow-2xl"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                            <h4 id="create-key-title" className="text-base font-bold text-white">Create API key</h4>
                            <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className={iconBtn} aria-label="Close">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <label className={labelCls} htmlFor="key-name">Name</label>
                                <input
                                    id="key-name"
                                    className={inputCls}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={scope === 'worker' ? 'e.g. Office PC worker' : 'e.g. WearGen production web'}
                                    maxLength={150}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <span className={labelCls}>Key type</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {[['app', 'Web app'], ['worker', 'Worker']].map(([val, label]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setScope(val)}
                                            aria-pressed={scope === val}
                                            className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${
                                                scope === val
                                                    ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                                                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {scope === 'app' && (
                                <div>
                                    <label className={labelCls} htmlFor="key-app">App</label>
                                    <select id="key-app" className={inputCls} value={appId} onChange={(e) => setAppId(e.target.value)} required>
                                        {apps.map(a => (
                                            <option key={a.app_id} value={a.app_id}>{a.label || a.app_id}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className={labelCls} htmlFor="key-expiry">Expires <span className="font-normal text-slate-500">(optional)</span></label>
                                <input
                                    id="key-expiry"
                                    type="date"
                                    className={inputCls}
                                    value={expiresOn}
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => setExpiresOn(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                disabled={creating}
                                className="h-9 px-4 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creating || !name.trim() || (scope === 'app' && !appId)}
                                className="h-9 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                            >
                                {creating ? 'Creating…' : 'Create key'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}

export default ApiKeysPanel;
