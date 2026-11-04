import React, { useSyncExternalStore } from 'react';

// Tiny language store shared by Admin, Customer and Worker.
// Two languages: 'hi' (Hinglish, the default) and 'en' (English).
// Saved in localStorage 'aistudio_lang'. Every component that calls useT() re-renders on change.

const STORAGE_KEY = 'aistudio_lang';
export const LANGS = { hi: 'Hinglish', en: 'English' };

function readInitial() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'hi' || saved === 'en') return saved;
    } catch { }
    return 'hi';
}

let currentLang = readInitial();
const listeners = new Set();

export function getLang() {
    return currentLang;
}

export function setLang(lang) {
    if (lang !== 'hi' && lang !== 'en') return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { }
    listeners.forEach(fn => fn());
}

function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function useLang() {
    return useSyncExternalStore(subscribe, getLang, getLang);
}

// useT() returns t(hinglishText, englishText) -> the text for the current language.
export function useT() {
    const lang = useLang();
    return (hi, en) => (lang === 'en' ? en : hi);
}

// Two-button toggle: "Hinglish | English".
export function LangToggle({ className = '' }) {
    const lang = useLang();
    const btn = (code) => (
        <button
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${lang === code
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'}`}
        >
            {LANGS[code]}
        </button>
    );
    return (
        <div className={`inline-flex items-center gap-1 p-0.5 rounded-xl border border-slate-700 bg-slate-950/60 ${className}`}>
            {btn('hi')}
            {btn('en')}
        </div>
    );
}
