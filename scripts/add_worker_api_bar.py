import os

files = [
    r"E:\Mohit\photo tool\AI Studio\app\AI Studio Worker.jsx",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\AI Studio Worker.jsx"
]

HTTPS_PRESET = "https://chair-republicans-baghdad-copied.trycloudflare.com"

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add customApiUrl state
    old_state = "    const [apiKey, setApiKey] = useState(API_KEY);"
    new_state = "    const [apiKey, setApiKey] = useState(API_KEY);\n    const [customApiUrl, setCustomApiUrl] = useState(() => getEffectiveApiUrl(API_URL));"
    if old_state in content and "customApiUrl" not in content:
        content = content.replace(old_state, new_state)

    # 2. Add API URL bar under header
    old_header_needle = "</header>"

    bar_html = """</header>

            {/* API URL Switcher Bar */}
            <div className="bg-stone-900/90 border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    <span className="text-stone-400 font-mono text-[11px] whitespace-nowrap">API URL:</span>
                    <input
                        type="text"
                        value={customApiUrl}
                        onChange={(e) => {
                            const val = e.target.value;
                            setCustomApiUrl(val);
                            try { localStorage.setItem('aistudio_api_url', val); } catch {}
                        }}
                        placeholder="https://..."
                        className="flex-1 bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-yellow-400"
                    />
                    <button
                        type="button"
                        onClick={connect}
                        className="px-3 py-1 bg-yellow-400 text-stone-950 font-bold rounded-lg hover:bg-yellow-300"
                    >
                        Re-Connect
                    </button>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-stone-500">Presets:</span>
                    <button
                        type="button"
                        onClick={() => {
                            const u = \"""" + HTTPS_PRESET + """\";
                            setCustomApiUrl(u);
                            try { localStorage.setItem('aistudio_api_url', u); } catch {}
                            libRef_connect(u);
                        }}
                        className="text-amber-400 hover:underline font-mono"
                    >
                        HTTPS Cloudflare
                    </button>
                    <span className="text-stone-700">|</span>
                    <button
                        type="button"
                        onClick={() => {
                            const u = "http://aistudio.runasp.net";
                            setCustomApiUrl(u);
                            try { localStorage.setItem('aistudio_api_url', u); } catch {}
                            libRef_connect(u);
                        }}
                        className="text-emerald-400 hover:underline font-mono"
                    >
                        MonsterASP (HTTP)
                    </button>
                </div>
            </div>"""

    if "API URL Switcher Bar" not in content and old_header_needle in content:
        content = content.replace(old_header_needle, bar_html, 1)

    # 3. Helper for immediate reconnect on preset click
    if "const libRef_connect" not in content and "const connect = async () => {" in content:
        content = content.replace(
            "const connect = async () => {",
            """const libRef_connect = async (targetUrl) => {
        try {
            const lib = await loadApiClient();
            const client = lib.createClient(targetUrl || customApiUrl || API_URL, apiKey);
            log(`Connecting to ${client.apiUrl}...`);
            const wanted = sessionStorage.getItem('ai_studio_worker_id');
            const { data, error } = await client.rpc(API.REGISTER_WORKER, { p_wanted: wanted });
            if (error) throw error;
            sessionStorage.setItem('ai_studio_worker_id', data);
            workerIdRef.current = data;
            setWorkerId(data);
            await loadSettings(client);
            setSb(client);
            log(`Connected as ${data}`);
        } catch (err) {
            log('Connect error: ' + err.message);
        }
    };

    const connect = async () => {
        return libRef_connect(customApiUrl || API_URL);
    };"""
        )

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Updated Worker UI in:", fpath)

print("Done.")
