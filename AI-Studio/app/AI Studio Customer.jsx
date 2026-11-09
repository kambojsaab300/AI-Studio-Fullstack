import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    Sparkles, LogIn, LogOut, Send, RefreshCw, Download, AlertCircle, CheckCircle2, 
    Clock, Upload, UserPlus, MessageSquare, Trash2, Square 
} from 'lucide-react';
import { BackendUrlField } from '../src/components/common/BackendUrlField';
import { useT, LangToggle, getLang } from '../src/i18n/lang';

// ============================================================
// AI Studio: .NET Core API Client (Standalone Inline Adapter)
// Powered by .NET Core Web API & Microsoft SQL Server
// ============================================================
class ApiQueryBuilder {
    constructor(apiUrl, table, token) {
        this.apiUrl = apiUrl;
        this.table = table;
        this.token = token;
        this.params = new URLSearchParams();
        this._isSingle = false;
        this._isCount = false;
        this._isHead = false;
    }

    select(columns = '*', options = {}) {
        this.params.set('select', columns);
        if (options && options.count) {
            this._isCount = true;
            this.params.set('count', options.count);
        }
        if (options && options.head) {
            this._isHead = true;
            this.params.set('head', 'true');
        }
        return this;
    }

    order(column, { ascending = true } = {}) {
        this.params.set('order', `${column}.${ascending ? 'asc' : 'desc'}`);
        return this;
    }

    limit(n) {
        this.params.set('limit', String(n));
        return this;
    }

    range(from, to) {
        this.params.set('offset', String(from));
        this.params.set('limit', String(to - from + 1));
        return this;
    }

    eq(column, value) {
        this.params.append(column, `eq.${value}`);
        return this;
    }

    neq(column, value) {
        this.params.append(column, `neq.${value}`);
        return this;
    }

    is(column, value) {
        this.params.append(column, `is.${value}`);
        return this;
    }

    in(column, values) {
        const list = Array.isArray(values) ? values.join(',') : values;
        this.params.append(column, `in.(${list})`);
        return this;
    }

    single() {
        this._isSingle = true;
        return this;
    }

    async _fetch(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true',
            ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        };
        if (this._isSingle) {
            headers['Accept'] = 'application/vnd.pgrst.object+json';
        }

        try {
            const res = await fetch(url, { ...options, headers });
            let countVal = 0;
            const contentRange = res.headers.get('content-range') || res.headers.get('Content-Range');
            if (contentRange) {
                const parts = contentRange.split('/');
                if (parts.length > 1) countVal = parseInt(parts[1], 10) || 0;
            } else {
                const totalHdr = res.headers.get('x-total-count') || res.headers.get('X-Total-Count');
                if (totalHdr) countVal = parseInt(totalHdr, 10) || 0;
            }

            if (!res.ok) {
                const text = await res.text();
                let errObj;
                try { errObj = JSON.parse(text); } catch { errObj = { message: text }; }
                return { data: null, error: errObj, count: 0 };
            }

            const data = await res.json();
            if (countVal === 0 && Array.isArray(data)) countVal = data.length;

            return {
                data: this._isSingle && Array.isArray(data) ? (data[0] || null) : data,
                error: null,
                count: countVal
            };
        } catch (err) {
            return { data: null, error: { message: err.message }, count: 0 };
        }
    }

    then(resolve, reject) {
        const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
        return this._fetch(url, { method: 'GET' }).then(resolve, reject);
    }

    async insert(data) {
        const url = `${this.apiUrl}/rest/v1/${this.table}`;
        return this._fetch(url, { method: 'POST', body: JSON.stringify(data) });
    }

    async update(data) {
        const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
        return this._fetch(url, { method: 'PATCH', body: JSON.stringify(data) });
    }

    async delete() {
        const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
        return this._fetch(url, { method: 'DELETE' });
    }
}

function getEffectiveApiUrl(providedUrl) {
    if (typeof window !== 'undefined') {
        const queryApi = new URLSearchParams(window.location.search).get('api');
        if (queryApi) {
            try { localStorage.setItem('aistudio_api_url', queryApi); } catch { }
            return queryApi.replace(/\/$/, "");
        }
        try {
            const savedApi = localStorage.getItem('aistudio_api_url');
            if (savedApi) {
                if (savedApi.includes('trycloudflare.com')) {
                    try { localStorage.removeItem('aistudio_api_url'); } catch { }
                } else {
                    return (savedApi === 'http://aistudio.runasp.net' ? 'https://aistudio.runasp.net' : savedApi).replace(/\/$/, "");
                }
            }
        } catch { }
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname)) {
            return `http://${window.location.hostname}:5005`;
        }
        if (window.location.hostname && window.location.hostname.endsWith('.trycloudflare.com')) {
            return 'https://carb-separate-photograph-tonight.trycloudflare.com';
        }
        if (window.location.hostname && window.location.hostname.endsWith('.loca.lt')) {
            return 'https://aistudio-api.loca.lt';
        }
        if (providedUrl) {
            return providedUrl.replace(/\/$/, "");
        }
    }
    return (providedUrl || "https://aistudio.runasp.net").replace(/\/$/, "");
}

function createClient(apiUrl = "https://aistudio.runasp.net", apiKey = "") {
    const url = getEffectiveApiUrl(apiUrl);
    let token = "";
    let currentUser = null;
    try {
        token = localStorage.getItem('aistudio_token') || "";
        const saved = localStorage.getItem('aistudio_user');
        if (saved) currentUser = JSON.parse(saved);
    } catch { }

    const authListeners = new Set();

    return {
        apiUrl: url,
        auth: {
            async signInWithPassword({ email, password }) {
                try {
                    const res = await fetch(`${url}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                        body: JSON.stringify({ email, password, appId: pageAppId() })
                    });
                    const json = await res.json();
                    if (!res.ok) return { data: null, error: { message: json.error || (getLang() === 'en' ? 'Login failed.' : 'Login fail hua.') } };
                    token = json.access_token;
                    currentUser = json.user;
                    try {
                        localStorage.setItem('aistudio_token', token);
                        localStorage.setItem('aistudio_user', JSON.stringify(currentUser));
                    } catch { }
                    authListeners.forEach(cb => cb('SIGNED_IN', { user: currentUser, access_token: token }));
                    return { data: { user: currentUser, session: { access_token: token, user: currentUser } }, error: null };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },

            async signInAnonymously() {
                const guestEmail = `guest_${Date.now()}@aistudio.local`;
                return this.signUp({ email: guestEmail, password: "Guest@123456" });
            },

            async signUp({ email, password }) {
                try {
                    const res = await fetch(`${url}/api/auth/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                        body: JSON.stringify({ email, password, appId: pageAppId() })
                    });
                    const json = await res.json();
                    if (!res.ok) return { data: null, error: { message: json.error || (getLang() === 'en' ? 'Signup failed.' : 'Signup fail hua.') } };
                    token = json.access_token;
                    currentUser = json.user;
                    try {
                        localStorage.setItem('aistudio_token', token);
                        localStorage.setItem('aistudio_user', JSON.stringify(currentUser));
                    } catch { }
                    authListeners.forEach(cb => cb('SIGNED_IN', { user: currentUser, access_token: token }));
                    return { data: { user: currentUser, session: { access_token: token, user: currentUser } }, error: null };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },

            async signOut() {
                token = "";
                currentUser = null;
                try {
                    localStorage.removeItem('aistudio_token');
                    localStorage.removeItem('aistudio_user');
                } catch { }
                authListeners.forEach(cb => cb('SIGNED_OUT', null));
                return { error: null };
            },

            async getSession() {
                if (token && currentUser) return { data: { session: { access_token: token, user: currentUser } }, error: null };
                return { data: { session: null }, error: null };
            },

            async getUser() {
                return { data: { user: currentUser }, error: null };
            },

            onAuthStateChange(callback) {
                authListeners.add(callback);
                return {
                    data: {
                        subscription: {
                            unsubscribe: () => authListeners.delete(callback)
                        }
                    }
                };
            }
        },

        from(table) {
            return new ApiQueryBuilder(url, table, token);
        },

        async rpc(functionName, params = {}) {
            try {
                const route = RPC_ROUTES[functionName];
                if (!route) return { data: null, error: { message: `Unknown function ${functionName}` } };
                const res = await fetch(`${url}${route.path}`, {
                    method: route.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Bypass-Tunnel-Reminder': 'true',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    ...(route.method === 'POST' ? { body: JSON.stringify(route.body(params)) } : {})
                });

                const text = await res.text();
                if (!res.ok) {
                    let errObj;
                    try { errObj = JSON.parse(text); } catch { errObj = { message: text }; }
                    return { data: null, error: errObj };
                }

                let data;
                try { data = JSON.parse(text); } catch { data = text; }
                return { data, error: null };
            } catch (err) {
                return { data: null, error: { message: err.message } };
            }
        },

        channel(name) {
            const ch = {
                name,
                on() { return ch; },
                subscribe() { return ch; }
            };
            return ch;
        },

        removeChannel() { }
    };
}

