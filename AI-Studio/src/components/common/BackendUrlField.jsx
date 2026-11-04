import React, { useState } from 'react';
import { useT } from '../../i18n/lang';

// Backend API URL picker shared by Admin, Customer and Worker.
// Saves to localStorage 'aistudio_api_url' (read by src/api/config.js and the app clients),
// then reloads so the new URL is used everywhere.

const STORAGE_KEY = 'aistudio_api_url';
const DEFAULT_URL = 'https://aistudio.runasp.net';

function readSaved() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

export function BackendUrlField({ className = '' }) {
    const t = useT();
    const [value, setValue] = useState(readSaved);
    const [msg, setMsg] = useState('');
    const current = readSaved();

    const save = () => {
        const url = value.trim().replace(/\/$/, '');
        if (!/^https?:\/\/[^\s/]+/i.test(url)) {
            setMsg(t('URL http:// ya https:// se shuru hona chahiye.', 'URL must start with http:// or https://.'));
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, url);
        } catch {
            setMsg(t('Save nahi ho paya (browser storage band hai).', 'Could not save (browser storage is disabled).'));
            return;
        }
        window.location.reload();
    };

    const reset = () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
        window.location.reload();
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <label className="block text-xs font-bold text-slate-300">Backend API URL</label>
            <input
                value={value}
                onChange={e => { setValue(e.target.value); setMsg(''); }}
                placeholder={DEFAULT_URL}
                className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-slate-100 placeholder:text-slate-600"
            />
            <div className="flex gap-2">
                <button type="button" onClick={save} className="flex-1 h-9 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">
                    Save &amp; Reload
                </button>
                <button type="button" onClick={reset} className="flex-1 h-9 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold">
                    Default
                </button>
            </div>
            <p className="text-[11px] text-slate-500">{t('Abhi use ho raha:', 'Currently using:')} {current || `default (${DEFAULT_URL})`}</p>
            {msg && <p className="text-[11px] text-rose-400">{msg}</p>}
        </div>
    );
}
