import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useT } from '../../i18n/lang';
import { adminApi } from '../../api/adminApi';

// AI Studio API usage per client app, counted from our own tasks table (rpc get_app_usage)
const RANGES = [7, 28, 90];
const APP_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#fb923c', '#facc15', '#22d3ee'];

const fmt = (n) => Number(n || 0).toLocaleString();
const dayKey = (d) => d.toISOString().slice(0, 10);

function lastDays(n) {
    const out = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        out.push(dayKey(d));
    }
    return out;
}

export function AdminUsageScreen() {
    const { sb, apps, catalog } = useAdmin();
    const t = useT();
    const [days, setDays] = useState(28);
    const [data, setData] = useState({ days: [], tools: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!sb) return;
        setLoading(true);
        setError('');
        try {
            const { data: res, error: err } = await adminApi.getUsage(days);
            if (err) throw new Error(err.message || err.error || 'Request failed');
            if (res?.error) throw new Error(res.error);
            setData({ days: res?.days || [], tools: res?.tools || [] });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [sb, days]);

    useEffect(() => { load(); }, [load]);

    const appLabel = (id) => apps.find(a => a.app_id === id)?.label || id;
    const toolLabel = (type) => catalog.find(c => c.task_type === type)?.label || type;

    // Totals per app, sorted by use
    const perApp = useMemo(() => {
        const map = new Map();
        data.days.forEach(r => {
            const cur = map.get(r.app_id) || { app_id: r.app_id, tasks: 0, done: 0, failed: 0, photos: 0 };
            cur.tasks += r.tasks; cur.done += r.done; cur.failed += r.failed; cur.photos += r.photos;
            map.set(r.app_id, cur);
        });
        return [...map.values()].sort((a, b) => b.tasks - a.tasks);
    }, [data.days]);

    const colorOf = useMemo(() => {
        const m = {};
        perApp.forEach((a, i) => { m[a.app_id] = APP_COLORS[i % APP_COLORS.length]; });
        return m;
    }, [perApp]);

    const total = perApp.reduce((s, a) => ({ tasks: s.tasks + a.tasks, done: s.done + a.done, failed: s.failed + a.failed, photos: s.photos + a.photos }), { tasks: 0, done: 0, failed: 0, photos: 0 });

    // Daily stacked bars: one bar per day, one segment per app
    const chartDays = useMemo(() => {
        const keys = lastDays(days);
        const byDay = Object.fromEntries(keys.map(k => [k, {}]));
        data.days.forEach(r => { if (byDay[r.day]) byDay[r.day][r.app_id] = r.tasks; });
        return keys.map(k => ({ day: k, apps: byDay[k], sum: Object.values(byDay[k]).reduce((s, v) => s + v, 0) }));
    }, [data.days, days]);
    const maxDay = Math.max(1, ...chartDays.map(d => d.sum));

    const toolsByApp = useMemo(() => {
        const m = {};
        data.tools.forEach(r => { (m[r.app_id] = m[r.app_id] || []).push(r); });
        return m;
    }, [data.tools]);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-400" /> API Usage
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        {t('Har app ne hamari AI Studio API kitni use ki (tasks se gina gaya).', 'How much each app used our AI Studio API (counted from tasks).')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#161616] border border-slate-800 rounded-lg p-1">
                        {RANGES.map(r => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setDays(r)}
                                className={`h-7 px-3 rounded-md text-xs font-semibold transition-colors ${days === r ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                {r} {t('din', 'days')}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"
                        className="w-9 h-9 rounded-lg border border-slate-800 bg-[#161616] text-slate-300 hover:text-white inline-flex items-center justify-center disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">{t('Usage load nahi hua: ', 'Could not load usage: ')}{error}</div>}

            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    [t('Kul tasks', 'Total tasks'), total.tasks, 'text-white'],
                    ['Done', total.done, 'text-emerald-300'],
                    ['Failed', total.failed, 'text-rose-300'],
                    [t('Photos bani', 'Photos made'), total.photos, 'text-sky-300']
                ].map(([label, value, tone]) => (
                    <div key={label} className="bg-[#161616] border border-slate-800 rounded-xl p-4">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className={`text-2xl font-bold font-mono mt-1 ${tone}`}>{fmt(value)}</p>
                    </div>
                ))}
            </div>

            {/* Daily chart */}
            <section className="bg-[#161616] border border-slate-800 rounded-xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-white">{t('Roz ke tasks (app ke hisaab se)', 'Tasks per day (by app)')}</h3>
                    <div className="flex flex-wrap gap-3">
                        {perApp.map(a => (
                            <span key={a.app_id} className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colorOf[a.app_id] }} />
                                {appLabel(a.app_id)}
                            </span>
                        ))}
                    </div>
                </div>
                {total.tasks === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-10">{loading ? t('Load ho raha hai...', 'Loading...') : t('Is samay mein koi task nahi.', 'No tasks in this period.')}</p>
                ) : (
                    <div className="flex items-end gap-[3px] h-40">
                        {chartDays.map(d => (
                            <div key={d.day} className="flex-1 h-full flex flex-col justify-end group relative" title={`${d.day}: ${d.sum} tasks`}>
                                {perApp.map(a => d.apps[a.app_id] ? (
                                    <div key={a.app_id} style={{ height: `${(d.apps[a.app_id] / maxDay) * 100}%`, background: colorOf[a.app_id] }} className="w-full first:rounded-t-sm" />
                                ) : null)}
                                {d.sum === 0 && <div className="w-full h-px bg-slate-800" />}
                            </div>
                        ))}
                    </div>
                )}
                {total.tasks > 0 && (
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
                        <span>{chartDays[0]?.day}</span>
                        <span>{chartDays[chartDays.length - 1]?.day}</span>
                    </div>
                )}
            </section>

            {/* Per app */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {perApp.map(a => {
                    const rate = a.tasks ? Math.round((a.done / a.tasks) * 100) : 0;
                    const share = total.tasks ? Math.round((a.tasks / total.tasks) * 100) : 0;
                    const top = (toolsByApp[a.app_id] || []).slice(0, 5);
                    return (
                        <section key={a.app_id} className="bg-[#161616] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: colorOf[a.app_id] }} />
                                    <h3 className="text-sm font-bold text-white truncate">{appLabel(a.app_id)}</h3>
                                    <span className="font-mono text-[11px] text-slate-500">{a.app_id}</span>
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{share}% {t('of total', 'of total')}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center">
                                {[
                                    ['Tasks', a.tasks, 'text-white'],
                                    ['Done', a.done, 'text-emerald-300'],
                                    ['Failed', a.failed, 'text-rose-300'],
                                    ['Photos', a.photos, 'text-sky-300']
                                ].map(([label, value, tone]) => (
                                    <div key={label} className="bg-[#0f0f0f] border border-slate-800 rounded-lg py-2">
                                        <p className={`text-base font-bold font-mono ${tone}`}>{fmt(value)}</p>
                                        <p className="text-[10px] text-slate-500">{label}</p>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-400">{t('Success rate', 'Success rate')}</span>
                                    <span className={`font-mono font-bold ${rate >= 90 ? 'text-emerald-300' : rate >= 70 ? 'text-orange-300' : 'text-rose-300'}`}>{rate}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-orange-400' : 'bg-rose-500'}`} style={{ width: `${rate}%` }} />
                                </div>
                            </div>

                            {top.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-2">{t('Sabse zyada use hue tools', 'Most used tools')}</p>
                                    <ul className="space-y-1.5">
                                        {top.map(tool => (
                                            <li key={tool.task_type} className="flex items-center justify-between gap-3 text-xs">
                                                <span className="text-slate-200 truncate">{toolLabel(tool.task_type)}</span>
                                                <span className="font-mono text-slate-400 whitespace-nowrap">
                                                    {fmt(tool.tasks)}{tool.failed > 0 && <span className="text-rose-300"> · {tool.failed} fail</span>}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

export default AdminUsageScreen;