// ============================================================
// AI STUDIO CUSTOMER: the customer gives the input and gets the result. Sees only their own tasks.
// Powered by .NET Core Web API & Microsoft SQL Server
// ============================================================

const API_URL = "https://aistudio.runasp.net";
// Publishable key: safe in the app code (row security protects the data)
const API_KEY = "aistudio_local_key";
const CLOUDINARY_CLOUD_NAME = "draaqjcre";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";
const REFRESH_MS = 2000;          // Auto-refresh from DB every 2 seconds

// ── API: every call the app makes, named in one place ──
// Database function (sb.rpc)
// Old RPC names -> the new /api/customer REST endpoints.
const RPC_ROUTES = {
    get_task_catalog: { method: 'GET', path: '/api/customer/catalog' },
    get_family_roles: { method: 'GET', path: '/api/customer/family-roles' },
    get_model_list: { method: 'GET', path: '/api/customer/models' },
    get_app_list: { method: 'GET', path: '/api/customer/apps' }
};

// The JWT stored at login (carries app_id for the app this login works for).
function storedToken() {
    try { return localStorage.getItem('aistudio_token') || ''; } catch { return ''; }
}
function tokenAppId() {
    try {
        const t = storedToken();
        if (!t) return null;
        const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.app_id || null;
    } catch { return null; }
}
// The app shown on this page (same rule as the app state below), used when logging in.
function pageAppId() {
    try {
        const qApp = new URLSearchParams(window.location.search).get('app');
        if (qApp) return qApp.toLowerCase();
        const match = window.location.pathname.match(/\/(customer|app)\/([a-zA-Z0-9_-]+)/);
        if (match && match[2] && match[2] !== 'customer') return match[2].toLowerCase();
        const stored = localStorage.getItem('ai_studio_customer_app_id');
        if (stored) return stored;
    } catch { }
    return 'weargen';
}

// Image bytes need the Bearer header, so they are fetched once and shown through object URLs.
const blobUrlCache = new Map();
const taskDetailCache = new Map();   // publicId -> { outputText, imagePaths } for completed tasks
async function authBlobUrl(path) {
    if (blobUrlCache.has(path)) return blobUrlCache.get(path);
    try {
        const tok = storedToken();
        const res = await fetch(`${getEffectiveApiUrl(API_URL)}${path}`, {
            headers: { 'Bypass-Tunnel-Reminder': 'true', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }
        });
        if (!res.ok) return null;
        const url = URL.createObjectURL(await res.blob());
        blobUrlCache.set(path, url);
        return url;
    } catch { return null; }
}

// Plain JSON call to the customer API; resolves to { data, error } and never throws.
async function customerApi(method, path, body) {
    try {
        const tok = storedToken();
        const res = await fetch(`${getEffectiveApiUrl(API_URL)}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true',
                ...(tok ? { Authorization: `Bearer ${tok}` } : {})
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        if (!res.ok) return { data: null, error: { message: (json && (json.error || json.message)) || text || `HTTP ${res.status}` } };
        return { data: json, error: null };
    } catch (err) {
        return { data: null, error: { message: err.message } };
    }
}

const API = {
    CREATE_TASK: 'customer_create_task',           // UPLOAD a new task (the server sets the customer id)
    GET_CATALOG: 'get_task_catalog',               // GET the task types this app shows (from the database)
    GET_FAMILY_ROLES: 'get_family_roles',          // GET the family photo slots, in order (from the database)
    GET_MODELS: 'get_model_list',                  // GET the AI models (image and text), with aspect ratios and sizes
    GET_APPS: 'get_app_list'                       // GET the apps (WearGen, PPP ...) this customer can pick
};

// Database table (sb.from). RLS returns only this customer's rows.
const TABLES = {
    TASKS: 'ai_studio_tasks',                      // GET my tasks
    SETTINGS: 'ai_studio_settings'                 // GET the maintenance message
};

// External service
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`; // UPLOAD a photo

// The models a customer uses are chosen by the app, so the customer only fills in the input

// What a customer can ask for, in plain words
// What a customer can ask for. The database (ai_studio_task_catalog) gives the list when the app starts.
function safeCustomerJson(val, fallback) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try { return JSON.parse(trimmed); } catch (e) { return fallback; }
        }
    }
    return fallback;
}

const EMPTY_KIND = { label: '', output: 'text', inputs: [], labels: {}, optional: [], extras: false, promptRequired: false, hint: '' };
function toKind(r) {
    const inputs = safeCustomerJson(r.inputs, []);
    const labels = safeCustomerJson(r.customer_labels || r.labels, {});
    const optional = safeCustomerJson(r.optional, []);
    const apps = safeCustomerJson(r.apps, []);

    return {
        label: r.customer_label || r.label,
        output: r.output,
        inputs: Array.isArray(inputs) ? inputs : [],
        labels: (typeof labels === 'object' && labels !== null) ? labels : {},
        optional: Array.isArray(optional) ? optional : [],
        extras: !!r.extras,
        family: !!r.family,
        promptRequired: !!r.prompt_required,
        edit: !!r.edit,
        hint: r.hint || '',
        apps: Array.isArray(apps) ? apps : []
    };
}
function toKinds(rows) {
    const out = {};
    (rows || []).filter(r => r.customer_visible).forEach(r => { out[r.task_type] = toKind(r); });
    return out;
}
const INPUT_LABEL = { face: { hi: 'Apna chehra (face) ki photo', en: 'Your face photo' }, style: { hi: 'Style / kapde / scene ki photo', en: 'Style / outfit / scene photo' }, input: { hi: 'Photo', en: 'Photo' } };
const INPUT_COLUMN = { face: 'face_image_url', style: 'style_image_url', input: 'input_image_url' };
// Name of an input for this kind (person and product kinds name them differently)
const labelFor = (kind, key, t) => kind.labels?.[key] || (INPUT_LABEL[key] && t(INPUT_LABEL[key].hi, INPUT_LABEL[key].en));


// Upload a picture that is already in data-URL form (the brush mask)
async function uploadDataUrl(dataUrl, t) {
    const fd = new FormData();
    fd.append('file', dataUrl);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const data = await (await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd })).json();
    if (!data.secure_url) throw new Error(data.error?.message || t('Mask upload nahi hui', 'Mask upload failed'));
    return data.secure_url;
}

// Brush: paint over the photo. Painted area = red. Save gives a black/red mask (red = the area to edit).
function MaskEditor({ src, onSave }) {
    const t = useT();
    const imgRef = useRef(null);
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const last = useRef(null);
    const undoStack = useRef([]);
    const [size, setSize] = useState(40);
    const [ready, setReady] = useState(false);

    const onImgLoad = () => {
        const c = canvasRef.current;
        c.width = imgRef.current.naturalWidth;
        c.height = imgRef.current.naturalHeight;
        undoStack.current = [];
        setReady(true);
    };
    const point = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: (p.clientX - r.left) * canvasRef.current.width / r.width, y: (p.clientY - r.top) * canvasRef.current.height / r.height };
    };
    const snapshot = () => {
        const c = canvasRef.current;
        undoStack.current.push(c.getContext('2d').getImageData(0, 0, c.width, c.height));
        if (undoStack.current.length > 20) undoStack.current.shift();
    };
    const start = (e) => {
        if (!ready) return;
        snapshot();
        drawing.current = true;
        last.current = point(e);
    };
    const move = (e) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current.getContext('2d');
        const p = point(e);
        ctx.strokeStyle = 'rgb(255, 0, 0)';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
    };
    const stop = () => { drawing.current = false; };
    const undo = () => {
        const prev = undoStack.current.pop();
        if (prev) canvasRef.current.getContext('2d').putImageData(prev, 0, 0);
    };
    const clear = () => {
        snapshot();
        const c = canvasRef.current;
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
    };
    const save = () => {
        const c = canvasRef.current;
        const out = document.createElement('canvas');
        out.width = c.width;
        out.height = c.height;
        const o = out.getContext('2d');
        o.fillStyle = '#000';
        o.fillRect(0, 0, out.width, out.height);
        o.drawImage(c, 0, 0);
        onSave(out.toDataURL('image/jpeg', 0.92));
    };

    return (
        <div className="space-y-2">
            <div className="relative w-full select-none">
                <img ref={imgRef} src={src} onLoad={onImgLoad} alt="" className="w-full rounded-xl block" />
                <canvas
                    ref={canvasRef}
                    onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
                    onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
                    style={{ touchAction: 'none' }}
                    className="absolute inset-0 w-full h-full rounded-xl opacity-50 cursor-crosshair"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
                <label className="flex items-center gap-2">Brush <input type="range" min={4} max={200} value={size} onChange={e => setSize(Number(e.target.value))} /> {size}px</label>
                <button type="button" onClick={undo} className="h-9 px-3 rounded-xl border border-white/10 bg-stone-800 font-bold">Undo</button>
                <button type="button" onClick={clear} className="h-9 px-3 rounded-xl border border-white/10 bg-stone-800 font-bold">Clear</button>
                <button type="button" onClick={save} className="h-9 px-3 rounded-xl bg-amber-400 text-stone-950 font-black">{t('Area pakka karo', 'Confirm area')}</button>
            </div>
        </div>
    );
}

