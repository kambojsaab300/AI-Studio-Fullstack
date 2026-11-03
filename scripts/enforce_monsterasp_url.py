import os

files = [
    r"E:\Mohit\photo tool\AI Studio\app\AI Studio Worker.jsx",
    r"E:\Mohit\photo tool\AI Studio\app\AI Studio Admin.jsx",
    r"E:\Mohit\photo tool\AI Studio\app\AI Studio Customer.jsx",
    r"E:\Mohit\photo tool\AI Studio\app\apiClient.js",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\AI Studio Worker.jsx",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\AI Studio Admin.jsx",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\AI Studio Customer.jsx",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app\apiClient.js"
]

clean_get_effective = """function getEffectiveApiUrl(providedUrl) {
    if (typeof window !== 'undefined') {
        const queryApi = new URLSearchParams(window.location.search).get('api');
        if (queryApi) {
            try { localStorage.setItem('aistudio_api_url', queryApi); } catch { }
            return queryApi.replace(/\\/$/, "");
        }
        try {
            const savedApi = localStorage.getItem('aistudio_api_url');
            if (savedApi) {
                if (savedApi.includes('trycloudflare.com')) {
                    try { localStorage.removeItem('aistudio_api_url'); } catch { }
                } else {
                    return savedApi.replace(/\\/$/, "");
                }
            }
        } catch { }
        if (providedUrl) {
            return providedUrl.replace(/\\/$/, "");
        }
    }
    return (providedUrl || "http://aistudio.runasp.net").replace(/\\/$/, "");
}"""

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace getEffectiveApiUrl body
    start = content.find("function getEffectiveApiUrl(providedUrl) {")
    if start != -1:
        end = content.find("function createClient(", start)
        if end != -1:
            content = content[:start] + clean_get_effective + "\n\n" + content[end:]

    # Remove Cloudflare preset button in Worker if present
    content = content.replace("https://chair-republicans-baghdad-copied.trycloudflare.com", "http://aistudio.runasp.net")
    content = content.replace("HTTPS Cloudflare", "Reset Default")

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Updated to strictly use http://aistudio.runasp.net:", fpath)

print("Done.")
