import os

target_dirs = [
    r"E:\Mohit\photo tool\AI Studio\app",
    r"E:\Mohit\photo tool\AI-Studio-Fullstack\AI-Studio\app"
]

for d in target_dirs:
    for fname in ['AI Studio Admin.jsx', 'AI Studio Customer.jsx', 'AI Studio Worker.jsx', 'apiClient.js']:
        fpath = os.path.join(d, fname)
        if not os.path.exists(fpath):
            continue
        with open(fpath, 'r', encoding='utf-8') as fp:
            content = fp.read()
        
        # 1. Update localStorage cache cleanup
        old_pattern = "const savedApi = localStorage.getItem('aistudio_api_url');\n            if (savedApi) return savedApi.replace(/\\/$/, \"\");"
        new_pattern = """const savedApi = localStorage.getItem('aistudio_api_url');
            if (savedApi) {
                if (savedApi.includes('trycloudflare.com') || savedApi.includes('localhost:5005')) {
                    try { localStorage.removeItem('aistudio_api_url'); } catch { }
                } else {
                    return savedApi.replace(/\\/$/, "");
                }
            }"""
        
        # 2. Add log of target URL in Worker
        if fname == 'AI Studio Worker.jsx':
            content = content.replace(
                "const client = lib.createClient(API_URL, apiKey);",
                "const client = lib.createClient(API_URL, apiKey);\n            log(`Connecting to ${client.apiUrl}...`);"
            )
        
        # Also Admin
        if fname == 'AI Studio Admin.jsx':
            content = content.replace(
                "loadApiClient(apiKey).then(client => {",
                "loadApiClient(apiKey).then(client => {\n            console.log('Connecting Admin to:', client.apiUrl);"
            )
        
        if old_pattern in content:
            content = content.replace(old_pattern, new_pattern)
            print("Replaced pattern in:", fpath)
        else:
            # Check CRLF
            old_pattern_crlf = old_pattern.replace("\n", "\r\n")
            new_pattern_crlf = new_pattern.replace("\n", "\r\n")
            if old_pattern_crlf in content:
                content = content.replace(old_pattern_crlf, new_pattern_crlf)
                print("Replaced CRLF pattern in:", fpath)
            else:
                print("Pattern not found in:", fpath)
        
        with open(fpath, 'w', encoding='utf-8') as fp:
            fp.write(content)

print("Done updating files.")