// The mask part of an edit form: the photo with the brush over it
function MaskBlock({ label, photoUrl, maskUrl, onSave }) {
    const t = useT();
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-bold text-stone-200">{label}</p>
            {!photoUrl ? (
                <p className="text-[11px] text-stone-400">{t('Pehle upar edit wali photo ka link ya upload karo.', 'First upload or paste the link of the photo to edit above.')}</p>
            ) : (
                <MaskEditor key={photoUrl} src={photoUrl} onSave={onSave} />
            )}
            {maskUrl && <p className="text-[11px] text-emerald-300">{t('Area save ho gaya. Photo badlo to area dobara pakka karo.', 'Area saved. If you change the photo, confirm the area again.')}</p>}
        </div>
    );
}

// How the customer sees the status
// Photo field for customers: pick a file first. A link is only for advanced users (hidden under "advanced").
function PhotoField({ label, optional = false, value, onUrl, onFile, placeholder, hint = '' }) {
    const t = useT();
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-bold text-stone-200">
                {label}{optional ? <span className="font-normal text-stone-500"> ({t('optional', 'optional')})</span> : null}
            </p>
            {hint && <p className="text-[11px] text-stone-400">{hint}</p>}
            <div className="flex items-center gap-3">
                {value
                    ? <img src={value} alt="" className="h-24 w-20 rounded-xl object-cover border border-white/10" />
                    : <div className="h-24 w-20 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-[10px] text-stone-500 text-center px-1">{t('Photo nahi chuni', 'No photo yet')}</div>}
                <div className="flex flex-col gap-2 items-start">
                    <label className="h-9 px-4 flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-xl text-xs cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" /> {value ? t('Badlo', 'Change') : t('Photo chuno', 'Choose photo')}
                        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                    </label>
                    {value && <button type="button" onClick={() => onUrl('')} className="text-[11px] text-stone-400 hover:text-rose-300 underline">{t('Hatao', 'Remove')}</button>}
                </div>
            </div>
            <details className="text-[11px] text-stone-500">
                <summary className="cursor-pointer hover:text-stone-300">{t('Link se daalo (advanced)', 'Use a link (advanced)')}</summary>
                <input value={value || ''} onChange={e => onUrl(e.target.value)} placeholder={placeholder} className="mt-2 h-9 w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs font-mono" />
            </details>
        </div>
    );
}

