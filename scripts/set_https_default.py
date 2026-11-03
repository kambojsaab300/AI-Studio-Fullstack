import os

target_dirs = [
    r"E:\Mohit\photo tool\AI Studio\app",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app"
]

HTTP_URL = "http://aistudio.runasp.net"
HTTPS_URL = "https://aistudio.runasp.net"

# 1. Update apiClient.js
for d in target_dirs:
    fpath = os.path.join(d, "apiClient.js")
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace(HTTP_URL, HTTPS_URL)
        # Auto-upgrade stored http to https
        content = content.replace(
            "return savedApi.replace(/\\/$/, \"\");",
            "return (savedApi === 'http://aistudio.runasp.net' ? 'https://aistudio.runasp.net' : savedApi).replace(/\\/$/, \"\");"
        )
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated apiClient.js in:", d)

# 2. Update AI Studio Worker.jsx
worker_bar_html = """            {/* ⚙️ Top API Settings Bar */}
            <div className="bg-stone-900 border border-yellow-400/20 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
                <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                    <span className="flex items-center gap-1.5 font-bold text-yellow-300 text-xs whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        API Endpoint:
                    </span>
                    <input
                        type="text"
                        value={customApiUrl}
                        onChange={(e) => {
                            const val = e.target.value.trim();
                            setCustomApiUrl(val);
                            try { localStorage.setItem('aistudio_api_url', val); } catch {}
                        }}
                        placeholder="https://aistudio.runasp.net"
                        className="flex-1 bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-yellow-400"
                    />
                    <button
                        type="button"
                        onClick={() => connect(customApiUrl)}
                        className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-stone-950 font-bold rounded-xl transition-all text-xs"
                    >
                        Save & Connect
                    </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span>Default:</span>
                    <button
                        type="button"
                        onClick={() => {
                            const u = "https://aistudio.runasp.net";
                            setCustomApiUrl(u);
                            try { localStorage.setItem('aistudio_api_url', u); } catch {}
                            connect(u);
                        }}
                        className="font-mono text-yellow-300 hover:underline font-bold"
                    >
                        https://aistudio.runasp.net
                    </button>
                </div>
            </div>"""

for d in target_dirs:
    fpath = os.path.join(d, "AI Studio Worker.jsx")
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        # Replace all http://aistudio.runasp.net with https://aistudio.runasp.net
        content = content.replace(HTTP_URL, HTTPS_URL)

        # Replace the top API URL bar with the new styled one
        start_bar = content.find("{/* API URL Switcher Bar */}")
        if start_bar == -1:
            start_bar = content.find("{/* ⚙️ Top API Settings Bar */}")
        if start_bar != -1:
            end_bar = content.find("{/* Numbers */}", start_bar)
            if end_bar != -1:
                content = content[:start_bar] + worker_bar_html + "\n\n            " + content[end_bar:]

        # Auto-upgrade stored http to https in getEffectiveApiUrl
        content = content.replace(
            "return savedApi.replace(/\\/$/, \"\");",
            "return (savedApi === 'http://aistudio.runasp.net' ? 'https://aistudio.runasp.net' : savedApi).replace(/\\/$/, \"\");"
        )

        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated AI Studio Worker.jsx in:", d)

# 3. Update AI Studio Admin.jsx
for d in target_dirs:
    fpath = os.path.join(d, "AI Studio Admin.jsx")
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        content = content.replace(HTTP_URL, HTTPS_URL)
        content = content.replace(
            "return savedApi.replace(/\\/$/, \"\");",
            "return (savedApi === 'http://aistudio.runasp.net' ? 'https://aistudio.runasp.net' : savedApi).replace(/\\/$/, \"\");"
        )

        # Add customApiUrl state if missing
        if "const [customApiUrl, setCustomApiUrl]" not in content:
            content = content.replace(
                "const [apiKey, setApiKey] = useState(API_KEY);",
                "const [apiKey, setApiKey] = useState(API_KEY);\n    const [customApiUrl, setCustomApiUrl] = useState(() => getEffectiveApiUrl(API_URL));"
            )

        # Update connect in Admin
        content = content.replace(
            "loadApiClient(apiKey).then(client => {",
            "loadApiClient(apiKey, customApiUrl).then(client => {"
        )
        content = content.replace(
            "function loadApiClient(apiKey) {",
            "function loadApiClient(apiKey, targetUrl) {\n    return Promise.resolve(createClient(targetUrl || API_URL, apiKey));\n}\nfunction _unused_loadApiClient(apiKey) {"
        )

        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated AI Studio Admin.jsx in:", d)

# 4. Update AI Studio Customer.jsx
for d in target_dirs:
    fpath = os.path.join(d, "AI Studio Customer.jsx")
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        content = content.replace(HTTP_URL, HTTPS_URL)
        content = content.replace(
            "return savedApi.replace(/\\/$/, \"\");",
            "return (savedApi === 'http://aistudio.runasp.net' ? 'https://aistudio.runasp.net' : savedApi).replace(/\\/$/, \"\");"
        )

        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated AI Studio Customer.jsx in:", d)

print("All files updated with https://aistudio.runasp.net successfully.")
