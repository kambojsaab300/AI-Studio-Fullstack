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

HTTPS_TUNNEL = "https://chair-republicans-baghdad-copied.trycloudflare.com"

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update getEffectiveApiUrl to handle HTTPS protocol automatically
    old_proto_check = """        if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            if (window.__AI_STUDIO_API_URL__) return window.__AI_STUDIO_API_URL__.replace(/\\/$/, "");
            if (window.location.hostname.endsWith('.loca.lt')) return 'https://aistudio-api.loca.lt';
            return 'http://aistudio.runasp.net';
        }"""
    
    new_proto_check = f"""        if (window.location.protocol === 'https:') {{
            if (window.__AI_STUDIO_API_URL__) return window.__AI_STUDIO_API_URL__.replace(/\\/$/, "");
            return '{HTTPS_TUNNEL}';
        }}
        if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {{
            if (window.__AI_STUDIO_API_URL__) return window.__AI_STUDIO_API_URL__.replace(/\\/$/, "");
            if (window.location.hostname.endsWith('.loca.lt')) return 'https://aistudio-api.loca.lt';
            return 'http://aistudio.runasp.net';
        }}"""
    
    if old_proto_check in content:
        content = content.replace(old_proto_check, new_proto_check)
    else:
        old_proto_check_crlf = old_proto_check.replace("\n", "\r\n")
        new_proto_check_crlf = new_proto_check.replace("\n", "\r\n")
        if old_proto_check_crlf in content:
            content = content.replace(old_proto_check_crlf, new_proto_check_crlf)

    # 2. Fix autoPause null safety in Worker
    if "autoPause" in content:
        old_pause = "await sbRef.current.rpc(API.AUTO_PAUSE, { p_worker_id: workerIdRef.current, p_reason: reason });"
        new_pause = """if (sbRef.current && workerIdRef.current) {
            try {
                await sbRef.current.rpc(API.AUTO_PAUSE, { p_worker_id: workerIdRef.current, p_reason: reason });
            } catch (err) {
                console.warn('AutoPause error:', err);
            }
        }"""
        content = content.replace(old_pause, new_pause)

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Updated:", fpath)

print("All files updated successfully.")