// Seconds as "45 sec" or "2 min 5 sec"
const fmtDuration = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)} min ${sec % 60} sec` : `${sec} sec`);

// Typical time for this task type: the median of the customer's own finished tasks of that type (null if none yet)
function typicalSeconds(taskType, list) {
    const xs = list
        .filter(x => x.task_type === taskType && x.status === 'done' && x.duration_ms > 0)
        .map(x => x.duration_ms / 1000)
        .sort((a, b) => a - b);
    if (!xs.length) return null;
    return Math.round(xs[Math.floor(xs.length / 2)]);
}

// Live timer for a task that is still being made. It ticks every second from when the task was created.
function LiveTimer({ since, estimateSec }) {
    const t = useT();
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    const started = new Date(since).getTime();
    const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-sky-300 tabular-nums">{t('Ban raha hai', 'Working on it')}: {fmtDuration(elapsed)}</span>
                <span className="text-stone-400">
                    {estimateSec
                        ? t(`Aam taur par ${fmtDuration(estimateSec)} lagte hain`, `Usually takes about ${fmtDuration(estimateSec)}`)
                        : t('Aam taur par 1 minute tak lagta hai', 'Usually takes about 1 minute')}
                </span>
            </div>
            <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full w-full bg-sky-400/70 rounded-full animate-pulse" />
            </div>
        </div>
    );
}

const STATUS_TEXT = {
    pending: { text: 'Queue mein hai', en: 'Queued', icon: Clock, cls: 'text-stone-300 bg-stone-800 border-white/10' },
    processing: { text: 'Ban raha hai...', en: 'Processing...', icon: RefreshCw, cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
    done: { text: 'Tayyar hai', en: 'Ready', icon: CheckCircle2, cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
    failed: { text: 'Problem aayi', en: 'Problem occurred', icon: AlertCircle, cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' }
};

// Makes a photo smaller before it is uploaded: at most 2048 px, JPEG, white behind any transparent part
function compressFile(file, t) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = reject;
        r.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error(t('Photo padh nahi paayi', 'Could not read the photo')));
            img.onload = () => {
                const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
                const c = document.createElement('canvas');
                c.width = Math.round(img.naturalWidth * k);
                c.height = Math.round(img.naturalHeight * k);
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', 0.85));
            };
            img.src = r.result;
        };
        r.readAsDataURL(file);
    });
}

async function uploadFile(file, t) {
    const dataUrl = await compressFile(file, t);
    const fd = new FormData();
    fd.append('file', dataUrl);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const data = await (await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd })).json();
    if (!data.secure_url) throw new Error(data.error?.message || t('Photo upload nahi hui', 'Photo upload failed'));
    return data.secure_url;
}

function loadClient(anonKey) {
    return Promise.resolve(createClient(API_URL, anonKey));
}

const SUIT_STOCK_MODELS = {
    man: [
        { id: 'm1', name: 'Indian Formal Male Model', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80' },
        { id: 'm2', name: 'Corporate Tuxedo Male Model', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80' }
    ],
    woman: [
        { id: 'w1', name: 'Graceful Ethnic Female Model', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80' },
        { id: 'w2', name: 'Modern Pant-Suit Female Model', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80' }
    ],
    kids: [
        { id: 'k1', name: 'Kid Boy Model (7-9 yr)', url: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=800&q=80' },
        { id: 'k2', name: 'Kid Girl Model (6-8 yr)', url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&q=80' }
    ]
};

const SUIT_POSES = [
    { id: 'all', label: '🌟 All Poses (6 Photos Batch)', desc: 'Front, Back, Side, Close-up, Upper, Down sab ek saath', batch: 6, angleText: '' },
    { id: 'front', label: '🧍 Front Pose', desc: 'Full standing front view, complete suit fitting', batch: 1, angleText: 'front pose (full standing front view showing complete suit fit and silhouette)' },
    { id: 'back', label: '🔄 Back Pose', desc: 'Back view showing back cut, styling and shoulder fit', batch: 1, angleText: 'back pose (back fitting and cut view showing rear design)' },
    { id: 'side', label: '📐 Side Pose', desc: '45 degree side profile view, sleek drape', batch: 1, angleText: 'side pose (side profile 45 degree angle showing silhouette)' },
    { id: 'close', label: '🔍 Close-up Pose', desc: 'Fabric texture, lapel, buttons & stitching detail', batch: 1, angleText: 'close-up pose (fabric texture and lapel details shot in macro focus)' },
    { id: 'upper', label: '👤 Upper Pose', desc: 'Waist-up portrait, chest & collar focus', batch: 1, angleText: 'upper pose (waist-up portrait pose showing chest, collar and tie)' },
    { id: 'down', label: '🚶 Down / Full Pose', desc: 'Complete full length from shoulders to shoes', batch: 1, angleText: 'down pose (full length standing pose showing trousers and suit length)' }
];

const COMBO_5_POSES = [
    { id: 'all', label: '🌟 All 5 Poses Combo (5 Photos Set)', desc: 'Front, Back, Side, Close-up & Upper body ek saath', batch: 5, angleText: '' },
    { id: 'front', label: '🧍 Front View Pose', desc: 'Full standing front catalog view, complete outfit silhouette', batch: 1, angleText: 'Front View Pose (full standing front catalog view showing complete outfit silhouette)' },
    { id: 'back', label: '🔄 Back View Pose', desc: 'Full standing rear view, back fit and styling', batch: 1, angleText: 'Back View Pose (full standing rear view showing back fit and styling)' },
    { id: 'side', label: '📐 Side View Pose', desc: '45 degree side profile fashion angle showing posture and drape', batch: 1, angleText: 'Side View Pose (45 degree side profile fashion angle showing posture and drape)' },
    { id: 'close', label: '🔍 Close-up Macro Pose', desc: 'Macro texture, collar, buttons, lapels and fabric weave', batch: 1, angleText: 'Close-up Macro Pose (macro texture, collar, buttons, lapels and fabric weave focus)' },
    { id: 'upper', label: '👤 Upper Body Portrait Pose', desc: 'Waist-up professional catalog portrait showing face and chest', batch: 1, angleText: 'Upper Body Portrait Pose (waist-up professional catalog portrait showing face and chest)' }
];

const EMPTY = { task_type: 'image_to_image_prompt', prompt: '', aspect_ratio: '4:5', image_size: '', batch_count: 1, face_image_url: '', style_image_url: '', input_image_url: '', extra_image_urls: '', family_urls: ['', '', '', '', '', ''], conversation_id: '' };

export default function AiStudioCustomer() {
    const t = useT();
    const [anonKey, setAnonKey] = useState(API_KEY);
    const [sb, setSb] = useState(null);
    const [session, setSession] = useState(null);
    const [mode, setMode] = useState('login');      // 'login' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMsg, setAuthMsg] = useState('');
    const [screen, setScreen] = useState('new');    // 'new' | 'mine'
    const [form, setForm] = useState(EMPTY);
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState('');
    const [maint, setMaint] = useState(null);
    const [kinds, setKinds] = useState({});   // the task types this app shows, from the database
    const [familyRoles, setFamilyRoles] = useState([]);   // the family photo slots, from the database
    const [models, setModels] = useState([]);             // the AI models, from the database
    const [apps, setApps] = useState([]);                 // the apps (WearGen, PPP ...), from the database
    const [appId, setAppId] = useState(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const qApp = params.get('app');
            if (qApp) return qApp.toLowerCase();
            const match = window.location.pathname.match(/\/(customer|app)\/([a-zA-Z0-9_-]+)/);
            if (match && match[2] && match[2] !== 'customer') return match[2].toLowerCase();
            const stored = localStorage.getItem('ai_studio_customer_app_id');
            if (stored) return stored;
        } catch {}
        return 'weargen';
    });

    const handleAppChange = (newAppId) => {
        setAppId(newAppId);
        try {
            localStorage.setItem('ai_studio_customer_app_id', newAppId);
            const url = new URL(window.location.href);
            url.searchParams.set('app', newAppId);
            window.history.replaceState({}, '', url.toString());
        } catch {}
    };

    const [suitCategory, setSuitCategory] = useState('man');  // 'man' | 'woman' | 'kids' | 'custom'
    const [suitSelectedPose, setSuitSelectedPose] = useState('all'); // 'all' | 'front' | 'back' | 'side' | 'close' | 'upper' | 'down'
    const [comboSelectedPose, setComboSelectedPose] = useState('all'); // 'all' | 'front' | 'back' | 'side' | 'close' | 'upper'

    // Studio auto-defaults
    useEffect(() => {
        if (form.task_type === 'suit_studio') {
            if (!form.face_image_url && SUIT_STOCK_MODELS.man?.[0]) {
                setField('face_image_url', SUIT_STOCK_MODELS.man[0].url);
            }
            if (suitSelectedPose === 'all') {
                setField('batch_count', 6);
            }
        } else if (form.task_type === 'combo_5pose_studio') {
            if (comboSelectedPose === 'all') {
                setField('batch_count', 5);
            }
        }
    }, [form.task_type]);

    // The AI models come from the database (ai_studio_models)
    useEffect(() => {
        if (!sb) return;
        sb.rpc(API.GET_MODELS).then(({ data }) => { if (data) setModels(data); });
    }, [sb]);

    // The family photo slots come from the database; the form keeps one slot per role
    useEffect(() => {
        if (!sb) return;
        sb.rpc(API.GET_FAMILY_ROLES).then(({ data }) => {
            if (!data) return;
            setFamilyRoles(data);
            setForm(f => ({ ...f, family_urls: data.map((_, i) => f.family_urls[i] || '') }));
        });
    }, [sb]);

    // Load the task types from the database (ai_studio_task_catalog) once connected
    useEffect(() => {
        if (!sb) return;
        sb.rpc(API.GET_CATALOG).then(({ data }) => {
            if (!data) return;
            const map = toKinds(data);
            setKinds(map);
            setForm(f => (map[f.task_type] ? f : { ...EMPTY, task_type: Object.keys(map)[0] || f.task_type }));
        });
    }, [sb]);
    const [myTasks, setMyTasks] = useState([]);
    const [connecting, setConnecting] = useState(false);

    // The apps come from the database; the features shown are only the ones of the chosen app
    useEffect(() => {
        if (!sb) return;
        sb.rpc(API.GET_APPS).then(({ data }) => {
            if (!data?.length) return;
            setApps(data);
            setAppId(id => (data.some(a => a.app_id === id) ? id : data[0].app_id));
        });
    }, [sb]);
    const shownKinds = useMemo(() => {
        const currentApp = apps.find(a => a.app_id === appId);
        const appTaskTypes = currentApp?.task_types || [];
        return Object.fromEntries(
            Object.entries(kinds).filter(([taskType, k]) => {
                if (appTaskTypes.length > 0) {
                    return appTaskTypes.includes(taskType);
                }
                if (k.apps && k.apps.length > 0) {
                    return k.apps.includes(appId);
                }
                return true;
            })
        );
    }, [kinds, appId, apps]);
    // When the app changes, the form moves to the first feature of that app
    useEffect(() => {
        if (shownKinds[form.task_type]) return;
        const first = Object.keys(shownKinds)[0];
        if (first) setForm({ ...EMPTY, task_type: first });
    }, [shownKinds, form.task_type]);

    const kind = shownKinds[form.task_type] || EMPTY_KIND;
    // Prefer an enabled image model that has sizes set (so the Quality choice works); otherwise the first enabled one
    const imageModel = (models.find(m => m.kind === 'image' && m.enabled && m.sizes?.length) || models.find(m => m.kind === 'image' && m.enabled))?.model_id || '';
    const textModel = models.find(m => m.kind === 'text' && m.enabled)?.model_id || '';
    const imageCaps = models.find(m => m.model_id === imageModel);
    const aspects = imageCaps?.aspects?.length ? imageCaps.aspects : ['4:5'];
    const sizes = imageCaps?.sizes || [];
    // The default size comes from the database: the first size listed for the chosen model (ai_studio_models.sizes)
    const sizesKey = sizes.join(',');
    useEffect(() => {
        if (sizes.length && !sizes.includes(form.image_size)) setForm(f => ({ ...f, image_size: sizes[0] }));
    }, [sizesKey, form.image_size]);

    // Checks before sending (the server checks again)
    const problems = useMemo(() => {
        const p = [];
        for (const key of kind.inputs) {
            if (!kind.optional?.includes(key) && !form[INPUT_COLUMN[key]].trim()) p.push(t(`${labelFor(kind, key, t)} daalo`, `Add ${labelFor(kind, key, t)}`));
        }
        if (kind.promptRequired && !form.prompt.trim()) p.push(t('Prompt likho', 'Write a prompt'));
        if (kind.family && form.family_urls.filter(u => u.trim()).length < 2) p.push(t('Parivar ki kam se kam 2 photos daalo', 'Add at least 2 family photos'));
        if (form.batch_count < 1 || form.batch_count > 10) p.push(t('Photos 1 se 10 ke beech chuno', 'Choose between 1 and 10 photos'));
        return p;
    }, [form, kind, t]);

    // ── Connect + session ──
    const connect = () => {
        if (!anonKey) return setMsg(t('Server ki settings nahi mili. Admin se sampark karo.', 'Server settings are missing. Please contact the admin.'));
        setConnecting(true);
        setMsg('');
        loadClient(anonKey)
            .then(client => setSb(client))
            .catch(err => { console.error('Connect failed:', err); setMsg(t('Server se jud nahi paaye. Thodi der baad dobara try karo.', 'Could not reach the server. Please try again in a moment.')); })
            .finally(() => setConnecting(false));
    };
    // Connect as soon as the page opens, so the customer never has to press a start button
    useEffect(() => { connect(); }, []);

    useEffect(() => {
        if (!sb) return;
        sb.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, [sb]);

    const signIn = async () => {
        setAuthMsg('');
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setAuthMsg(t('Login nahi hua: ' + error.message, 'Login failed: ' + error.message));
        setPassword('');
    };

    // Login without email: a guest account (needs "Anonymous sign-ins" on in API Auth settings)
    const guestIn = async () => {
        setAuthMsg('');
        const { error } = await sb.auth.signInAnonymously();
        if (error) setAuthMsg(t('Bina email login nahi hua: ' + error.message, 'Login without email failed: ' + error.message));
    };

    const signUp = async () => {
        setAuthMsg('');
        const { error } = await sb.auth.signUp({ email, password });
        if (error) return setAuthMsg(t('Account nahi bana: ' + error.message, 'Could not create account: ' + error.message));
        setAuthMsg(t('Account ban gaya. Agar email verify karna ho to email check karo, phir login karo.', 'Account created. If email verification is needed, check your email, then log in.'));
        setMode('login');
        setPassword('');
    };

    const signOut = async () => { await sb.auth.signOut(); setMyTasks([]); };

    // ── My tasks (Strict RLS & app_id returns only this customer's rows for this app) ──
    const loadMine = useCallback(async () => {
        if (!sb || !session) return;
        const { data, error } = await customerApi('GET', '/api/customer/tasks?limit=50');
        if (!error && Array.isArray(data)) {
            const mapped = await Promise.all(data.map(async row => {
                let detail = taskDetailCache.get(row.publicId);
                if (!detail && row.status === 'completed') {
                    const d = await customerApi('GET', `/api/customer/tasks/${row.publicId}`);
                    if (!d.error && d.data) {
                        detail = { outputText: d.data.outputText || null, imagePaths: d.data.images || [] };
                        taskDetailCache.set(row.publicId, detail);
                    }
                }
                const urls = detail ? (await Promise.all(detail.imagePaths.map(authBlobUrl))).filter(Boolean) : [];
                return {
                    id: row.publicId,
                    app_id: appId,
                    task_type: row.taskType,
                    status: row.status,
                    error: row.errorCode || null,
                    created_at: row.createdAt,
                    finished_at: row.finishedAt,
                    output_text: detail?.outputText || null,
                    output_image_url: urls[0] || null,
                    output_image_urls: urls
                };
            }));
            setMyTasks(mapped);
        }
        const { data: s } = await customerApi('GET', '/api/customer/settings');
        setMaint(s?.maintenance_on ? s.maintenance_message : null);
    }, [sb, session, appId]);

    useEffect(() => {
        if (!sb || !session) return;
        loadMine();
        const timer = setInterval(loadMine, REFRESH_MS);
        const channel = sb.channel('ai-studio-customer')
            .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.TASKS }, () => loadMine())
            .subscribe();
        return () => { clearInterval(timer); sb.removeChannel(channel); };
    }, [sb, session, loadMine]);

    const deleteTask = async (taskId) => {
        if (!window.confirm(t('Kya aap is task ko database se delete karna chahte hain?', 'Do you want to permanently delete this task from the database?'))) return;
        try {
            if (sb) {
                const { error } = await customerApi('DELETE', `/api/customer/tasks/${taskId}`);
                if (error) throw new Error(error.message);
            }
            setMyTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err) {
            alert('Delete fail hua: ' + (err.message || err));
        }
    };

    const stopTask = async (taskId) => {
        try {
            if (sb) {
                const { error } = await customerApi('POST', `/api/customer/tasks/${taskId}/cancel`);
                if (error) throw new Error(error.message);
            }
            setMyTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed', error: 'Cancelled by user' } : t));
        } catch (err) {
            alert('Stop fail hua: ' + (err.message || err));
        }
    };

    // ── Form ──
    const setField = (name, value) => setForm(f => ({ ...f, [name]: value }));

    // Several photos at once (up to 10): each is compressed and uploaded, then the links go into the list
    const pickExtraFiles = async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 10);
        if (!files.length) return;
        setMsg(t(`${files.length} photo upload ho rahi hai...`, `Uploading ${files.length} photos...`));
        try {
            const urls = [];
            for (const f of files) urls.push(await uploadFile(f, t));
            const current = form.extra_image_urls.split('\n').map(s => s.trim()).filter(Boolean);
            setField('extra_image_urls', [...current, ...urls].slice(0, 10).join('\n'));
            setMsg(t('Photos upload ho gayi', 'Photos uploaded'));
        } catch (err) {
            console.error('Upload failed:', err);
            setMsg(t('Photo upload nahi hui. Dobara try karo.', 'Photo upload failed. Please try again.'));
        }
    };

    // Family photo slots
    const setFamilyUrl = (i, url) => setForm(f => ({ ...f, family_urls: f.family_urls.map((u, j) => (j === i ? url : u)) }));
    const pickFamilyFile = async (e, i) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMsg(t('Photo upload ho rahi hai...', 'Uploading photo...'));
        try {
            setFamilyUrl(i, await uploadFile(file, t));
            setMsg(t('Photo upload ho gayi', 'Photo uploaded'));
        } catch (err) {
            console.error('Upload failed:', err);
            setMsg(t('Photo upload nahi hui. Dobara try karo.', 'Photo upload failed. Please try again.'));
        }
    };

    // The brush mask is uploaded, then its link goes into the form
    const saveMask = async (dataUrl) => {
        setMsg(t('Area upload ho raha hai...', 'Uploading area...'));
        try {
            setField('style_image_url', await uploadDataUrl(dataUrl, t));
            setMsg(t('Area save ho gaya', 'Area saved'));
        } catch (err) {
            setMsg(t('Area upload nahi hua: ' + err.message, 'Area upload failed: ' + err.message));
        }
    };

    const pickFile = async (e, field) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setMsg(t('Photo upload ho rahi hai...', 'Uploading photo...'));
        try {
            const url = await uploadFile(file, t);
            setField(field, url);
            setMsg(t('Photo upload ho gayi', 'Photo uploaded'));
        } catch (err) {
            console.error('Upload failed:', err);
            setMsg(t('Photo upload nahi hui. Dobara try karo.', 'Photo upload failed. Please try again.'));
        }
    };

    const send = async () => {
        if (problems.length) return setMsg(problems.join(', '));
        setSending(true);
        setMsg('');
        const isImage = kind.output === 'image';
        let taskPrompt = form.prompt.trim() || null;
        let batchCount = isImage ? Number(form.batch_count) : 1;
        if (form.task_type === 'suit_studio') {
            if (suitSelectedPose === 'all') {
                batchCount = 6;
            } else {
                batchCount = 1;
                const chosen = SUIT_POSES.find(p => p.id === suitSelectedPose);
                if (chosen?.angleText) {
                    taskPrompt = (taskPrompt ? taskPrompt + '. ' : '') + `Camera angle: ${chosen.angleText}.`;
                }
            }
        } else if (form.task_type === 'combo_5pose_studio') {
            if (comboSelectedPose === 'all') {
                batchCount = 5;
            } else {
                batchCount = 1;
                const chosen = COMBO_5_POSES.find(p => p.id === comboSelectedPose);
                if (chosen?.angleText) {
                    taskPrompt = (taskPrompt ? taskPrompt + '. ' : '') + `Camera angle: ${chosen.angleText}.`;
                }
            }
        }

        if (tokenAppId() !== appId) {
            setSending(false);
            return setMsg(t(`Is app (${appId}) ke liye dobara login karein.`, `Please log in again for this app (${appId}).`));
        }
        // Each image URL goes to the server, which fetches it and returns an asset id.
        const toAsset = async (u) => {
            const clean = (u || '').trim();
            if (!clean) return { id: null };
            const r = await customerApi('POST', '/api/customer/assets/from-url', { url: clean });
            return r.error ? { error: r.error.message } : { id: r.data?.assetId || null };
        };
        const faceR = kind.inputs.includes('face') ? await toAsset(form.face_image_url) : { id: null };
        const styleR = kind.inputs.includes('style') ? await toAsset(form.style_image_url) : { id: null };
        const inputR = kind.inputs.includes('input') ? await toAsset(form.input_image_url) : { id: null };
        const extraUrls = kind.family
            ? form.family_urls.map((u, i) => ({ u: (u || '').trim(), role: familyRoles[i]?.role_key })).filter(x => x.u)
            : kind.extras ? form.extra_image_urls.split('\n').map(s => ({ u: s.trim(), role: null })).filter(x => x.u) : [];
        const extraR = await Promise.all(extraUrls.map(x => toAsset(x.u)));
        const failed = [faceR, styleR, inputR, ...extraR].find(r => r.error);
        if (failed) { setSending(false); return setMsg(t('Photo load nahi hui: ' + failed.error, 'Photo could not be loaded: ' + failed.error)); }

        const idempotencyKey = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 32);
        const body = {
            taskType: form.task_type,
            model: isImage ? imageModel : textModel,
            prompt: taskPrompt,
            aspectRatio: isImage ? form.aspect_ratio : null,
            imageSize: isImage && sizes.length ? form.image_size : null,
            batchCount,
            inputAssetId: inputR.id,
            faceAssetId: faceR.id,
            styleAssetId: styleR.id,
            extraAssetIds: extraR.map(r => r.id).filter(Boolean),
            familyRoleKeys: kind.family ? extraUrls.map(x => x.role).filter(Boolean) : null,
            idempotencyKey
        };
        const { error } = await customerApi('POST', '/api/customer/tasks', body);
        setSending(false);
        if (error) return setMsg(t('Kaam nahi bana: ' + error.message, 'Could not create task: ' + error.message));
        setMsg(t('Aapka kaam le liya gaya. Tayyar hone par yahin dikhega.', 'Your task has been received. It will show here when it is ready.'));
        setForm(f => ({ ...f, prompt: '' }));
        loadMine();
        // The result shows on this same page, just below the form
        setTimeout(() => document.getElementById('my-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    // ── Screens ──
    if (!sb) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-stone-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-end"><LangToggle /></div>
                    <h1 className="text-lg font-extrabold flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-300" /> AI Studio</h1>
                    {connecting
                        ? <p className="text-xs text-stone-400">{t('Connect ho raha hai...', 'Connecting...')}</p>
                        : <button onClick={connect} className="w-full h-10 bg-amber-400 text-stone-950 rounded-xl text-xs font-black">{t('Dobara try karo', 'Try again')}</button>}
                    {msg && <p className="text-xs text-amber-200">{msg}</p>}
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-stone-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-extrabold flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-300" /> {mode === 'login' ? t('Login karo', 'Log in') : t('Naya account banao', 'Create an account')}</h1>
                        <LangToggle />
                    </div>
                    <p className="text-xs text-stone-400">{mode === 'login' ? t('Apne email aur password se andar aao.', 'Use your email and password.') : t('Email aur password daalo.', 'Enter an email and password.')}</p>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full h-10 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full h-10 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs" />
                    {mode === 'login'
                        ? <button onClick={signIn} className="w-full h-10 bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-2"><LogIn className="w-4 h-4" /> Login</button>
                        : <button onClick={signUp} className="w-full h-10 bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-2"><UserPlus className="w-4 h-4" /> {t('Account banao', 'Create account')}</button>}
                    <button onClick={guestIn} className="w-full h-10 border border-white/10 bg-stone-800 rounded-xl text-xs font-bold">{t('Email ke bina shuru karo', 'Start without email')}</button>
                    <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setAuthMsg(''); }} className="w-full text-xs text-stone-400 underline">
                        {mode === 'login' ? t('Naya account banana hai?', 'New here? Create an account') : t('Pehle se account hai? Login karo', 'Already have an account? Log in')}
                    </button>
                    {authMsg && <p className="text-xs text-amber-200">{authMsg}</p>}
                    <details className="text-[11px] text-stone-500">
                        <summary className="cursor-pointer hover:text-stone-300">{t('Server settings (advanced)', 'Server settings (advanced)')}</summary>
                        <div className="pt-2"><BackendUrlField /></div>
                    </details>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-stone-100 p-4 sm:p-6 space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3 bg-[#161616]/60 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/20">
                        <Sparkles className="w-5 h-5 text-stone-950" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-white">
                                {apps.find(a => a.app_id === appId)?.label || appId} Studio
                            </h1>
                        </div>
                        <p className="text-[11px] text-stone-400">{session.user.email || t('Mera account', 'My account')}</p>
                    </div>
                </div>

                {/* App Selector if multiple apps exist */}
                {apps.length > 1 && (
                    <div className="flex items-center gap-1.5 p-1 bg-[#0a0a0a] border border-white/10 rounded-xl">
                        <span className="text-[11px] font-bold text-stone-400 px-2">App:</span>
                        {apps.map(a => {
                            const isSelected = a.app_id === appId;
                            return (
                                <button
                                    key={a.app_id}
                                    type="button"
                                    onClick={() => handleAppChange(a.app_id)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        isSelected
                                            ? 'bg-amber-400 text-stone-950 shadow-md font-black'
                                            : 'text-stone-300 hover:text-white hover:bg-[#161616]'
                                    }`}
                                >
                                    {a.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <LangToggle />
                    <button onClick={() => { setScreen('new'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="h-9 px-4 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap bg-amber-400 text-stone-950 border-amber-300">{t('Naya kaam', 'New task')}</button>
                    <button onClick={() => document.getElementById('my-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="h-9 px-4 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap bg-[#161616] border-white/10 text-stone-300 hover:text-white">{t('Mere results', 'My results')}</button>
                    <button onClick={signOut} title="Logout" className="h-9 px-3 rounded-xl text-xs font-bold border border-white/10 bg-[#161616] hover:bg-rose-500/20 text-stone-300 hover:text-rose-300 flex items-center gap-1.5 transition-colors"><LogOut className="w-3.5 h-3.5" /></button>
                </div>
            </header>

            {maint && <p className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{maint}</p>}
            {msg && <p className="text-xs text-amber-200 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2">{msg}</p>}

            {screen === 'new' && (
                <section className="mx-auto w-full max-w-2xl bg-[#0f0f0f] border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div>
                            <h2 className="text-sm font-extrabold text-white">{t('Kya banwana hai?', 'What do you want to make?')}</h2>
                            <p className="text-[11px] text-stone-400">
                                <span className="text-amber-300 font-bold">{apps.find(a => a.app_id === appId)?.label || appId}</span>
                            </p>
                        </div>
                    </div>

                    <select value={form.task_type} onChange={e => setForm({ ...EMPTY, task_type: e.target.value })} className="h-11 w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs">
                        {Object.entries(shownKinds).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                    </select>
                    <p className="text-[11px] text-stone-400">{kind.hint}</p>

                    {/* 👔 Specialized Suit Shop Studio Interface */}
                    {form.task_type === 'suit_studio' ? (
                        <div className="space-y-4 pt-1">
                            <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-stone-900 border border-amber-400/30 rounded-2xl p-4 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">👔</span>
                                    <h3 className="text-sm font-extrabold text-amber-300">Suit Shop Studio (Virtual Model Try-On)</h3>
                                </div>
                                <p className="text-[11px] text-stone-300">
                                    {t('Apne suit/outfit ki photo upload karein, Model chun kar Front, Back, Side, Close-up, Upper, Down poses me photoshoot banwayein.', 'Upload a photo of your suit/outfit, choose a model, and create a photoshoot in the Front, Back, Side, Close-up, Upper and Down poses.')}
                                </p>
                            </div>

                            {/* 1. Model Category Selector */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-stone-200">{t('1. Model Category Chunein (Kisko suit pehnana hai?)', '1. Choose model category (who will wear the suit?)')}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'man', label: '👨 Man Model', sub: 'Men Suit / Blazer' },
                                        { id: 'woman', label: '👩 Woman Model', sub: 'Ladies Suit / Dress' },
                                        { id: 'kids', label: '🧒 Kids Model', sub: 'Boy / Girl Kids Suit' },
                                        { id: 'custom', label: '📷 Custom Model', sub: t('Apna Model Upload', 'Upload your own model') }
                                    ].map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => {
                                                setSuitCategory(cat.id);
                                                if (cat.id !== 'custom' && SUIT_STOCK_MODELS[cat.id]?.[0]) {
                                                    setField('face_image_url', SUIT_STOCK_MODELS[cat.id][0].url);
                                                }
                                            }}
                                            className={`p-2.5 rounded-xl border text-left transition-all ${suitCategory === cat.id ? 'bg-amber-400/15 border-amber-400 text-amber-300' : 'bg-[#161616] border-white/10 text-stone-300 hover:border-white/20'}`}
                                        >
                                            <p className="text-xs font-bold">{cat.label}</p>
                                            <p className="text-[10px] text-stone-400">{cat.sub}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ready Stock Model Picker */}
                            {suitCategory !== 'custom' && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-stone-200">Ready-made AI Models ({suitCategory.toUpperCase()})</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(SUIT_STOCK_MODELS[suitCategory] || []).map(m => {
                                            const isSelected = form.face_image_url === m.url;
                                            return (
                                                <div
                                                    key={m.id}
                                                    onClick={() => setField('face_image_url', m.url)}
                                                    className={`cursor-pointer rounded-xl border p-2 flex items-center gap-3 transition-all ${isSelected ? 'bg-amber-400/15 border-amber-400' : 'bg-[#0a0a0a] border-white/10 hover:border-white/30'}`}
                                                >
                                                    <img src={m.url} alt={m.name} className="w-12 h-12 rounded-lg object-cover" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-stone-200 truncate">{m.name}</p>
                                                        <p className="text-[10px] text-emerald-400">{isSelected ? '✓ Selected Model' : 'Click to Select'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Model Photo Input (Custom or Override) */}
                            <PhotoField
                                label={suitCategory === 'custom' ? t('Model ki photo', 'Model photo') : t('Model ki photo (chahe to badal sakte ho)', 'Model photo (you can change it)')}
                                value={form.face_image_url}
                                onUrl={v => setField('face_image_url', v)}
                                onFile={e => pickFile(e, 'face_image_url')}
                                placeholder={t('Model photo ka link', 'Model photo link')}
                            />

                            {/* 2. Suit / Garment Upload Area */}
                            <div className="space-y-1.5 p-3.5 rounded-2xl bg-[#0a0a0a] border border-amber-400/30">
                                <PhotoField
                                    label={<span className="text-amber-300">👔 {t('2. Aapke suit / outfit ki photo (zaroori)', '2. Your suit / outfit photo (required)')}</span>}
                                    hint={t('Shop ke suit, blazer, kurti, coat-pant ya dress ki saaf photo.', 'A clear photo of the shop suit, blazer, kurti, coat-pant or dress.')}
                                    value={form.style_image_url}
                                    onUrl={v => setField('style_image_url', v)}
                                    onFile={e => pickFile(e, 'style_image_url')}
                                    placeholder={t('Suit photo ka link', 'Suit photo link')}
                                />
                            </div>

                            {/* 3. Pose & Angle Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-stone-200">{t('3. Photoshoot Poses Chunein', '3. Choose photoshoot poses')}</p>
                                    <span className="text-[11px] text-amber-300 font-mono">
                                        {suitSelectedPose === 'all' ? '6 Photos (Batch)' : '1 Photo (Single Pose)'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {SUIT_POSES.map(p => {
                                        const isAct = suitSelectedPose === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setSuitSelectedPose(p.id);
                                                    setField('batch_count', p.batch);
                                                }}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${isAct ? 'bg-amber-400/15 border-amber-400 text-amber-300' : 'bg-[#0a0a0a] border-white/10 text-stone-300 hover:border-white/20'}`}
                                            >
                                                <p className="text-xs font-bold flex items-center justify-between">
                                                    <span>{p.label}</span>
                                                    {isAct && <span className="text-[10px] bg-amber-400 text-stone-950 px-1.5 py-0.5 rounded font-bold">Selected</span>}
                                                </p>
                                                <p className="text-[10px] text-stone-400 mt-0.5">{p.id === 'all' ? t('Front, Back, Side, Close-up, Upper, Down sab ek saath', 'Front, Back, Side, Close-up, Upper, Down all together') : p.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : form.task_type === 'combo_5pose_studio' ? (
                        <div className="space-y-4 pt-1">
                            {/* Banner */}
                            <div className="bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-stone-900 border border-emerald-400/30 rounded-2xl p-4 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">📸</span>
                                    <h3 className="text-sm font-extrabold text-emerald-300">5-Pose Combo Catalog Studio</h3>
                                </div>
                                <p className="text-[11px] text-stone-300">
                                    {t('Photo upload karein aur 5 alag-alag commercial poses payein: Front view, Back view, Side view, Close-up macro detail, aur Upper body portrait.', 'Upload a photo and get 5 different commercial poses: Front view, Back view, Side view, Close-up macro detail, and Upper body portrait.')}
                                </p>
                            </div>

                            {/* Person / Model Photo Input */}
                            <PhotoField
                                label={t('1. Person / model ki photo (zaroori)', '1. Person / model photo (required)')}
                                value={form.face_image_url}
                                onUrl={v => setField('face_image_url', v)}
                                onFile={e => pickFile(e, 'face_image_url')}
                                placeholder={t('Model / person photo ka link', 'Model / person photo link')}
                            />

                            {/* Outfit Photo (Optional) */}
                            <div className="space-y-1.5">
                                <PhotoField
                                    label={t('2. Outfit / suit ki photo', '2. Outfit / suit photo')}
                                    optional
                                    hint={t('Naye kapde pehnane ho to photo daalo. Nahi to khali chhod do.', 'Add a photo if you want new clothes. Otherwise leave it empty.')}
                                    value={form.style_image_url}
                                    onUrl={v => setField('style_image_url', v)}
                                    onFile={e => pickFile(e, 'style_image_url')}
                                    placeholder={t('Outfit photo ka link', 'Outfit photo link')}
                                />
                            </div>

                            {/* Pose Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-stone-200">{t('3. Pose Mode Chunein', '3. Choose pose mode')}</p>
                                    <span className="text-[11px] text-emerald-300 font-mono">
                                        {comboSelectedPose === 'all' ? '5 Photos (Complete Set)' : '1 Photo (Single Pose)'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {COMBO_5_POSES.map(p => {
                                        const isAct = comboSelectedPose === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setComboSelectedPose(p.id);
                                                    setField('batch_count', p.batch);
                                                }}
                                                className={`p-2.5 rounded-xl border text-left transition-all ${isAct ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300' : 'bg-[#0a0a0a] border-white/10 text-stone-300 hover:border-white/20'}`}
                                            >
                                                <p className="text-xs font-bold flex items-center justify-between">
                                                    <span>{p.label}</span>
                                                    {isAct && <span className="text-[10px] bg-emerald-400 text-stone-950 px-1.5 py-0.5 rounded font-bold">Selected</span>}
                                                </p>
                                                <p className="text-[10px] text-stone-400 mt-0.5">{p.id === 'all' ? t('Front, Back, Side, Close-up & Upper body ek saath', 'Front, Back, Side, Close-up & Upper body all together') : p.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        kind.inputs.map(key => kind.edit && key === 'style' ? (
                            <MaskBlock key={key} label={labelFor(kind, key, t)} photoUrl={form.face_image_url} maskUrl={form.style_image_url} onSave={saveMask} />
                        ) : (
                            <PhotoField
                                key={key}
                                label={labelFor(kind, key, t)}
                                optional={kind.optional?.includes(key)}
                                value={form[INPUT_COLUMN[key]]}
                                onUrl={v => setField(INPUT_COLUMN[key], v)}
                                onFile={e => pickFile(e, INPUT_COLUMN[key])}
                                placeholder={t('Photo ka link', 'Photo link')}
                            />
                        ))
                    )}

                    {kind.family && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-stone-200">{t('Parivar ke members (jo nahi hai use khali chhodo)', 'Family members (leave empty if not needed)')}</p>
                            {familyRoles.map((role, i) => (
                                <PhotoField
                                    key={role.role_key}
                                    label={role.label_customer}
                                    optional
                                    value={form.family_urls[i]}
                                    onUrl={v => setFamilyUrl(i, v)}
                                    onFile={e => pickFamilyFile(e, i)}
                                    placeholder={t(`${role.label_customer} ka photo link`, `${role.label_customer} photo link`)}
                                />
                            ))}
                        </div>
                    )}

                    {kind.extras && !kind.family && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-stone-200">{t('Aur photos (optional, ek saath 10 tak chuno)', 'More photos (optional, choose up to 10 at once)')}</p>
                            <label className="h-9 px-4 inline-flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 border border-white/10 rounded-xl text-xs font-bold cursor-pointer">
                                <Upload className="w-3.5 h-3.5" /> {t('Photos chuno', 'Choose photos')}
                                <input type="file" accept="image/*" multiple className="hidden" onChange={pickExtraFiles} />
                            </label>
                            {form.extra_image_urls.split('\n').some(s => s.trim()) && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {form.extra_image_urls.split('\n').map(s => s.trim()).filter(Boolean).map((u, i) => (
                                        <img key={u + i} src={u} alt="" className="h-16 w-14 rounded-lg object-cover border border-white/10" />
                                    ))}
                                    <button type="button" onClick={() => setField('extra_image_urls', '')} className="text-[11px] text-stone-400 hover:text-rose-300 underline">{t('Sab hatao', 'Remove all')}</button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <p className="text-xs font-bold text-stone-200">{kind.promptRequired ? t('Aap kya chahte ho? (zaroori)', 'What do you want? (required)') : t('Kuch khas chahiye? (optional)', 'Anything special? (optional)')}</p>
                        <textarea value={form.prompt} onChange={e => setField('prompt', e.target.value)} rows={3} placeholder={t('Jaise: cafe mein baith kar chai pite hue, halki roshni', 'For example: sipping tea in a cafe, soft light')} className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-xs" />
                    </div>

                    {form.task_type === 'chat' && (
                        <input value={form.conversation_id} onChange={e => setField('conversation_id', e.target.value)} placeholder={t('Chat ka naam (same naam = wahi baat aage badhegi)', 'Chat name (same name = continues the same conversation)')} className="h-10 w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs" />
                    )}

                    {kind.output === 'image' && (
                        <details className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3">
                            <summary className="cursor-pointer text-xs font-bold text-stone-300">{t('Aur options (zaroori nahi)', 'More options (optional)')}</summary>
                            <div className="grid gap-3 sm:grid-cols-3 pt-3">
                                <label className="space-y-1 text-[11px] text-stone-300">{t('Shape (size)', 'Shape (size)')}
                                    <select value={form.aspect_ratio} onChange={e => setField('aspect_ratio', e.target.value)} className="h-10 w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs">
                                        {aspects.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 text-[11px] text-stone-300">{t('Quality', 'Quality')}
                                    <select value={form.image_size} onChange={e => setField('image_size', e.target.value)} className="h-10 w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs">
                                        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 text-[11px] text-stone-300">{t('Kitni photos (1 se 10)', 'How many photos (1 to 10)')}
                                    <input type="number" min={1} max={10} value={form.batch_count} onChange={e => setField('batch_count', Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className="h-10 w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 text-xs" />
                                </label>
                            </div>
                        </details>
                    )}

                    {problems.length > 0 && (
                        <ul className="text-xs text-rose-300 space-y-1">{problems.map(p => <li key={p}>• {p}</li>)}</ul>
                    )}

                    <button onClick={send} disabled={sending || problems.length > 0 || !!maint} className="h-11 px-6 bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-40">
                        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t('Banwao', 'Create')}
                    </button>
                </section>
            )}

            {/* My results: always on this page, below the form (no separate screen) */}
            {(
                <section id="my-results" className="space-y-4 scroll-mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161616]/40 border border-white/5 rounded-2xl p-4">
                        <div>
                            <h2 className="text-sm font-extrabold flex items-center gap-2">
                                <span>{t('Mere results', 'My results')}</span>
                                <span className="text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                                    {apps.find(a => a.app_id === appId)?.label || appId} ({myTasks.length})
                                </span>
                            </h2>
                            <p className="text-[11px] text-stone-400">{t('Sirf aapke is app ke tasks aur generated outputs', 'Only your tasks and generated outputs for this app')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadMine}
                            className="h-8 px-3 rounded-xl bg-[#161616] hover:bg-stone-800 border border-white/10 text-xs font-bold flex items-center gap-1.5 text-stone-300 transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> {t('Refresh', 'Refresh')}
                        </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {myTasks.map(task => {
                            const st = STATUS_TEXT[task.status] || STATUS_TEXT.pending;
                            const Icon = st.icon;
                            const photos = task.output_image_urls?.length ? task.output_image_urls : (task.output_image_url ? [task.output_image_url] : []);
                            return (
                                <div key={task.id} className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-amber-300">#{task.id}</span>
                                            <span className="text-xs font-bold text-stone-200">{kinds[task.task_type]?.label || task.task_type} <span className="text-[10px] font-normal text-stone-500">· {apps.find(a => a.app_id === task.app_id)?.label || task.app_id}</span></span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${st.cls}`}><Icon className="w-3 h-3" /> {t(st.text, st.en)}</span>
                                            {(task.status === 'pending' || task.status === 'processing') && (
                                                <button
                                                    type="button"
                                                    onClick={() => stopTask(task.id)}
                                                    className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[10px] font-bold flex items-center gap-1"
                                                    title={t('Task rokein', 'Stop task')}
                                                >
                                                    <Square className="w-2.5 h-2.5 fill-current" /> Stop
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => deleteTask(task.id)}
                                                className="p-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-[10px] transition-colors"
                                                title={t('Database se permanently delete karein', 'Delete permanently from database')}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    {task.prompt && <p className="text-[11px] text-stone-400 line-clamp-2">{task.prompt}</p>}
                                    {task.status === 'failed' && <p className="text-[11px] text-rose-300">{t('Kuch galat ho gaya. Dobara koshish karo ya prompt badlo.', 'Something went wrong. Try again or change the prompt.')}</p>}
                                    {(task.status === 'pending' || task.status === 'processing') && (
                                        <LiveTimer since={task.created_at} estimateSec={typicalSeconds(task.task_type, myTasks)} />
                                    )}
                                    {task.status === 'done' && task.duration_ms > 0 && (
                                        <p className="text-[11px] text-emerald-300">{t(`Ye ${fmtDuration(Math.round(task.duration_ms / 1000))} mein bana`, `Made in ${fmtDuration(Math.round(task.duration_ms / 1000))}`)}</p>
                                    )}
                                    {/* Before / after: the photo you sent next to the first result */}
                                    {task.task_type === 'suit_studio' && (task.face_image_url || task.style_image_url) && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {task.style_image_url && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-amber-300 font-bold">👔 Suit Photo</p>
                                                    <img src={task.style_image_url} alt="Suit" loading="lazy" className="w-full aspect-[4/5] object-cover rounded-xl border border-amber-400/20" />
                                                </div>
                                            )}
                                            {task.face_image_url && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-stone-300 font-bold">👤 Model Photo</p>
                                                    <img src={task.face_image_url} alt="Model" loading="lazy" className="w-full aspect-[4/5] object-cover rounded-xl border border-white/10" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {task.task_type !== 'suit_studio' && photos.length > 0 && (task.face_image_url || task.input_image_url) && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-stone-400">{t('Pehle', 'Before')}</p>
                                                <img src={task.face_image_url || task.input_image_url} alt="" loading="lazy" className="w-full aspect-[4/5] object-cover rounded-xl" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-stone-400">{t('Baad mein', 'After')}</p>
                                                <img src={photos[0]} alt="" loading="lazy" className="w-full aspect-[4/5] object-cover rounded-xl" />
                                            </div>
                                        </div>
                                    )}
                                    {photos.map((url, i) => (
                                        <div key={i} className="space-y-2">
                                            <img src={url} alt="" loading="lazy" className="w-full aspect-[4/5] object-cover rounded-xl" />
                                            <a href={url} target="_blank" rel="noreferrer" download className="h-9 w-full flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold"><Download className="w-3.5 h-3.5" /> {t('Photo download karo', 'Download photo')}</a>
                                        </div>
                                    ))}
                                    {task.output_text && (
                                        <div className="space-y-1.5 bg-black/40 border border-emerald-500/20 rounded-xl p-3">
                                            <p className="text-[10px] text-emerald-300 font-bold flex items-center gap-1.5 uppercase tracking-wide">
                                                <MessageSquare className="w-3 h-3 text-emerald-400" /> {t('Jawab', 'Response')}
                                            </p>
                                            <div className="text-xs text-stone-100 whitespace-pre-wrap max-h-60 overflow-auto font-sans leading-relaxed select-text">
                                                {task.output_text}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {myTasks.length === 0 && <p className="text-center text-xs text-stone-500 py-10">{t('Abhi aapka koi kaam nahi. "Naya kaam" se shuru karo.', 'You have no tasks yet. Start with "New task".')}</p>}
                </section>
            )}

        </div>
    );
}
