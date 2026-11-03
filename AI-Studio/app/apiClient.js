// ============================================================
// AI Studio: .NET Core API Client (Full Supabase Drop-in Replacement)
// ============================================================

const DEFAULT_API_URL = "https://pilot-zealand-subject-guitars.trycloudflare.com";

export function getEffectiveApiUrl(providedUrl) {
    if (typeof window !== 'undefined') {
        const queryApi = new URLSearchParams(window.location.search).get('api');
        if (queryApi) {
            try { localStorage.setItem('aistudio_api_url', queryApi); } catch { }
            return queryApi.replace(/\/$/, "");
        }
        try {
            const savedApi = localStorage.getItem('aistudio_api_url');
            if (savedApi) return savedApi.replace(/\/$/, "");
        } catch { }

        // If provided a custom remote URL (not localhost), use it
        if (providedUrl && !providedUrl.includes('localhost') && !providedUrl.includes('127.0.0.1')) {
            return providedUrl.replace(/\/$/, "");
        }

        // When accessing from a mobile / tunnel / remote hostname:
        if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            if (window.__AI_STUDIO_API_URL__) return window.__AI_STUDIO_API_URL__.replace(/\/$/, "");
            if (window.location.hostname.endsWith('.loca.lt')) {
                return 'https://aistudio-api.loca.lt';
            }
        }
    }
    return (providedUrl || DEFAULT_API_URL).replace(/\/$/, "");
}

class QueryBuilder {
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

    gt(column, value) {
        this.params.append(column, `gt.${value}`);
        return this;
    }

    gte(column, value) {
        this.params.append(column, `gte.${value}`);
        return this;
    }

    lt(column, value) {
        this.params.append(column, `lt.${value}`);
        return this;
    }

    lte(column, value) {
        this.params.append(column, `lte.${value}`);
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
                if (parts.length > 1) {
                    countVal = parseInt(parts[1], 10) || 0;
                }
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
            if (countVal === 0 && Array.isArray(data)) {
                countVal = data.length;
            }

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
        return this._fetch(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async update(data) {
        const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
        return this._fetch(url, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async delete() {
        const url = `${this.apiUrl}/rest/v1/${this.table}?${this.params.toString()}`;
        return this._fetch(url, {
            method: 'DELETE'
        });
    }
}

export function createClient(apiUrl = DEFAULT_API_URL, apiKey = "") {
    const url = getEffectiveApiUrl(apiUrl);
    let token = localStorage.getItem('aistudio_token') || "";
    let currentUser = null;
    try {
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
                        headers: {
                            'Content-Type': 'application/json',
                            'Bypass-Tunnel-Reminder': 'true'
                        },
                        body: JSON.stringify({ email, password })
                    });
                    const json = await res.json();
                    if (!res.ok) {
                        return { data: null, error: { message: json.error || 'Login fail hua.' } };
                    }
                    token = json.access_token;
                    currentUser = json.user;
                    localStorage.setItem('aistudio_token', token);
                    localStorage.setItem('aistudio_user', JSON.stringify(currentUser));
                    authListeners.forEach(cb => cb('SIGNED_IN', { user: currentUser, access_token: token }));
                    return { data: { user: currentUser, session: { access_token: token, user: currentUser } }, error: null };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },

            async signInAnonymously() {
                const guestEmail = `guest_${Date.now()}@aistudio.local`;
                const guestPass = "Guest@123456";
                return this.signUp({ email: guestEmail, password: guestPass });
            },

            async signUp({ email, password }) {
                try {
                    const res = await fetch(`${url}/api/auth/signup`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Bypass-Tunnel-Reminder': 'true'
                        },
                        body: JSON.stringify({ email, password })
                    });
                    const json = await res.json();
                    if (!res.ok) {
                        return { data: null, error: { message: json.error || 'Signup fail hua.' } };
                    }
                    token = json.access_token;
                    currentUser = json.user;
                    localStorage.setItem('aistudio_token', token);
                    localStorage.setItem('aistudio_user', JSON.stringify(currentUser));
                    authListeners.forEach(cb => cb('SIGNED_IN', { user: currentUser, access_token: token }));
                    return { data: { user: currentUser, session: { access_token: token, user: currentUser } }, error: null };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },

            async signOut() {
                token = "";
                currentUser = null;
                localStorage.removeItem('aistudio_token');
                localStorage.removeItem('aistudio_user');
                authListeners.forEach(cb => cb('SIGNED_OUT', null));
                return { error: null };
            },

            async getSession() {
                if (token && currentUser) {
                    return { data: { session: { access_token: token, user: currentUser } }, error: null };
                }
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
            return new QueryBuilder(url, table, token);
        },

        async rpc(functionName, params = {}) {
            try {
                const res = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Bypass-Tunnel-Reminder': 'true',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(params || {})
                });

                const text = await res.text();
                if (!res.ok) {
                    let errObj;
                    try { errObj = JSON.parse(text); } catch { errObj = { message: text }; }
                    return { data: null, error: errObj };
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch {
                    data = text;
                }
                return { data, error: null };
            } catch (err) {
                return { data: null, error: { message: err.message } };
            }
        },

        channel(name) {
            const ch = {
                name,
                on(event, filter, callback) {
                    return ch;
                },
                subscribe() {
                    return ch;
                }
            };
            return ch;
        },

        removeChannel(ch) { }
    };
}

if (typeof window !== 'undefined') {
    window.supabase = { createClient };
    window.AIStudioApi = { createClient };
}

export default { createClient };
